<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Payroll;

use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollBatchRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollRecordRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayslipRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
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
        private readonly FileStorageService $fileStorage,
        private readonly CsvParser $csvParser,
        private readonly ExcelImportAdapter $excelImportAdapter,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger
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
        $parsed = $this->parseFile($absolutePath, (string) ($file['name'] ?? ''));

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

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'payroll.uploaded', 'payroll_batch', (string) $batchId, ['period_month' => $periodMonth, 'period_year' => $periodYear]);

        return [
            'batch' => [
                'id' => $batchId,
                'upload_status' => 'uploaded',
            ],
            'headers' => $parsed['headers'],
            'sample_rows' => array_slice($parsed['rows'], 0, 3),
            'mapping_suggestions' => $this->mappingSuggestions($parsed['headers']),
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
        ];
    }

    public function saveMapping(int $batchId, string $tenantId, array $actor, array $mapping): array
    {
        $batch = $this->mustFindBatch($batchId, $tenantId, $actor);
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
        $mapping = json_decode((string) ($batch['mapping_json'] ?? 'null'), true);
        if (!is_array($mapping)) {
            throw new ValidationException('Batch must be mapped before validation.');
        }

        $parsed = $this->parseFile($this->fileStorage->absolutePath((string) $batch['source_file_path']), (string) $batch['source_file_name']);
        $summary = [
            'total_rows' => 0,
            'valid_rows' => 0,
            'error_rows' => 0,
            'critical_errors' => [],
            'normalized_rows' => [],
        ];
        $seenEmployeeIds = [];

        foreach ($parsed['rows'] as $row) {
            $normalized = $this->normalizeRow($row, $mapping);
            $errors = $this->validateNormalizedRow($normalized, $seenEmployeeIds);
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
            ];
        }

        $status = $summary['error_rows'] > 0 ? 'validated' : 'processed';
        $this->payrollBatchRepository->updateValidation($batchId, $tenantId, $status, $summary);

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
                'designation_snapshot' => null,
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
        $records = $this->payrollRecordRepository->listByBatch($batchId, $tenantId);
        if ($records === []) {
            throw new ValidationException('Batch must be confirmed before publishing.');
        }

        $generated = 0;
        $this->transactions->run(function () use ($records, $batch, $tenantId, $actor, &$generated, $batchId): void {
            foreach ($records as $record) {
                $filename = sprintf(
                    'payslip-%d-%s-%d-%02d.pdf',
                    $record['user_id'],
                    $record['employee_id'],
                    $batch['period_year'],
                    $batch['period_month']
                );
                $relativePath = 'payslips/' . $tenantId . '/' . $filename;
                $this->fileStorage->write($relativePath, $this->pdfPayload($record, $batch));
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
        if (($actor['user_type'] ?? '') === 'branch_admin' && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
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
            'employee_id' => ['emp code', 'employee code', 'employee id', 'staff id'],
            'employee_name' => ['emp name', 'employee name', 'name'],
            'gross_pay' => ['gross', 'gross pay', 'gross salary'],
            'total_deductions' => ['deduction', 'deductions', 'total deduction'],
            'net_pay' => ['net', 'net pay', 'net salary', 'net amt'],
            'basic' => ['basic', 'basic salary'],
            'hra' => ['hra', 'house rent'],
            'allowances' => ['allowance', 'allowances', 'special allowance'],
            'pf' => ['pf', 'provident fund'],
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

    private function normalizeRow(array $row, array $mapping): array
    {
        $get = static fn (string $field): string => isset($mapping[$field]) ? trim((string) ($row[$mapping[$field]] ?? '')) : '';
        $earnings = [
            'basic' => $this->money($get('basic')),
            'hra' => $this->money($get('hra')),
            'allowances' => $this->money($get('allowances')),
        ];
        $deductions = [
            'pf' => $this->money($get('pf')),
            'esi' => $this->money($get('esi')),
            'professional_tax' => $this->money($get('professional_tax')),
            'tds' => $this->money($get('tds')),
        ];
        $gross = $get('gross_pay') !== '' ? $this->money($get('gross_pay')) : array_sum($earnings);
        $deductionTotal = $get('total_deductions') !== '' ? $this->money($get('total_deductions')) : array_sum($deductions);

        return [
            'employee_id' => $get('employee_id'),
            'employee_name' => $get('employee_name'),
            'gross_pay' => $gross,
            'total_deductions' => $deductionTotal,
            'net_pay' => $get('net_pay') !== '' ? $this->money($get('net_pay')) : round($gross - $deductionTotal, 2),
            'earnings' => $earnings,
            'deductions' => $deductions,
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

    private function money(mixed $value): float
    {
        $clean = preg_replace('/[^0-9.\-]/', '', (string) $value) ?? '0';
        return round((float) ($clean === '' ? 0 : $clean), 2);
    }

    private function slugify(string $value): string
    {
        $slug = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $value), '-'));
        return $slug !== '' ? $slug : 'payroll';
    }

    private function pdfPayload(array $record, array $batch): string
    {
        $lines = [
            'Worknest Payslip',
            'Period: ' . $batch['period_month'] . '/' . $batch['period_year'],
            'Employee: ' . $record['employee_name_snapshot'] . ' (' . $record['employee_id'] . ')',
            'Gross Pay: INR ' . number_format((float) $record['gross_pay'], 2),
            'Deductions: INR ' . number_format((float) $record['total_deductions'], 2),
            'Net Pay: INR ' . number_format((float) $record['net_pay'], 2),
        ];
        $text = implode("\\n", array_map(static fn (string $line): string => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line), $lines));
        $stream = "BT /F1 14 Tf 72 760 Td ({$text}) Tj ET";
        $objects = [
            '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
            '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
            '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
            '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
            '5 0 obj << /Length ' . strlen($stream) . " >> stream\n{$stream}\nendstream endobj",
        ];
        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }
        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return $pdf;
    }
}
