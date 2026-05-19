<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface UserRepositoryInterface
{
    public function create(array $payload): int;

    public function findById(int $userId, string $tenantId): ?array;

    public function findByEmail(string $tenantId, string $email): ?array;

    public function findActiveByEmail(string $tenantId, string $email, ?string $userType = null): ?array;

    public function findActiveEmployeeByEmployeeId(string $tenantId, string $employeeId): ?array;

    public function findActiveEmployeeByPhone(string $tenantId, string $phone): ?array;

    public function findEmployeeByEmployeeId(string $tenantId, string $employeeId): ?array;

    public function findByPhone(string $tenantId, string $phone): ?array;

    public function listAccessible(string $tenantId, array $actor, array $filters = []): array;

    public function update(int $userId, string $tenantId, array $payload): ?array;

    public function markVerified(int $userId): void;

    public function updateLastLoginAt(int $userId): void;

    public function emailExists(string $tenantId, string $email): bool;

    public function phoneExists(string $tenantId, string $phone): bool;

    public function employeeIdExists(string $tenantId, string $employeeId): bool;

    public function countActiveEmployeesByOffice(string $tenantId, int $officeId): int;

    public function findActiveEmployeeByOfficeAndId(string $tenantId, int $officeId, string $employeeId): ?array;
}
