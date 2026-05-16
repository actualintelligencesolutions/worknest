<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface TenantRepositoryInterface
{
    public function findByTenantId(string $tenantId): ?array;

    public function create(string $tenantId, string $name, ?string $legalName = null): int;

    public function setPrimaryOwnerUserId(string $tenantId, int $userId): void;

    public function markActive(string $tenantId): void;

    public function update(string $tenantId, array $payload): ?array;

    public function setOnboardingStatus(string $tenantId, string $status): void;
}
