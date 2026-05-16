<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoUserRepository implements UserRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(array $payload): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO users (
                tenant_id, office_id, employee_id, first_name, last_name, display_name,
                email, phone, password_hash, pin_hash, user_type, status
             ) VALUES (
                :tenant_id, :office_id, :employee_id, :first_name, :last_name, :display_name,
                :email, :phone, :password_hash, :pin_hash, :user_type, :status
             )'
        );
        $stmt->execute([
            'tenant_id' => $payload['tenant_id'],
            'office_id' => $payload['office_id'] ?? null,
            'employee_id' => $payload['employee_id'] ?? null,
            'first_name' => $payload['first_name'],
            'last_name' => $payload['last_name'] ?? null,
            'display_name' => $payload['display_name'],
            'email' => $payload['email'] ?? null,
            'phone' => $payload['phone'] ?? null,
            'password_hash' => $payload['password_hash'] ?? null,
            'pin_hash' => $payload['pin_hash'] ?? null,
            'user_type' => $payload['user_type'],
            'status' => $payload['status'] ?? 'pending_verification',
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function findById(int $userId, string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM users WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute(['id' => $userId, 'tenant_id' => $tenantId]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    public function findActiveByEmail(string $tenantId, string $email, ?string $userType = null): ?array
    {
        $sql = 'SELECT * FROM users WHERE tenant_id = :tenant_id AND email = :email AND status = "active" AND deleted_at IS NULL';
        $bindings = [
            'tenant_id' => $tenantId,
            'email' => $email,
        ];
        if ($userType !== null) {
            $sql .= ' AND user_type = :user_type';
            $bindings['user_type'] = $userType;
        }
        $sql .= ' LIMIT 1';

        $stmt = $this->connection->pdo()->prepare($sql);
        $stmt->execute($bindings);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    public function findActiveEmployeeByEmployeeId(string $tenantId, string $employeeId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM users
             WHERE tenant_id = :tenant_id
               AND employee_id = :employee_id
               AND user_type = "employee"
               AND status = "active"
               AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
        ]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    public function findActiveEmployeeByIdentifier(string $tenantId, string $identifier): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM users
             WHERE tenant_id = :tenant_id
               AND user_type = "employee"
               AND status = "active"
               AND deleted_at IS NULL
               AND (email = :identifier OR phone = :identifier)
             LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'identifier' => $identifier,
        ]);
        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user === false ? null : $user;
    }

    public function listAccessible(string $tenantId, array $actor, array $filters = []): array
    {
        $bindings = ['tenant_id' => $tenantId];
        $sql = 'SELECT id, tenant_id, office_id, employee_id, first_name, last_name, display_name, email, phone, user_type, status, created_at
                FROM users
                WHERE tenant_id = :tenant_id AND deleted_at IS NULL';

        if (($actor['user_type'] ?? '') === 'branch_admin') {
            $officeIds = array_map('intval', $actor['office_ids'] ?? []);
            if ($officeIds === []) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($officeIds), '?'));
            $sql = 'SELECT id, tenant_id, office_id, employee_id, first_name, last_name, display_name, email, phone, user_type, status, created_at
                FROM users
                WHERE tenant_id = ? AND deleted_at IS NULL AND office_id IN (' . $placeholders . ')';
            $params = array_merge([$tenantId], $officeIds);
            if (!empty($filters['office_id'])) {
                $sql .= ' AND office_id = ?';
                $params[] = (int) $filters['office_id'];
            }
            if (!empty($filters['user_type'])) {
                $sql .= ' AND user_type = ?';
                $params[] = (string) $filters['user_type'];
            }
            $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY display_name ASC');
            $stmt->execute($params);
            return $stmt->fetchAll();
        }

        if (!empty($filters['office_id'])) {
            $sql .= ' AND office_id = :office_id';
            $bindings['office_id'] = (int) $filters['office_id'];
        }
        if (!empty($filters['user_type'])) {
            $sql .= ' AND user_type = :user_type';
            $bindings['user_type'] = (string) $filters['user_type'];
        }

        $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY display_name ASC');
        $stmt->execute($bindings);
        return $stmt->fetchAll();
    }

    public function update(int $userId, string $tenantId, array $payload): ?array
    {
        $allowed = [
            'office_id',
            'employee_id',
            'first_name',
            'last_name',
            'display_name',
            'email',
            'phone',
            'pin_hash',
            'password_hash',
            'status',
        ];

        $sets = [];
        $bindings = [
            'id' => $userId,
            'tenant_id' => $tenantId,
        ];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $payload)) {
                continue;
            }
            $sets[] = $column . ' = :' . $column;
            $bindings[$column] = $payload[$column];
        }

        if ($sets === []) {
            return $this->findById($userId, $tenantId);
        }

        $stmt = $this->connection->pdo()->prepare(
            'UPDATE users SET ' . implode(', ', $sets) . ', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute($bindings);

        return $this->findById($userId, $tenantId);
    }

    public function markVerified(int $userId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE users
             SET status = "active", email_verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute(['id' => $userId]);
    }

    public function updateLastLoginAt(int $userId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = :id'
        );
        $stmt->execute(['id' => $userId]);
    }

    public function emailExists(string $tenantId, string $email): bool
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT id FROM users WHERE tenant_id = :tenant_id AND email = :email AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'email' => $email,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function employeeIdExists(string $tenantId, string $employeeId): bool
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT id FROM users WHERE tenant_id = :tenant_id AND employee_id = :employee_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'employee_id' => $employeeId,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function phoneExists(string $tenantId, string $phone): bool
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT id FROM users WHERE tenant_id = :tenant_id AND phone = :phone AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'phone' => $phone,
        ]);

        return $stmt->fetchColumn() !== false;
    }

    public function countActiveEmployeesByOffice(string $tenantId, int $officeId): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT COUNT(*) FROM users
             WHERE tenant_id = :tenant_id
               AND office_id = :office_id
               AND user_type = "employee"
               AND status = "active"
               AND deleted_at IS NULL'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
        ]);

        return (int) $stmt->fetchColumn();
    }
}
