<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface PayslipRepositoryInterface
{
    public function createOrReplace(array $payload): int;

    public function listAccessible(string $tenantId, array $actor, array $filters = []): array;

    public function findAccessibleById(int $payslipId, string $tenantId, array $actor): ?array;

    public function markDownloaded(int $payslipId): void;
}
