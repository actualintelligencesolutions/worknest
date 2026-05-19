<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface PayrollBatchRepositoryInterface
{
    public function create(array $payload): int;

    public function findById(int $batchId, string $tenantId): ?array;

    public function findActiveByOfficeAndPeriod(string $tenantId, int $officeId, int $periodYear, int $periodMonth): ?array;

    public function updateMapping(int $batchId, string $tenantId, array $mapping): void;

    public function updateValidation(int $batchId, string $tenantId, string $status, array $summary): void;

    public function markConfirmed(int $batchId, string $tenantId, int $confirmedByUserId): void;

    public function markPublished(int $batchId, string $tenantId, int $publishedByUserId): void;

    public function hardDelete(int $batchId, string $tenantId): void;

    public function listByTenant(string $tenantId, array $actor, array $filters = []): array;

    public function countByOfficeAndPeriod(string $tenantId, int $officeId, int $periodYear, int $periodMonth): int;
}
