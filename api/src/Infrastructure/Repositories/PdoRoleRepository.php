<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoRoleRepository implements RoleRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function findByKey(string $roleKey): ?array
    {
        $stmt = $this->connection->pdo()->prepare('SELECT * FROM roles WHERE role_key = :role_key AND status = "active" LIMIT 1');
        $stmt->execute(['role_key' => $roleKey]);
        $role = $stmt->fetch(PDO::FETCH_ASSOC);

        return $role === false ? null : $role;
    }

    public function assignRole(string $tenantId, int $userId, int $roleId, ?int $officeId, ?int $assignedByUserId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT IGNORE INTO user_roles (tenant_id, user_id, role_id, office_id, assigned_by_user_id)
             VALUES (:tenant_id, :user_id, :role_id, :office_id, :assigned_by_user_id)'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'role_id' => $roleId,
            'office_id' => $officeId,
            'assigned_by_user_id' => $assignedByUserId,
        ]);
    }

    public function listOfficeIdsForUser(string $tenantId, int $userId): array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT office_id FROM user_roles
             WHERE tenant_id = :tenant_id AND user_id = :user_id AND office_id IS NOT NULL'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
        ]);

        return array_map('intval', array_filter(array_column($stmt->fetchAll(), 'office_id')));
    }
}
