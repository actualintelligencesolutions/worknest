<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface PayrollRecordRepositoryInterface
{
    public function replaceForBatch(int $batchId, string $tenantId, array $records): void;

    public function listByBatch(int $batchId, string $tenantId): array;

    public function markPublishedByBatch(int $batchId, string $tenantId): void;

    public function markValidByBatch(int $batchId, string $tenantId): void;
}
