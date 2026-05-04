<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface OfficeRepositoryInterface
{
    public function listAccessible(string $tenantId, array $actor): array;

    public function findById(int $officeId, string $tenantId): ?array;

    public function findMainOffice(string $tenantId): ?array;

    public function create(array $payload): int;

    public function update(int $officeId, string $tenantId, array $payload): ?array;
}
