<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Payroll;

use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Domain\Payslip\PayslipPdfGenerator;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollBatchRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollRecordRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayslipRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PinHasher;
use Worknest\Api\Infrastructure\Storage\CsvParser;
use Worknest\Api\Infrastructure\Storage\ExcelImportAdapter;
use Worknest\Api\Infrastructure\Storage\FileStorageService;

final class PayrollService
{
    public function __construct(
        private readonly PayrollBatchRepositoryInterface $payrollBatchRepository,
        private readonly PayrollRecordRepositoryInterface $payrollRecordRepository,
        private readonly PayslipRepositoryInterface $payslipRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly RoleRepositoryInterface $roleRepository,
        private readonly PinHasher $pinHasher,
        private readonly FileStorageService $fileStorage,
        private readonly CsvParser $csvParser,
        private readonly ExcelImportAdapter $excelImportAdapter,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger,
        private readonly PayslipPdfGenerator $pdfGenerator,
    ) {
    }

    public function uploadBatch(string $tenantId, array $actor, array $payload, array $file): array
    {
        $officeId = (int) ($payload['office_id'] ?? 0);
        $periodMonth = (int) ($payload['period_month'] ?? 0);
        $periodYear = (int) ($payload['period_year'] ?? 0);

        if ($officeId <= 0 || $periodMonth < 1 || $periodMonth > 12 || $periodYear < 2000) {
            throw new ValidationException('Office and payroll period are required.');
        }

        $this->assertOfficeAccess($officeId, $tenantId, $actor);

        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) <= 0) {
            throw new ValidationException('Payroll file upload failed.');
        }
        if (($file['size'] ?? 0) > 10 * 1024 * 1024) {
            throw new ApiException('UPLOAD_TOO_LARGE', 'Payroll file cannot exceed 10MB.', 413);
        }

        $storedFilename = $this->slugify(pathinfo((string) ($file['name'] ?? 'payroll'), PATHINFO_FILENAME))
            . '-' . bin2hex(random_bytes(8))
            . '.' . strtolower(pathinfo((string) ($file['name'] ?? ''), PATHINFO_EXTENSION));
        $relativePath = 'uploads/payroll/' . $tenantId . '/' . $storedFilename;
        $absolutePath = $this->fileStorage->storeUploadedFile($file, 'uploads/payroll/' . $tenantId, $storedFilename);
        $replacedBatch = $this->payrollBatchRepository->findActiveByOfficeAndPeriod($tenantId, $officeId, $periodYear, $periodMonth);
        $batchStored = false;
        $replacedFilePaths = $replacedBatch !== null
            ? array_values(array_unique(array_filter([
                (string) ($replacedBatch['source_file_path'] ?? ''),
                ...$this->payslipRepository->listFilePathsForPeriod($tenantId, $officeId, $periodYear, $periodMonth),
            ])))
            : [];

        try {
            $parsed = $this->parseFile($absolutePath, (string) ($file['name'] ?? ''));
            $isWorkbookUpload = isset($parsed['sheets']);
            $payrollSheet = $this->payrollSheetFromParsed($parsed);
            $employeeSheetChanges = $this->employeeSheetChangesFromParsed($parsed, $tenantId, $officeId);
            $mapping = $this->autoDetectMapping($payrollSheet['headers']);

            $result = $this->transactions->run(function () use (
                $tenantId,
                $officeId,
                $periodYear,
                $periodMonth,
                $file,
                $relativePath,
                $absolutePath,
                $actor,
                $mapping,
                $payrollSheet,
                $employeeSheetChanges,
                $isWorkbookUpload,
                $replacedBatch
            ): array {
                if ($replacedBatch !== null) {
                    $this->payrollBatchRepository->hardDelete((int) $replacedBatch['id'], $tenantId);
                }

                $this->applyEmployeeSheetChanges($tenantId, $officeId, $actor, $employeeSheetChanges);
                $summary = $this->buildValidationSummary($payrollSheet['rows'], $mapping, $tenantId, $officeId);
                $records = ($summary['error_rows'] ?? 0) > 0
                    ? []
                    : $this->recordsFromSummary($summary, $tenantId, $officeId);

                if ($isWorkbookUpload && ($summary['error_rows'] ?? 0) > 0) {
                    throw $this->uploadFailureForSummary($summary);
                }

                $batchId = $this->payrollBatchRepository->create([
                    'tenant_id' => $tenantId,
                    'office_id' => $officeId,
                    'period_year' => $periodYear,
                    'period_month' => $periodMonth,
                    'source_file_name' => (string) $file['name'],
                    'source_file_path' => $relativePath,
                    'source_file_hash' => hash_file('sha256', $absolutePath) ?: hash('sha256', (string) $file['name']),
                    'upload_status' => 'uploaded',
                    'uploaded_by_user_id' => (int) $actor['id'],
                ]);

                $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
                if ($records !== []) {
                    $this->payrollRecordRepository->replaceForBatch($batchId, $tenantId, $records);
                    $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'processed', $summary);
                } else {
                    $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'failed', $summary);
                }

                return [
                    'batch_id' => $batchId,
                    'summary' => $summary,
                    'records_created' => count($records),
                    'employees_created' => count($employeeSheetChanges['creates']),
                    'employees_updated' => count($employeeSheetChanges['updates']),
                ];
            });
            $batchStored = true;
            $batchId = (int) $result['batch_id'];
            $summary = $result['summary'];

            foreach ($replacedFilePaths as $path) {
                $this->fileStorage->deleteIfExists($path);
            }

            $this->auditLogger->log(
                $tenantId,
                $officeId,
                (int) $actor['id'],
                'payroll.uploaded',
                'payroll_batch',
                (string) $batchId,
                [
                    'period_month' => $periodMonth,
                    'period_year' => $periodYear,
                    'employees_created' => (int) $result['employees_created'],
                    'employees_updated' => (int) $result['employees_updated'],
                    'replaced_batch_id' => $replacedBatch !== null ? (int) $replacedBatch['id'] : null,
                ]
            );

            if (($summary['error_rows'] ?? 0) > 0) {
                throw $this->uploadFailureForSummary($summary);
            }

            return [
                'batch' => [
                    'id' => $batchId,
                    'upload_status' => 'processed',
                ],
                'records_created' => (int) $result['records_created'],
                'employees_created' => (int) $result['employees_created'],
                'employees_updated' => (int) $result['employees_updated'],
            ];
        } catch (ValidationException|ApiException $exception) {
            if (!$batchStored) {
                $this->fileStorage->deleteIfExists($relativePath);
            }
            throw $exception;
        } catch (\Throwable $exception) {
            if (!$batchStored) {
                $this->fileStorage->deleteIfExists($relativePath);
            }
            throw $exception;
        }
    }

    public function importMissingEmployees(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        $this->assertBatchMutable($batch);

        $parsed = $this->parseFile(
            $this->fileStorage->absolutePath((string) $batch['source_file_path']),
            (string) $batch['source_file_name']
        );
        $payrollSheet = $this->payrollSheetFromParsed($parsed);
        $mapping = $this->existingOrDetectedMapping($batch, $payrollSheet['headers']);
        $employeeRole = $this->roleRepository->findByKey('employee');
        if ($employeeRole === null) {
            throw new ValidationException('Employee role is not configured.');
        }

        $createdEmployees = [];

        $this->transactions->run(function () use ($parsed, $mapping, $tenantId, $batch, $actor, $employeeRole, &$createdEmployees): void {
            foreach ($payrollSheet['rows'] as $row) {
                $normalized = $this->normalizeRow($row, $mapping);
                $employeeId = $normalized['employee_id'];
                if ($employeeId === '') {
                    continue;
                }

                $existing = $this->userRepository->findActiveEmployeeByEmployeeId($tenantId, $employeeId);
                if ($existing !== null) {
                    continue;
                }

                $employeePayload = $this->employeePayloadFromRow($row, $mapping, $batch);
                $userId = $this->userRepository->create($employeePayload);
                $this->roleRepository->assignRole(
                    $tenantId,
                    $userId,
                    (int) $employeeRole['id'],
                    (int) $batch['office_id'],
                    (int) $actor['id']
                );

                $createdEmployees[] = [
                    'id' => $userId,
                    'employee_id' => $employeePayload['employee_id'],
                    'display_name' => $employeePayload['display_name'],
                    'phone' => $employeePayload['phone'],
                    'pin_seeded' => $employeePayload['employee_pin'] !== null,
                ];
            }
        });

        $summary = $this->buildValidationSummary($payrollSheet['rows'], $mapping, $tenantId, (int) $batch['office_id']);

        if (($summary['error_rows'] ?? 0) === 0) {
            $records = $this->recordsFromSummary($summary, $tenantId, (int) $batch['office_id']);
            $this->transactions->run(function () use ($batchId, $tenantId, $mapping, $summary, $records): void {
                $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
                $this->payrollRecordRepository->replaceForBatch($batchId, $tenantId, $records);
                $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'processed', $summary);
            });

            $this->auditLogger->log(
                $tenantId,
                (int) $batch['office_id'],
                (int) $actor['id'],
                'payroll.missing_employees_imported',
                'payroll_batch',
                (string) $batchId,
                ['employees_created' => count($createdEmployees), 'records_created' => count($records)]
            );

            return [
                'batch' => [
                    'id' => $batchId,
                    'upload_status' => 'processed',
                ],
                'employees_created' => count($createdEmployees),
                'created_employees' => $createdEmployees,
                'records_created' => count($records),
                'summary' => $summary,
            ];
        }

        $this->transactions->run(function () use ($batchId, $tenantId, $mapping, $summary): void {
            $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
            $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'failed', $summary);
        });

        $this->auditLogger->log(
            $tenantId,
            (int) $batch['office_id'],
            (int) $actor['id'],
            'payroll.missing_employees_import_attempted',
            'payroll_batch',
            (string) $batchId,
            ['employees_created' => count($createdEmployees), 'remaining_errors' => (int) ($summary['error_rows'] ?? 0)]
        );

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => 'failed',
            ],
            'employees_created' => count($createdEmployees),
            'created_employees' => $createdEmployees,
            'records_created' => 0,
            'summary' => $summary,
        ];
    }

    public function listBatches(string $tenantId, array $actor, array $filters): array
    {
        return ['batches' => $this->payrollBatchRepository->listByTenant($tenantId, $actor, $filters)];
    }

    public function getBatchDetail(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        $office = $this->officeRepository->findById((int) $batch['office_id'], $tenantId);
        $records = $this->payrollRecordRepository->listByBatch($batchId, $tenantId);
        $parsed = $this->parseFile(
            $this->fileStorage->absolutePath((string) $batch['source_file_path']),
            (string) $batch['source_file_name']
        );
        $payrollSheet = $this->payrollSheetFromParsed($parsed);

        return [
            'batch' => $this->serializeBatch($batch),
            'office' => $office === null ? null : [
                'id' => (int) $office['id'],
                'name' => $office['name'],
                'office_type' => $office['office_type'],
                'status' => $office['status'],
                'city' => $office['city'] ?? null,
                'state' => $office['state'] ?? null,
            ],
            'records' => array_map(fn (array $record): array => $this->serializeRecord($record), $records),
            'headers' => $payrollSheet['headers'],
            'sample_rows' => array_slice($payrollSheet['rows'], 0, 3),
            'mapping_suggestions' => $this->mappingSuggestions($payrollSheet['headers']),
        ];
    }

    public function saveMapping(int $batchId, string $tenantId, array $actor, array $mapping): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        $this->assertBatchMutable($batch);
        foreach (['employee_id', 'employee_name', 'gross_pay', 'total_deductions', 'net_pay'] as $field) {
            if (empty($mapping[$field])) {
                throw new ValidationException('Required mappings are missing.', ['field' => $field]);
            }
        }

        $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
        $this->auditLogger->log($tenantId, (int) $batch['office_id'], (int) $actor['id'], 'payroll.mapping_saved', 'payroll_batch', (string) $batchId);

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => 'mapped',
                'mapping' => $mapping,
            ],
        ];
    }

    public function validateBatch(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        $this->assertBatchMutable($batch);
        $parsed = $this->parseFile($this->fileStorage->absolutePath((string) $batch['source_file_path']), (string) $batch['source_file_name']);
        $payrollSheet = $this->payrollSheetFromParsed($parsed);
        $mapping = $this->existingOrDetectedMapping($batch, $payrollSheet['headers']);
        $summary = $this->buildValidationSummary($payrollSheet['rows'], $mapping, $tenantId, (int) $batch['office_id']);
        $status = $summary['error_rows'] > 0 ? 'failed' : 'processed';

        if ($summary['error_rows'] === 0) {
            $records = $this->recordsFromSummary($summary, $tenantId, (int) $batch['office_id']);
            $this->transactions->run(function () use ($batchId, $tenantId, $mapping, $summary, $records): void {
                $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
                $this->payrollRecordRepository->replaceForBatch($batchId, $tenantId, $records);
                $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'processed', $summary);
            });
        } else {
            $this->transactions->run(function () use ($batchId, $tenantId, $mapping, $summary): void {
                $this->payrollBatchRepository->updateMapping($batchId, $tenantId, $mapping);
                $this->payrollBatchRepository->updateValidation($batchId, $tenantId, 'failed', $summary);
            });
        }

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => $status,
            ],
            'summary' => $summary,
        ];
    }

    public function confirmBatch(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        $this->assertBatchMutable($batch);
        $summary = json_decode((string) ($batch['validation_summary_json'] ?? 'null'), true);
        if (!is_array($summary) || !isset($summary['normalized_rows'])) {
            throw new ValidationException('Batch must be validated before confirmation.');
        }
        if (($summary['error_rows'] ?? 0) > 0) {
            throw new ApiException('CONFIRM_BLOCKED', 'Critical payroll errors must be fixed before confirmation.', 422);
        }

        $records = [];
        foreach ($summary['normalized_rows'] as $item) {
            $normalized = $item['data'];
            $employee = $this->userRepository->findActiveEmployeeByEmployeeId($tenantId, $normalized['employee_id']);
            if ($employee === null) {
                throw new ValidationException('Employee referenced in payroll batch does not exist.', [
                    'employee_id' => $normalized['employee_id'],
                ]);
            }
            if ((int) $employee['office_id'] !== (int) $batch['office_id']) {
                throw new ValidationException('Employee branch assignment does not match the payroll batch office.', [
                    'employee_id' => $normalized['employee_id'],
                ]);
            }

            $records[] = [
                'office_id' => (int) $batch['office_id'],
                'user_id' => (int) $employee['id'],
                'employee_id' => $normalized['employee_id'],
                'employee_name_snapshot' => $normalized['employee_name'],
                'designation_snapshot' => $normalized['designation'] !== '' ? $normalized['designation'] : null,
                'gross_pay' => $normalized['gross_pay'],
                'total_deductions' => $normalized['total_deductions'],
                'net_pay' => $normalized['net_pay'],
                'earnings_json' => $normalized['earnings'],
                'deductions_json' => $normalized['deductions'],
                'currency' => 'INR',
                'record_status' => 'valid',
                'validation_errors_json' => [],
            ];
        }

        $this->transactions->run(function () use ($batchId, $tenantId, $actor, $records): void {
            $this->payrollRecordRepository->replaceForBatch($batchId, $tenantId, $records);
            $this->payrollBatchRepository->markConfirmed($batchId, $tenantId, (int) $actor['id']);
        });

        $this->auditLogger->log($tenantId, (int) $batch['office_id'], (int) $actor['id'], 'payroll.confirmed', 'payroll_batch', (string) $batchId);

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => 'confirmed',
            ],
            'records_created' => count($records),
        ];
    }

    public function publishBatch(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
        if (($batch['upload_status'] ?? '') === 'published') {
            throw new ApiException('BATCH_IMMUTABLE', 'Published payroll batches cannot be republished in place.', 409);
        }
        if (($batch['upload_status'] ?? '') !== 'confirmed') {
            throw new ValidationException('Batch must be confirmed before publishing.');
        }
        $records = $this->payrollRecordRepository->listByBatch($batchId, $tenantId);
        if ($records === []) {
            throw new ValidationException('Batch must be confirmed before publishing.');
        }
        $office = $this->officeRepository->findById((int) $batch['office_id'], $tenantId);

        $generated = 0;
        $this->transactions->run(function () use ($records, $batch, $tenantId, $actor, &$generated, $batchId, $office): void {
            $this->payslipRepository->supersedePublishedForPeriod(
                $tenantId,
                (int) $batch['office_id'],
                (int) $batch['period_year'],
                (int) $batch['period_month']
            );
            foreach ($records as $record) {
                $employee = $this->userRepository->findById((int) $record['user_id'], $tenantId);
                $recordPayload = $employee !== null
                    ? array_merge($record, $this->employeeMetadataPayload($employee))
                    : $record;
                $filename = sprintf(
                    'payslip-%d-%s-%d-%02d.pdf',
                    $record['user_id'],
                    $record['employee_id'],
                    $batch['period_year'],
                    $batch['period_month']
                );
                $relativePath = 'payslips/' . $tenantId . '/' . $filename;
                $this->fileStorage->write($relativePath, $this->pdfGenerator->generateFromRecord($recordPayload, $batch, $office));
                $this->payslipRepository->createOrReplace([
                    'tenant_id' => $tenantId,
                    'office_id' => (int) $batch['office_id'],
                    'payroll_record_id' => (int) $record['id'],
                    'user_id' => (int) $record['user_id'],
                    'period_year' => (int) $batch['period_year'],
                    'period_month' => (int) $batch['period_month'],
                    'file_path' => $relativePath,
                    'file_format' => 'pdf',
                    'generated_at' => date('Y-m-d H:i:s'),
                    'published_at' => date('Y-m-d H:i:s'),
                    'status' => 'published',
                ]);
                $generated++;
            }

            $this->payrollRecordRepository->markPublishedByBatch($batchId, $tenantId);
            $this->payrollBatchRepository->markPublished($batchId, $tenantId, (int) $actor['id']);
        });

        $this->auditLogger->log($tenantId, (int) $batch['office_id'], (int) $actor['id'], 'payroll.published', 'payroll_batch', (string) $batchId, ['payslips_generated' => $generated]);

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => 'published',
            ],
            'summary' => [
                'employee_count' => count($records),
                'payslips_generated' => $generated,
                'employee_notifications' => 'pending',
            ],
        ];
    }

    private function mustFindBatch(int $batchId, string $tenantId, array $actor): array
    {
        $batch = $this->payrollBatchRepository->findById($batchId, $tenantId);
        if ($batch === null) {
            throw new NotFoundException('Payroll batch not found.');
        }
        $this->assertOfficeAccess((int) $batch['office_id'], $tenantId, $actor);

        return $batch;
    }

    private function serializeBatch(array $batch): array
    {
        return [
            'id' => (int) $batch['id'],
            'tenant_id' => $batch['tenant_id'],
            'office_id' => (int) $batch['office_id'],
            'period_year' => (int) $batch['period_year'],
            'period_month' => (int) $batch['period_month'],
            'source_file_name' => $batch['source_file_name'],
            'source_file_path' => $batch['source_file_path'],
            'upload_status' => $batch['upload_status'],
            'mapping' => $this->decodeJsonColumn($batch['mapping_json'] ?? null),
            'validation_summary' => $this->decodeJsonColumn($batch['validation_summary_json'] ?? null),
            'confirmed_by_user_id' => $batch['confirmed_by_user_id'] !== null ? (int) $batch['confirmed_by_user_id'] : null,
            'published_by_user_id' => $batch['published_by_user_id'] !== null ? (int) $batch['published_by_user_id'] : null,
            'uploaded_at' => $batch['uploaded_at'] ?? null,
            'confirmed_at' => $batch['confirmed_at'] ?? null,
            'published_at' => $batch['published_at'] ?? null,
            'created_at' => $batch['created_at'] ?? null,
            'updated_at' => $batch['updated_at'] ?? null,
        ];
    }

    private function serializeRecord(array $record): array
    {
        return [
            'id' => (int) $record['id'],
            'user_id' => (int) $record['user_id'],
            'employee_id' => $record['employee_id'],
            'employee_name_snapshot' => $record['employee_name_snapshot'],
            'gross_pay' => (float) $record['gross_pay'],
            'total_deductions' => (float) $record['total_deductions'],
            'net_pay' => (float) $record['net_pay'],
            'currency' => $record['currency'],
            'record_status' => $record['record_status'],
            'earnings' => $this->decodeJsonColumn($record['earnings_json'] ?? null),
            'deductions' => $this->decodeJsonColumn($record['deductions_json'] ?? null),
            'validation_errors' => $this->decodeJsonColumn($record['validation_errors_json'] ?? null),
        ];
    }

    private function decodeJsonColumn(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function assertOfficeAccess(int $officeId, string $tenantId, array $actor): void
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new ValidationException('Office was not found.');
        }
        if (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true) && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
            throw new ForbiddenException();
        }
    }

    private function parseFile(string $absolutePath, string $originalFilename): array
    {
        $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
        return match ($extension) {
            'csv' => $this->csvParser->parse($absolutePath),
            'xlsx' => $this->excelImportAdapter->parse($absolutePath),
            default => throw new ValidationException('Upload must be CSV or XLSX.'),
        };
    }

    private function mappingSuggestions(array $headers): array
    {
        $targets = [
            'employee_id' => ['id', 'emp id', 'emp code', 'employee code', 'employee id', 'employee number', 'staff id'],
            'employee_name' => ['full name', 'emp name', 'employee name', 'name'],
            'phone' => ['phone', 'phone number', 'mobile', 'mobile number', 'contact number'],
            'pin' => ['pin', 'login pin'],
            'gross_pay' => ['gross', 'gross pay', 'gross salary', 'gross amt'],
            'total_deductions' => ['deduction', 'deductions', 'total deduction'],
            'net_pay' => ['net', 'net pay', 'net salary', 'net amt', 'net pay credited to bank a/c'],
            'designation' => ['designation'],
            'days_paid' => ['days paid'],
            'ot_hours' => ['ot hours', 'overtime hours'],
            'basic' => ['basic', 'basic salary', 'basic rate', 'wages earned'],
            'hra' => ['hra', 'house rent'],
            'allowances' => ['allowance', 'allowances', 'special allowance'],
            'proj_allowance' => ['proj allowance', 'project allowance'],
            'v_allowance' => ['v allowance'],
            'ot_amount' => ['ot amount', 'overtime amount'],
            'h_allowance' => ['h allowance', 'housing allowance'],
            's_allowance' => ['s allowance'],
            'sca_da' => ['sca / da', 'sca da'],
            'mess_allow' => ['mess allow', 'mess allowance'],
            'bonus_8_33' => ['bonus @ 8.33 %', 'bonus @ 8.33%', 'bonus 8.33'],
            'area_allowance' => ['area allowance'],
            'washing_allowance' => ['washing allowance'],
            'performance_allowance' => ['performance allowance'],
            'pf' => ['pf', 'provident fund'],
            'mess' => ['mess'],
            'advance' => ['advance'],
            'esi' => ['esi'],
            'professional_tax' => ['pt', 'professional tax'],
            'tds' => ['tds', 'tax deducted'],
        ];

        $suggestions = [];
        foreach ($targets as $field => $needles) {
            foreach ($headers as $header) {
                $normalized = strtolower(trim((string) $header));
                foreach ($needles as $needle) {
                    if ($normalized === $needle || str_contains($normalized, $needle)) {
                        $suggestions[$field] = [
                            'source' => $header,
                            'confidence' => $normalized === $needle ? 'high' : 'medium',
                        ];
                        continue 3;
                    }
                }
            }
        }

        return $suggestions;
    }

    private function autoDetectMapping(array $headers): array
    {
        $suggestions = $this->mappingSuggestions($headers);
        $mapping = [];
        foreach ($suggestions as $field => $suggestion) {
            $mapping[$field] = $suggestion['source'];
        }

        $requiredFields = ['employee_id', 'employee_name', 'gross_pay', 'total_deductions', 'net_pay'];
        $missingFields = array_values(array_filter(
            $requiredFields,
            static fn (string $field): bool => empty($mapping[$field])
        ));

        if ($missingFields !== []) {
            throw new ValidationException(
                'Required payroll columns could not be recognized automatically.',
                ['missing_fields' => $missingFields]
            );
        }

        return $this->attachPayrollBands($headers, $mapping);
    }

    private function existingOrDetectedMapping(array $batch, array $headers): array
    {
        $existing = json_decode((string) ($batch['mapping_json'] ?? 'null'), true);
        if (is_array($existing) && $existing !== []) {
            return $this->attachPayrollBands($headers, $existing);
        }

        return $this->autoDetectMapping($headers);
    }

    private function buildValidationSummary(array $rows, array $mapping, string $tenantId, int $officeId): array
    {
        $summary = [
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'critical_errors' => [],
            'normalized_rows' => [],
        ];
        $seenEmployeeIds = [];

        foreach ($rows as $row) {
            if ($this->shouldSkipRow($row, $mapping)) {
                continue;
            }

            $normalized = $this->normalizeRow($row, $mapping);
            $errors = $this->validateNormalizedRow($normalized, $seenEmployeeIds);
            $employee = null;

            if ($normalized['employee_id'] !== '') {
                $employee = $this->userRepository->findActiveEmployeeByEmployeeId($tenantId, $normalized['employee_id']);
                if ($employee === null) {
                    $errors[] = 'Employee ' . $normalized['employee_id'] . ' is not in Worknest yet. Add the employee first and upload again.';
                } elseif ((int) $employee['office_id'] !== $officeId) {
                    $errors[] = 'Employee ' . $normalized['employee_id'] . ' is assigned to a different branch.';
                }
            }

            if ($normalized['employee_id'] !== '') {
                $seenEmployeeIds[$normalized['employee_id']] = true;
            }

            $summary['total_rows']++;
            if ($errors === []) {
                $summary['valid_rows']++;
            } else {
                $summary['error_rows']++;
                array_push($summary['critical_errors'], ...$errors);
            }

            $summary['normalized_rows'][] = [
                'data' => $normalized,
                'errors' => $errors,
                'user_id' => $employee !== null ? (int) $employee['id'] : null,
            ];
        }

        $summary['critical_errors'] = array_values(array_unique($summary['critical_errors']));

        return $summary;
    }

    private function recordsFromSummary(array $summary, string $tenantId, int $officeId): array
    {
        $records = [];

        foreach ($summary['normalized_rows'] as $item) {
            if (($item['errors'] ?? []) !== []) {
                continue;
            }

            $normalized = $item['data'];
            $records[] = [
                'office_id' => $officeId,
                'user_id' => (int) $item['user_id'],
                'employee_id' => $normalized['employee_id'],
                'employee_name_snapshot' => $normalized['employee_name'],
                'designation_snapshot' => $normalized['designation'] !== '' ? $normalized['designation'] : null,
                'gross_pay' => $normalized['gross_pay'],
                'total_deductions' => $normalized['total_deductions'],
                'net_pay' => $normalized['net_pay'],
                'earnings_json' => $normalized['earnings'],
                'deductions_json' => $normalized['deductions'],
                'currency' => 'INR',
                'record_status' => 'valid',
                'validation_errors_json' => [],
            ];
        }

        return $records;
    }

    private function uploadFailureForSummary(array $summary): ValidationException
    {
        $message = $summary['critical_errors'][0] ?? 'The uploaded paysheet could not be processed.';
        return new ValidationException($message, ['summary' => $summary]);
    }

    private function normalizeRow(array $row, array $mapping): array
    {
        $get = fn (string $field): string => isset($mapping[$field])
            ? $this->sanitizeCellValue($row[$mapping[$field]] ?? '')
            : '';
        $visibleEarnings = $this->extractDynamicBandValues($row, $mapping['_earnings_headers'] ?? []);
        $visibleDeductions = $this->extractDynamicBandValues($row, $mapping['_deduction_headers'] ?? []);
        $gross = $get('gross_pay') !== '' ? $this->money($get('gross_pay')) : array_sum($visibleEarnings);
        $deductionTotal = $get('total_deductions') !== '' ? $this->money($get('total_deductions')) : array_sum($visibleDeductions);

        return [
            'employee_id' => $get('employee_id'),
            'employee_name' => $get('employee_name'),
            'designation' => $get('designation'),
            'days_paid' => $get('days_paid'),
            'ot_hours' => $get('ot_hours'),
            'gross_pay' => $gross,
            'total_deductions' => $deductionTotal,
            'net_pay' => $get('net_pay') !== '' ? $this->money($get('net_pay')) : round($gross - $deductionTotal, 2),
            'earnings' => $visibleEarnings,
            'deductions' => $visibleDeductions,
        ];
    }

    private function validateNormalizedRow(array $row, array $seenEmployeeIds): array
    {
        $errors = [];
        if ($row['employee_id'] === '') {
            $errors[] = 'Missing employee ID.';
        }
        if ($row['employee_name'] === '') {
            $errors[] = 'Missing employee name.';
        }
        if ($row['employee_id'] !== '' && isset($seenEmployeeIds[$row['employee_id']])) {
            $errors[] = 'Duplicate employee ID in this import.';
        }
        if ($row['gross_pay'] < 0 || $row['total_deductions'] < 0 || $row['net_pay'] < 0) {
            $errors[] = 'Payroll amounts cannot be negative.';
        }
        if (abs(($row['gross_pay'] - $row['total_deductions']) - $row['net_pay']) > 1) {
            $errors[] = 'Net pay does not match gross pay minus deductions.';
        }

        return $errors;
    }

    private function employeePayloadFromRow(array $row, array $mapping, array $batch): array
    {
        $employeeId = $this->cellValue($row, $mapping, 'employee_id');
        $displayName = $this->cellValue($row, $mapping, 'employee_name');
        if ($displayName === '') {
            $displayName = 'Employee ' . $employeeId;
        }

        [$firstName, $lastName] = $this->splitDisplayName($displayName);
        $phone = $this->normalizePhone($this->cellValue($row, $mapping, 'phone'));
        if ($phone === '') {
            throw new ValidationException('Employee imports require a phone number for phone-based login.', [
                'employee_id' => $employeeId,
            ]);
        }
        $existingPhoneUser = $this->userRepository->findByPhone((string) $batch['tenant_id'], $phone);
        if ($existingPhoneUser !== null && (string) ($existingPhoneUser['employee_id'] ?? '') !== $employeeId) {
            throw new ValidationException('Duplicate phone number detected while importing employees.', [
                'employee_id' => $employeeId,
                'phone' => $phone,
            ]);
        }

        $pin = $this->cellValue($row, $mapping, 'pin');
        $employeePin = $this->pinHasher->hash($this->validPin($pin) ? $pin : $this->generatePin());

        return [
            'tenant_id' => (string) $batch['tenant_id'],
            'office_id' => (int) $batch['office_id'],
            'employee_id' => $employeeId,
            'first_name' => $firstName,
            'last_name' => $lastName !== '' ? $lastName : null,
            'display_name' => $displayName,
            'email' => null,
            'phone' => $phone !== '' ? $phone : null,
            'password_hash' => null,
            'employee_pin' => $employeePin,
            'user_type' => 'employee',
            'status' => 'active',
        ];
    }

    private function cellValue(array $row, array $mapping, string $field): string
    {
        if (!isset($mapping[$field])) {
            return '';
        }

        return $this->sanitizeCellValue($row[$mapping[$field]] ?? '');
    }

    private function splitDisplayName(string $displayName): array
    {
        $parts = preg_split('/\s+/', trim($displayName)) ?: [];
        $firstName = $parts[0] ?? $displayName;
        $lastName = count($parts) > 1 ? trim(implode(' ', array_slice($parts, 1))) : '';

        return [$firstName, $lastName];
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }
        if (strlen($digits) === 10) {
            return '+91' . $digits;
        }
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            return '+' . $digits;
        }
        if (str_starts_with(trim($phone), '+')) {
            return '+' . $digits;
        }

        return '+' . $digits;
    }

    private function validPin(string $pin): bool
    {
        return preg_match('/^[0-9]{4,8}$/', trim($pin)) === 1;
    }

    private function assertBatchMutable(array $batch): void
    {
        if (($batch['upload_status'] ?? '') === 'published') {
            throw new ApiException('BATCH_IMMUTABLE', 'Published payroll batches cannot be changed. Upload a new batch for corrections.', 409);
        }
    }

    private function money(mixed $value): float
    {
        $clean = preg_replace('/[^0-9.\-]/', '', (string) $value) ?? '0';
        return round((float) ($clean === '' ? 0 : $clean), 2);
    }

    private function moneyOrNull(mixed $value): ?float
    {
        $sanitized = $this->sanitizeCellValue($value);
        if ($sanitized === '') {
            return null;
        }

        return $this->money($sanitized);
    }

    private function sanitizeCellValue(mixed $value): string
    {
        $normalized = trim((string) $value);
        if ($normalized === '') {
            return '';
        }

        $placeholder = strtolower($normalized);
        if (in_array($placeholder, ['na', 'n/a', 'null', 'nil', 'none', '-'], true)) {
            return '';
        }

        return $normalized;
    }

    private function shouldSkipRow(array $row, array $mapping): bool
    {
        $nonEmptyValues = array_filter(
            array_map(fn (mixed $value): string => $this->sanitizeCellValue($value), $row),
            static fn (string $value): bool => $value !== ''
        );
        if ($nonEmptyValues === []) {
            return true;
        }

        $summaryLabels = [
            $this->normalizeSummaryLabel($this->cellValue($row, $mapping, 'employee_id')),
            $this->normalizeSummaryLabel($this->cellValue($row, $mapping, 'employee_name')),
        ];

        foreach ($summaryLabels as $label) {
            if (in_array($label, ['total', 'grandtotal', 'subtotal', 'summary'], true)) {
                return true;
            }
        }

        return false;
    }

    private function normalizeSummaryLabel(string $value): string
    {
        return strtolower((string) preg_replace('/[^a-z0-9]+/', '', trim($value)));
    }

    private function payrollSheetFromParsed(array $parsed): array
    {
        if (isset($parsed['headers'], $parsed['rows'])) {
            $this->assertParsedSheetIsTwoDimensional($parsed, 'Payroll file');

            return $parsed;
        }

        $sheets = $parsed['sheets'] ?? null;
        if (!is_array($sheets)) {
            throw new ValidationException('Uploaded workbook could not be understood.');
        }

        if (!isset($sheets['Payroll'])) {
            throw new ValidationException('Workbook must contain a sheet named Payroll.');
        }

        $this->assertParsedSheetIsTwoDimensional($sheets['Payroll'], 'Payroll sheet');

        return $sheets['Payroll'];
    }

    private function employeeSheetChangesFromParsed(array $parsed, string $tenantId, int $officeId): array
    {
        if (isset($parsed['headers'], $parsed['rows'])) {
            return ['creates' => [], 'updates' => []];
        }

        $sheets = $parsed['sheets'] ?? null;
        if (!is_array($sheets)) {
            throw new ValidationException('Uploaded workbook could not be understood.');
        }

        if (!isset($sheets['Employees'])) {
            throw new ValidationException('Workbook must contain a sheet named Employees.');
        }

        $this->assertParsedSheetIsTwoDimensional($sheets['Employees'], 'Employees sheet');

        return $this->buildEmployeeSheetChanges($sheets['Employees'], $tenantId, $officeId);
    }

    private function buildEmployeeSheetChanges(array $sheet, string $tenantId, int $officeId): array
    {
        $headerMap = $this->employeeSheetHeaderMap($sheet['headers']);
        $required = ['employee_id', 'full_name', 'phone'];
        $missing = array_values(array_filter($required, static fn (string $field): bool => !isset($headerMap[$field])));
        if ($missing !== []) {
            throw new ValidationException('Employees sheet is missing required columns.', ['missing_fields' => $missing]);
        }

        $creates = [];
        $updates = [];
        $seenPhones = [];
        $seenEmployeeIds = [];

        foreach ($sheet['rows'] as $index => $row) {
            if ($this->rowIsBlank($row)) {
                continue;
            }

            $employeeId = $this->sheetCell($row, $headerMap, 'employee_id');
            $fullName = $this->sheetCell($row, $headerMap, 'full_name');
            $phone = $this->normalizePhone($this->sheetCell($row, $headerMap, 'phone'));
            $rowNumber = $index + 2;

            if ($employeeId === '' || $fullName === '' || $phone === '') {
                throw new ValidationException('Employees sheet rows must include employee ID, full name, and phone number.', [
                    'row' => $rowNumber,
                ]);
            }
            if (isset($seenEmployeeIds[$employeeId])) {
                throw new ValidationException('Duplicate employee ID found in Employees sheet.', [
                    'employee_id' => $employeeId,
                    'row' => $rowNumber,
                ]);
            }
            if (isset($seenPhones[$phone])) {
                throw new ValidationException('Duplicate phone number found in Employees sheet.', [
                    'phone' => $phone,
                    'row' => $rowNumber,
                ]);
            }
            $seenEmployeeIds[$employeeId] = true;
            $seenPhones[$phone] = true;

            [$firstName, $lastName] = $this->splitDisplayName($fullName);
            $existingByEmployeeId = $this->userRepository->findEmployeeByEmployeeId($tenantId, $employeeId);
            $existingByPhone = $this->userRepository->findByPhone($tenantId, $phone);

            if ($existingByEmployeeId !== null) {
                if (($existingByEmployeeId['phone'] ?? null) !== $phone) {
                    throw new ValidationException('Employee ID and phone number must match the existing employee record.', [
                        'employee_id' => $employeeId,
                        'row' => $rowNumber,
                    ]);
                }
                $updatePayload = $this->employeeUserPayloadFromSheetRow($tenantId, $officeId, $row, $headerMap, $employeeId, $firstName, $lastName, $fullName, $phone);
                $sheetPin = $this->sheetCell($row, $headerMap, 'pin');
                if ($sheetPin !== '') {
                    $updatePayload['employee_pin'] = $this->employeePinFromSheetValue($sheetPin, $employeeId, $rowNumber);
                }
                $updates[] = [
                    'id' => (int) $existingByEmployeeId['id'],
                    'payload' => $updatePayload,
                ];
                continue;
            }

            if ($existingByPhone !== null) {
                throw new ValidationException('Duplicate phone number detected against an existing tenant user.', [
                    'phone' => $phone,
                    'row' => $rowNumber,
                ]);
            }

            $createPayload = $this->employeeUserPayloadFromSheetRow($tenantId, $officeId, $row, $headerMap, $employeeId, $firstName, $lastName, $fullName, $phone);
            $createPayload['employee_pin'] = $this->employeePinFromSheetValue(
                $this->sheetCell($row, $headerMap, 'pin'),
                $employeeId,
                $rowNumber,
                true
            );
            $creates[] = $createPayload;
        }

        return [
            'creates' => $creates,
            'updates' => $updates,
        ];
    }

    private function applyEmployeeSheetChanges(string $tenantId, int $officeId, array $actor, array $changes): void
    {
        foreach ($changes['updates'] as $change) {
            $this->userRepository->update((int) $change['id'], $tenantId, $change['payload']);
        }

        if ($changes['creates'] === []) {
            return;
        }

        $employeeRole = $this->roleRepository->findByKey('employee');
        if ($employeeRole === null) {
            throw new ValidationException('Employee role is not configured.');
        }

        foreach ($changes['creates'] as $payload) {
            $userId = $this->userRepository->create($payload);
            $this->roleRepository->assignRole(
                $tenantId,
                $userId,
                (int) $employeeRole['id'],
                $officeId,
                (int) $actor['id']
            );
        }
    }

    private function employeeSheetHeaderMap(array $headers): array
    {
        $aliases = [
            'employee_id' => ['employee id', 'id'],
            'full_name' => ['full name', 'employee name', 'name'],
            'phone' => ['phone number', 'phone numb', 'phone num', 'phone'],
            'pin' => ['pin', 'login pin'],
            'status' => ['status'],
            'employment_type' => ['employment'],
            'date_of_joining' => ['date of joining', 'date of joini', 'doj'],
            'uan' => ['uan'],
            'bank_name' => ['bank'],
            'ifsc' => ['ifsc'],
            'bank_account_number' => ['account number', 'account num', 'a/c no'],
            'designation' => ['designation'],
            'basic_rate' => ['basic rate'],
        ];

        $headerMap = [];
        foreach ($headers as $header) {
            $normalized = strtolower(trim((string) $header));
            foreach ($aliases as $field => $needles) {
                if (in_array($normalized, $needles, true)) {
                    $headerMap[$field] = (string) $header;
                    break;
                }
            }
        }

        return $headerMap;
    }

    private function employeeUserPayloadFromSheetRow(
        string $tenantId,
        int $officeId,
        array $row,
        array $headerMap,
        string $employeeId,
        string $firstName,
        string $lastName,
        string $fullName,
        string $phone
    ): array {
        return [
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
            'employee_id' => $employeeId,
            'first_name' => $firstName,
            'last_name' => $lastName !== '' ? $lastName : null,
            'display_name' => $fullName,
            'email' => null,
            'phone' => $phone,
            'password_hash' => null,
            'employment_type' => $this->nullableString($this->sheetCell($row, $headerMap, 'employment_type')),
            'date_of_joining' => $this->nullableDate($this->sheetCell($row, $headerMap, 'date_of_joining')),
            'uan' => $this->nullableString($this->sheetCell($row, $headerMap, 'uan')),
            'bank_name' => $this->nullableString($this->sheetCell($row, $headerMap, 'bank_name')),
            'bank_account_number' => $this->nullableString($this->sheetCell($row, $headerMap, 'bank_account_number')),
            'ifsc' => $this->nullableString($this->sheetCell($row, $headerMap, 'ifsc')),
            'designation' => $this->nullableString($this->sheetCell($row, $headerMap, 'designation')),
            'basic_rate' => $this->nullableMoney($this->sheetCell($row, $headerMap, 'basic_rate')),
            'user_type' => 'employee',
            'status' => $this->employeeStatusFromSheet($this->sheetCell($row, $headerMap, 'status')),
        ];
    }

    private function sheetCell(array $row, array $headerMap, string $field): string
    {
        if (!isset($headerMap[$field])) {
            return '';
        }

        return $this->sanitizeCellValue($row[$headerMap[$field]] ?? '');
    }

    private function rowIsBlank(array $row): bool
    {
        foreach ($row as $value) {
            if ($this->sanitizeCellValue($value) !== '') {
                return false;
            }
        }

        return true;
    }

    private function employeeStatusFromSheet(string $value): string
    {
        $normalized = strtolower(trim($value));

        return match ($normalized) {
            'inactive', 'disabled' => 'disabled',
            'suspended' => 'suspended',
            default => 'active',
        };
    }

    private function attachPayrollBands(array $headers, array $mapping): array
    {
        $otHoursHeader = $this->headerNameForField($headers, $mapping, 'ot_hours', ['ot hours', 'overtime hours']);
        $grossHeader = $this->headerNameForField($headers, $mapping, 'gross_pay', ['gross amt', 'gross pay', 'gross salary', 'gross']);
        $totalDeductionHeader = $this->headerNameForField($headers, $mapping, 'total_deductions', ['total deduction', 'deductions', 'deduction']);

        if ($otHoursHeader === null) {
            throw new ValidationException('Payroll sheet must contain an OT Hours column.');
        }
        if ($grossHeader === null) {
            throw new ValidationException('Payroll sheet must contain a GROSS AMT column.');
        }
        if ($totalDeductionHeader === null) {
            throw new ValidationException('Payroll sheet must contain a Total Deduction column.');
        }

        $otHoursIndex = array_search($otHoursHeader, $headers, true);
        $grossIndex = array_search($grossHeader, $headers, true);
        $totalDeductionIndex = array_search($totalDeductionHeader, $headers, true);

        if (!is_int($otHoursIndex) || !is_int($grossIndex) || !is_int($totalDeductionIndex)) {
            throw new ValidationException('Payroll sheet structure could not be resolved from the uploaded headers.');
        }

        if ($grossIndex <= $otHoursIndex || $totalDeductionIndex <= $grossIndex) {
            throw new ValidationException('Payroll sheet columns must follow this order: OT Hours, earnings heads, GROSS AMT, deduction heads, Total Deduction.');
        }

        $mapping['_earnings_headers'] = array_values(array_filter(
            array_slice($headers, $otHoursIndex + 1, $grossIndex - $otHoursIndex - 1),
            static fn (mixed $header): bool => is_string($header) && trim($header) !== ''
        ));
        $mapping['_deduction_headers'] = array_values(array_filter(
            array_slice($headers, $grossIndex + 1, $totalDeductionIndex - $grossIndex - 1),
            static fn (mixed $header): bool => is_string($header) && trim($header) !== ''
        ));

        return $mapping;
    }

    private function headerNameForField(array $headers, array $mapping, string $field, array $aliases): ?string
    {
        $mappedHeader = $mapping[$field] ?? null;
        if (is_string($mappedHeader) && in_array($mappedHeader, $headers, true)) {
            return $mappedHeader;
        }

        foreach ($headers as $header) {
            if (!is_string($header)) {
                continue;
            }

            $normalized = strtolower(trim($header));
            foreach ($aliases as $alias) {
                if ($normalized === $alias || str_contains($normalized, $alias)) {
                    return $header;
                }
            }
        }

        return null;
    }

    private function extractDynamicBandValues(array $row, array $headers): array
    {
        $values = [];

        foreach ($headers as $header) {
            if (!is_string($header) || trim($header) === '') {
                continue;
            }

            $cellValue = $this->sanitizeCellValue($row[$header] ?? '');
            if ($cellValue === '') {
                continue;
            }

            $values[$header] = $this->money($cellValue);
        }

        return $values;
    }

    private function employeePinFromSheetValue(string $pinValue, string $employeeId, int $rowNumber, bool $allowEmployeeIdFallback = false): string
    {
        $trimmed = trim($pinValue);
        if ($trimmed === '') {
            if (!$allowEmployeeIdFallback) {
                throw new ValidationException('Employees sheet PIN must be blank only for existing employees.', [
                    'employee_id' => $employeeId,
                    'row' => $rowNumber,
                ]);
            }

            $trimmed = strrev($employeeId);
        }

        if (!$this->validPin($trimmed)) {
            throw new ValidationException('Employees sheet PIN must be 4 to 8 digits.', [
                'employee_id' => $employeeId,
                'row' => $rowNumber,
            ]);
        }

        return $this->pinHasher->hash($trimmed);
    }

    private function employeeMetadataPayload(array $employee): array
    {
        return [
            'date_of_joining' => $employee['date_of_joining'] ?? null,
            'uan' => $employee['uan'] ?? null,
            'bank' => $employee['bank_name'] ?? null,
            'account_number' => $employee['bank_account_number'] ?? null,
            'ifsc' => $employee['ifsc'] ?? null,
            'designation_snapshot' => $employee['designation'] ?? null,
            'designation' => $employee['designation'] ?? null,
            'basic_rate' => $employee['basic_rate'] !== null ? (float) $employee['basic_rate'] : null,
        ];
    }

    private function generatePin(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function nullableString(string $value): ?string
    {
        $trimmed = trim($value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function nullableMoney(string $value): ?float
    {
        if ($value === '') {
            return null;
        }

        return $this->money($value);
    }

    private function nullableDate(string $value): ?string
    {
        if ($value === '') {
            return null;
        }

        $timestamp = strtotime($value);

        return $timestamp === false ? null : date('Y-m-d', $timestamp);
    }

    private function assertParsedSheetIsTwoDimensional(array $parsed, string $label): void
    {
        $headers = $parsed['headers'] ?? null;
        $rows = $parsed['rows'] ?? null;

        if (!is_array($headers) || $headers === []) {
            throw new ValidationException($label . ' must include a header row.');
        }

        foreach ($headers as $header) {
            if (!is_string($header) || trim($header) === '') {
                throw new ValidationException($label . ' must use a flat two-dimensional table with named columns.');
            }
        }

        if (!is_array($rows)) {
            throw new ValidationException($label . ' must contain sheet rows in a two-dimensional table.');
        }

        foreach ($rows as $row) {
            if (!is_array($row)) {
                throw new ValidationException($label . ' must contain sheet rows in a two-dimensional table.');
            }

            foreach ($row as $cell) {
                if (is_array($cell) || is_object($cell)) {
                    throw new ValidationException($label . ' must contain plain cell values in a two-dimensional table.');
                }
            }
        }
    }

    private function slugify(string $value): string
    {
        $slug = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $value), '-'));
        return $slug !== '' ? $slug : 'payroll';
    }
}
