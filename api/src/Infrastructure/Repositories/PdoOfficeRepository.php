<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoOfficeRepository implements OfficeRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function listAccessible(string $tenantId, array $actor): array
    {
        $params = ['tenant_id' => $tenantId];
        $select = 'SELECT o.*,
                          p.id AS plan_id,
                          p.plan_code,
                          p.name AS plan_name,
                          p.price_cents,
                          p.currency,
                          p.employee_limit,
                          p.monthly_payroll_limit
                   FROM offices o
                   LEFT JOIN tenant_plans tp
                      ON tp.office_id = o.id
                     AND tp.tenant_id = o.tenant_id
                     AND tp.status = "active"
                   LEFT JOIN plans p
                      ON p.id = tp.plan_id';
        $sql = $select . '
            WHERE o.tenant_id = :tenant_id AND o.deleted_at IS NULL';

        if (($actor['user_type'] ?? '') === 'branch_admin') {
            $officeIds = array_map('intval', $actor['office_ids'] ?? []);
            if ($officeIds === []) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($officeIds), '?'));
            $sql = $select . '
            WHERE o.tenant_id = ? AND o.deleted_at IS NULL AND o.id IN (' . $placeholders . ')';
            $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY o.office_type ASC, o.name ASC');
            $stmt->execute(array_merge([$tenantId], $officeIds));
            return $stmt->fetchAll();
        }

        $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY o.office_type ASC, o.name ASC');
        $stmt->execute($params);
        return $stmt->fetchAll();
    }

    public function findById(int $officeId, string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT o.*,
                    tp.id AS tenant_plan_id,
                    tp.status AS tenant_plan_status,
                    tp.starts_on,
                    tp.ends_on,
                    p.id AS plan_id,
                    p.plan_code,
                    p.name AS plan_name,
                    p.price_cents,
                    p.currency
             FROM offices o
             LEFT JOIN tenant_plans tp
                ON tp.office_id = o.id
               AND tp.tenant_id = o.tenant_id
               AND tp.status = "active"
             LEFT JOIN plans p
                ON p.id = tp.plan_id
             WHERE o.id = :id AND o.tenant_id = :tenant_id AND o.deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute([
            'id' => $officeId,
            'tenant_id' => $tenantId,
        ]);
        $office = $stmt->fetch(PDO::FETCH_ASSOC);

        return $office === false ? null : $office;
    }

    public function findMainOffice(string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM offices
             WHERE tenant_id = :tenant_id
               AND office_type = "main_office"
               AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute(['tenant_id' => $tenantId]);
        $office = $stmt->fetch(PDO::FETCH_ASSOC);

        return $office === false ? null : $office;
    }

    public function create(array $payload): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO offices (
                tenant_id, office_code, name, office_type, parent_office_id, status,
                contact_email, contact_phone, address_line_1, address_line_2,
                city, state, postal_code, country, timezone, payroll_day, settings_json
             ) VALUES (
                :tenant_id, :office_code, :name, :office_type, :parent_office_id, :status,
                :contact_email, :contact_phone, :address_line_1, :address_line_2,
                :city, :state, :postal_code, :country, :timezone, :payroll_day, :settings_json
             )'
        );
        $stmt->execute([
            'tenant_id' => $payload['tenant_id'],
            'office_code' => $payload['office_code'],
            'name' => $payload['name'],
            'office_type' => $payload['office_type'],
            'parent_office_id' => $payload['parent_office_id'],
            'status' => $payload['status'] ?? 'pending_setup',
            'contact_email' => $payload['contact_email'] ?? null,
            'contact_phone' => $payload['contact_phone'] ?? null,
            'address_line_1' => $payload['address_line_1'] ?? null,
            'address_line_2' => $payload['address_line_2'] ?? null,
            'city' => $payload['city'] ?? null,
            'state' => $payload['state'] ?? null,
            'postal_code' => $payload['postal_code'] ?? null,
            'country' => $payload['country'] ?? null,
            'timezone' => $payload['timezone'] ?? null,
            'payroll_day' => $payload['payroll_day'] ?? null,
            'settings_json' => isset($payload['settings_json']) ? json_encode($payload['settings_json']) : null,
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function update(int $officeId, string $tenantId, array $payload): ?array
    {
        $allowed = [
            'name',
            'status',
            'contact_email',
            'contact_phone',
            'address_line_1',
            'address_line_2',
            'city',
            'state',
            'postal_code',
            'country',
            'timezone',
            'payroll_day',
            'settings_json',
        ];

        $sets = [];
        $bindings = [
            'id' => $officeId,
            'tenant_id' => $tenantId,
        ];

        foreach ($allowed as $column) {
            if (!array_key_exists($column, $payload)) {
                continue;
            }

            $sets[] = $column . ' = :' . $column;
            $bindings[$column] = $column === 'settings_json'
                ? json_encode($payload[$column])
                : $payload[$column];
        }

        if ($sets === []) {
            return $this->findById($officeId, $tenantId);
        }

        $stmt = $this->connection->pdo()->prepare(
            'UPDATE offices SET ' . implode(', ', $sets) . ', updated_at = CURRENT_TIMESTAMP WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute($bindings);

        return $this->findById($officeId, $tenantId);
    }

    public function listPlanAssignments(int $officeId, string $tenantId): array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT tp.*, p.plan_code, p.name AS plan_name, p.price_cents, p.currency,
                    p.employee_limit, p.monthly_payroll_limit
             FROM tenant_plans tp
             JOIN plans p ON p.id = tp.plan_id
             WHERE tp.office_id = :office_id AND tp.tenant_id = :tenant_id
             ORDER BY tp.starts_on DESC, tp.id DESC'
        );
        $stmt->execute([
            'office_id' => $officeId,
            'tenant_id' => $tenantId,
        ]);

        return $stmt->fetchAll();
    }
}
