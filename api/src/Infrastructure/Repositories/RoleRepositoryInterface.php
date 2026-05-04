<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface RoleRepositoryInterface
{
    public function findByKey(string $roleKey): ?array;

    public function assignRole(string $tenantId, int $userId, int $roleId, ?int $officeId, ?int $assignedByUserId): void;

    public function listOfficeIdsForUser(string $tenantId, int $userId): array;
}
