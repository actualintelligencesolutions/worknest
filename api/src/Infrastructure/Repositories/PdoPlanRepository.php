<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoPlanRepository implements PlanRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function allActive(): array
    {
        $stmt = $this->connection->pdo()->query(
            'SELECT id, plan_code, name, description, price_cents, currency, employee_limit, monthly_payroll_limit, features_json, status
             FROM plans
             WHERE status = "active" AND deleted_at IS NULL
             ORDER BY price_cents ASC, id ASC'
        );

        return $stmt->fetchAll();
    }

    public function findActiveById(int $planId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT id, plan_code, name, description, price_cents, currency, employee_limit, monthly_payroll_limit, features_json, status
             FROM plans
             WHERE id = :id AND status = "active" AND deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute(['id' => $planId]);
        $plan = $stmt->fetch(PDO::FETCH_ASSOC);

        return $plan === false ? null : $plan;
    }
}
