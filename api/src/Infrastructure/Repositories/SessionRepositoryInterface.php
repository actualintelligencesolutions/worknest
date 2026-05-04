<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface SessionRepositoryInterface
{
    public function create(string $tenantId, int $userId, string $sessionType, string $rawToken, string $expiresAt): int;

    public function findActiveByToken(string $rawToken): ?array;

    public function revokeByToken(string $rawToken): void;
}
