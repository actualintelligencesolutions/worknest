<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Audit;

use Worknest\Api\Infrastructure\Repositories\AuditLogRepositoryInterface;

final class AuditLogger
{
    public function __construct(private readonly AuditLogRepositoryInterface $auditLogRepository)
    {
    }

    public function log(
        string $tenantId,
        ?int $officeId,
        ?int $actorUserId,
        string $eventType,
        string $entityType,
        string $entityId,
        array $metadata = []
    ): void {
        $this->auditLogRepository->create(
            $tenantId,
            $officeId,
            $actorUserId,
            'user',
            $eventType,
            $entityType,
            $entityId,
            $metadata
        );
    }
}
