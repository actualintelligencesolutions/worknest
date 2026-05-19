<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface SiteOwnerInviteRepositoryInterface
{
    public function create(array $payload): int;

    public function findById(int $id, string $tenantId): ?array;

    public function findLatestPendingByOffice(string $tenantId, int $officeId): ?array;

    public function findPendingByTokenHash(string $tokenHash): ?array;

    public function listByOffice(string $tenantId, int $officeId): array;

    public function markAccepted(int $inviteId, int $acceptedByUserId): void;

    public function updateStatus(int $inviteId, string $status): void;
}
