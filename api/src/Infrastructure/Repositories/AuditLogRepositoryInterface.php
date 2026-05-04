<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface AuditLogRepositoryInterface
{
    public function create(
        string $tenantId,
        ?int $officeId,
        ?int $actorUserId,
        string $actorType,
        string $eventType,
        string $entityType,
        string $entityId,
        array $metadata = []
    ): int;
}
