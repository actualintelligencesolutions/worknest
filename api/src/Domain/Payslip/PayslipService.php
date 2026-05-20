<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Payslip;

use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayslipRepositoryInterface;

final class PayslipService
{
    public function __construct(
        private readonly PayslipRepositoryInterface $payslipRepository,
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly PayslipPdfGenerator $pdfGenerator,
        private readonly AuditLogger $auditLogger,
    ) {
    }

    public function listPayslips(string $tenantId, array $actor): array
    {
        return ['payslips' => $this->payslipRepository->listAccessible($tenantId, $actor)];
    }

    public function getPayslip(int $payslipId, string $tenantId, array $actor): array
    {
        $payslip = $this->payslipRepository->findAccessibleById($payslipId, $tenantId, $actor);
        if ($payslip === null) {
            throw new NotFoundException('No accessible payslip was found.');
        }

        return ['payslip' => $payslip];
    }

    public function downloadPayslip(int $payslipId, string $tenantId, array $actor): array
    {
        $payslip = $this->payslipRepository->findAccessibleById($payslipId, $tenantId, $actor);
        if ($payslip === null) {
            throw new NotFoundException('No accessible payslip was found.');
        }
        $office = $this->resolveOfficeBranding($tenantId, isset($payslip['office_id']) ? (int) $payslip['office_id'] : null);
        $employeeSlug = preg_replace('/[^a-zA-Z0-9_-]+/', '-', trim((string) ($payslip['employee_id'] ?? ('employee-' . $payslipId)))) ?: ('employee-' . $payslipId);
        $filename = sprintf(
            'worknest-payslip-%s-%04d-%02d.pdf',
            $employeeSlug,
            (int) ($payslip['period_year'] ?? date('Y')),
            (int) ($payslip['period_month'] ?? date('n'))
        );
        $content = $this->pdfGenerator->generateFromPayslip($payslip, $office);

        $this->payslipRepository->markDownloaded($payslipId);
        $this->auditLogger->log($tenantId, $payslip['office_id'] !== null ? (int) $payslip['office_id'] : null, (int) $actor['id'], 'payslip.downloaded', 'payslip', (string) $payslipId);

        return [
            'content' => $content,
            'filename' => $filename,
        ];
    }

    private function resolveOfficeBranding(string $tenantId, ?int $officeId): ?array
    {
        $office = $officeId !== null ? $this->officeRepository->findById($officeId, $tenantId) : null;
        if ($office === null) {
            return null;
        }

        $officeSettings = $this->decodeSettings($office['settings_json'] ?? null);
        if (($officeSettings['workspace_logo_path'] ?? null) !== null) {
            return $office;
        }

        $mainOffice = $this->officeRepository->findMainOffice($tenantId);
        if ($mainOffice === null) {
            return $office;
        }

        $mainSettings = $this->decodeSettings($mainOffice['settings_json'] ?? null);
        if (($mainSettings['workspace_logo_path'] ?? null) === null) {
            return $office;
        }

        $officeSettings['workspace_logo_path'] = $mainSettings['workspace_logo_path'];
        $officeSettings['workspace_logo_mime'] = $mainSettings['workspace_logo_mime'] ?? null;
        $office['settings_json'] = $officeSettings;

        return $office;
    }

    private function decodeSettings(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }
}
