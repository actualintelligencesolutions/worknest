<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Payslip;

use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Repositories\PayslipRepositoryInterface;
use Worknest\Api\Infrastructure\Storage\FileStorageService;

final class PayslipService
{
    public function __construct(
        private readonly PayslipRepositoryInterface $payslipRepository,
        private readonly FileStorageService $fileStorage,
        private readonly AuditLogger $auditLogger
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

        $this->payslipRepository->markDownloaded($payslipId);
        $this->auditLogger->log($tenantId, $payslip['office_id'] !== null ? (int) $payslip['office_id'] : null, (int) $actor['id'], 'payslip.downloaded', 'payslip', (string) $payslipId);

        return [
            'path' => $this->fileStorage->absolutePath((string) $payslip['file_path']),
            'filename' => 'worknest-payslip-' . $payslipId . '.pdf',
        ];
    }
}
