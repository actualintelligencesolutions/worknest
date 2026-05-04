<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoPayrollBatchRepository implements PayrollBatchRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(array $payload): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO payroll_batches (
                tenant_id, office_id, period_year, period_month, source_file_name, source_file_path,
                source_file_hash, upload_status, uploaded_by_user_id
             ) VALUES (
                :tenant_id, :office_id, :period_year, :period_month, :source_file_name, :source_file_path,
                :source_file_hash, :upload_status, :uploaded_by_user_id
             )'
        );
        $stmt->execute($payload);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function findById(int $batchId, string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM payroll_batches WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1'
        );
        $stmt->execute([
            'id' => $batchId,
            'tenant_id' => $tenantId,
        ]);
        $batch = $stmt->fetch(PDO::FETCH_ASSOC);

        return $batch === false ? null : $batch;
    }

    public function updateMapping(int $batchId, string $tenantId, array $mapping): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_batches
             SET mapping_json = :mapping_json, upload_status = "mapped", updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute([
            'id' => $batchId,
            'tenant_id' => $tenantId,
            'mapping_json' => json_encode($mapping),
        ]);
    }

    public function updateValidation(int $batchId, string $tenantId, string $status, array $summary): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_batches
             SET upload_status = :status, validation_summary_json = :summary, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute([
            'id' => $batchId,
            'tenant_id' => $tenantId,
            'status' => $status,
            'summary' => json_encode($summary),
        ]);
    }

    public function markConfirmed(int $batchId, string $tenantId, int $confirmedByUserId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_batches
             SET upload_status = "confirmed", confirmed_by_user_id = :confirmed_by_user_id,
                 confirmed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute([
            'id' => $batchId,
            'tenant_id' => $tenantId,
            'confirmed_by_user_id' => $confirmedByUserId,
        ]);
    }

    public function markPublished(int $batchId, string $tenantId, int $publishedByUserId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_batches
             SET upload_status = "published", published_by_user_id = :published_by_user_id,
                 published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute([
            'id' => $batchId,
            'tenant_id' => $tenantId,
            'published_by_user_id' => $publishedByUserId,
        ]);
    }

    public function listByTenant(string $tenantId, array $actor, array $filters = []): array
    {
        $bindings = ['tenant_id' => $tenantId];
        $sql = 'SELECT pb.* FROM payroll_batches pb WHERE pb.tenant_id = :tenant_id AND pb.deleted_at IS NULL';

        if (($actor['user_type'] ?? '') === 'branch_admin') {
            $officeIds = array_map('intval', $actor['office_ids'] ?? []);
            if ($officeIds === []) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($officeIds), '?'));
            $sql = 'SELECT pb.* FROM payroll_batches pb WHERE pb.tenant_id = ? AND pb.deleted_at IS NULL AND pb.office_id IN (' . $placeholders . ')';
            $params = array_merge([$tenantId], $officeIds);
            if (!empty($filters['office_id'])) {
                $sql .= ' AND pb.office_id = ?';
                $params[] = (int) $filters['office_id'];
            }
            $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY pb.period_year DESC, pb.period_month DESC, pb.id DESC');
            $stmt->execute($params);
            return $stmt->fetchAll();
        }

        if (!empty($filters['office_id'])) {
            $sql .= ' AND pb.office_id = :office_id';
            $bindings['office_id'] = (int) $filters['office_id'];
        }

        $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY pb.period_year DESC, pb.period_month DESC, pb.id DESC');
        $stmt->execute($bindings);
        return $stmt->fetchAll();
    }
}
