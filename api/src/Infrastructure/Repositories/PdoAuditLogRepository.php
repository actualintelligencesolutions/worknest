<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoAuditLogRepository implements AuditLogRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(
        string $tenantId,
        ?int $officeId,
        ?int $actorUserId,
        string $actorType,
        string $eventType,
        string $entityType,
        string $entityId,
        array $metadata = []
    ): int {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO audit_logs (
                tenant_id, office_id, actor_user_id, actor_type, event_type, entity_type, entity_id, metadata_json
             ) VALUES (
                :tenant_id, :office_id, :actor_user_id, :actor_type, :event_type, :entity_type, :entity_id, :metadata_json
             )'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
            'actor_user_id' => $actorUserId,
            'actor_type' => $actorType,
            'event_type' => $eventType,
            'entity_type' => $entityType,
            'entity_id' => $entityId,
            'metadata_json' => json_encode($metadata),
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }
}
