<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoTenantRepository implements TenantRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function findByTenantId(string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM tenants WHERE tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute(['tenant_id' => $tenantId]);
        $tenant = $stmt->fetch(PDO::FETCH_ASSOC);

        return $tenant === false ? null : $tenant;
    }

    public function create(string $tenantId, string $name, ?string $legalName = null): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO tenants (tenant_id, name, legal_name, onboarding_status)
             VALUES (:tenant_id, :name, :legal_name, "main_office_pending")'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'name' => $name,
            'legal_name' => $legalName,
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function setPrimaryOwnerUserId(string $tenantId, int $userId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE tenants SET primary_owner_user_id = :user_id WHERE tenant_id = :tenant_id'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
        ]);
    }

    public function markActive(string $tenantId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE tenants SET status = "active", onboarding_status = "main_office_pending" WHERE tenant_id = :tenant_id'
        );
        $stmt->execute(['tenant_id' => $tenantId]);
    }
}
