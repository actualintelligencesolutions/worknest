<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoPayrollRecordRepository implements PayrollRecordRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function replaceForBatch(int $batchId, string $tenantId, array $records): void
    {
        $pdo = $this->connection->pdo();
        $pdo->prepare('DELETE FROM payroll_records WHERE payroll_batch_id = :batch_id AND tenant_id = :tenant_id')
            ->execute([
                'batch_id' => $batchId,
                'tenant_id' => $tenantId,
            ]);

        $stmt = $pdo->prepare(
            'INSERT INTO payroll_records (
                tenant_id, office_id, payroll_batch_id, user_id, employee_id, employee_name_snapshot,
                designation_snapshot, days_paid, ot_hours, gross_pay, total_deductions, net_pay, earnings_json, deductions_json,
                currency, record_status, validation_errors_json
             ) VALUES (
                :tenant_id, :office_id, :payroll_batch_id, :user_id, :employee_id, :employee_name_snapshot,
                :designation_snapshot, :days_paid, :ot_hours, :gross_pay, :total_deductions, :net_pay, :earnings_json, :deductions_json,
                :currency, :record_status, :validation_errors_json
             )'
        );

        foreach ($records as $record) {
            $stmt->execute([
                'tenant_id' => $tenantId,
                'office_id' => $record['office_id'],
                'payroll_batch_id' => $batchId,
                'user_id' => $record['user_id'],
                'employee_id' => $record['employee_id'],
                'employee_name_snapshot' => $record['employee_name_snapshot'],
                'designation_snapshot' => $record['designation_snapshot'] ?? null,
                'days_paid' => $record['days_paid'] ?? null,
                'ot_hours' => $record['ot_hours'] ?? null,
                'gross_pay' => $record['gross_pay'],
                'total_deductions' => $record['total_deductions'],
                'net_pay' => $record['net_pay'],
                'earnings_json' => json_encode($record['earnings_json']),
                'deductions_json' => json_encode($record['deductions_json']),
                'currency' => $record['currency'] ?? 'INR',
                'record_status' => $record['record_status'],
                'validation_errors_json' => json_encode($record['validation_errors_json'] ?? []),
            ]);
        }
    }

    public function listByBatch(int $batchId, string $tenantId): array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM payroll_records WHERE payroll_batch_id = :batch_id AND tenant_id = :tenant_id ORDER BY id ASC'
        );
        $stmt->execute([
            'batch_id' => $batchId,
            'tenant_id' => $tenantId,
        ]);
        return $stmt->fetchAll();
    }

    public function markPublishedByBatch(int $batchId, string $tenantId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_records
             SET record_status = "published", updated_at = CURRENT_TIMESTAMP
             WHERE payroll_batch_id = :batch_id AND tenant_id = :tenant_id'
        );
        $stmt->execute([
            'batch_id' => $batchId,
            'tenant_id' => $tenantId,
        ]);
    }

    public function markValidByBatch(int $batchId, string $tenantId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payroll_records
             SET record_status = "valid", updated_at = CURRENT_TIMESTAMP
             WHERE payroll_batch_id = :batch_id AND tenant_id = :tenant_id'
        );
        $stmt->execute([
            'batch_id' => $batchId,
            'tenant_id' => $tenantId,
        ]);
    }
}
