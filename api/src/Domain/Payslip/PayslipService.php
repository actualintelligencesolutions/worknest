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
        $office = isset($payslip['office_id']) ? $this->officeRepository->findById((int) $payslip['office_id'], $tenantId) : null;
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
}
