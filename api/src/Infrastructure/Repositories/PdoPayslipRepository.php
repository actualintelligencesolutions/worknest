<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoPayslipRepository implements PayslipRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function createOrReplace(array $payload): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO payslips (
                tenant_id, office_id, payroll_record_id, user_id, period_year, period_month,
                file_path, file_format, generated_at, published_at, status
             ) VALUES (
                :tenant_id, :office_id, :payroll_record_id, :user_id, :period_year, :period_month,
                :file_path, :file_format, :generated_at, :published_at, :status
             )
             ON DUPLICATE KEY UPDATE
                file_path = VALUES(file_path),
                file_format = VALUES(file_format),
                generated_at = VALUES(generated_at),
                published_at = VALUES(published_at),
                status = VALUES(status)'
        );
        $stmt->execute($payload);

        $id = (int) $this->connection->pdo()->lastInsertId();
        if ($id > 0) {
            return $id;
        }

        $lookup = $this->connection->pdo()->prepare('SELECT id FROM payslips WHERE payroll_record_id = :payroll_record_id LIMIT 1');
        $lookup->execute(['payroll_record_id' => $payload['payroll_record_id']]);
        return (int) $lookup->fetchColumn();
    }

    public function listAccessible(string $tenantId, array $actor, array $filters = []): array
    {
        $sql = 'SELECT p.id, p.tenant_id, p.office_id, p.payroll_record_id, p.user_id, p.period_year, p.period_month,
                       p.file_path, p.file_format, p.generated_at, p.published_at, p.status,
                       pr.employee_id, pr.employee_name_snapshot, pr.designation_snapshot, pr.gross_pay, pr.total_deductions, pr.net_pay,
                       pr.earnings_json, pr.deductions_json, pr.currency
                FROM payslips p
                JOIN payroll_records pr ON pr.id = p.payroll_record_id
                WHERE p.tenant_id = :tenant_id';
        $bindings = ['tenant_id' => $tenantId];

        if (($actor['user_type'] ?? '') === 'employee') {
            $sql .= ' AND p.user_id = :user_id AND p.status IN ("published", "superseded")';
            $bindings['user_id'] = (int) $actor['id'];
        } elseif (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true)) {
            $officeIds = array_map('intval', $actor['office_ids'] ?? []);
            if ($officeIds === []) {
                return [];
            }
            $placeholders = implode(',', array_fill(0, count($officeIds), '?'));
            $sql = 'SELECT p.id, p.tenant_id, p.office_id, p.payroll_record_id, p.user_id, p.period_year, p.period_month,
                       p.file_path, p.file_format, p.generated_at, p.published_at, p.status,
                       pr.employee_id, pr.employee_name_snapshot, pr.designation_snapshot, pr.gross_pay, pr.total_deductions, pr.net_pay,
                       pr.earnings_json, pr.deductions_json, pr.currency
                FROM payslips p
                JOIN payroll_records pr ON pr.id = p.payroll_record_id
                WHERE p.tenant_id = ? AND p.office_id IN (' . $placeholders . ')';
            $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY p.period_year DESC, p.period_month DESC, p.published_at DESC, p.id DESC');
            $stmt->execute(array_merge([$tenantId], $officeIds));
            return $stmt->fetchAll();
        }

        $stmt = $this->connection->pdo()->prepare($sql . ' ORDER BY p.period_year DESC, p.period_month DESC, p.published_at DESC, p.id DESC');
        $stmt->execute($bindings);
        return $stmt->fetchAll();
    }

    public function findAccessibleById(int $payslipId, string $tenantId, array $actor): ?array
    {
        $sql = 'SELECT p.*, pr.employee_id, pr.employee_name_snapshot, pr.designation_snapshot, pr.gross_pay, pr.total_deductions, pr.net_pay,
                       pr.earnings_json, pr.deductions_json, pr.currency
                FROM payslips p
                JOIN payroll_records pr ON pr.id = p.payroll_record_id
                WHERE p.id = :id AND p.tenant_id = :tenant_id';
        $bindings = [
            'id' => $payslipId,
            'tenant_id' => $tenantId,
        ];

        if (($actor['user_type'] ?? '') === 'employee') {
            $sql .= ' AND p.user_id = :user_id';
            $bindings['user_id'] = (int) $actor['id'];
        } elseif (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true)) {
            $officeIds = array_map('intval', $actor['office_ids'] ?? []);
            if ($officeIds === []) {
                return null;
            }
            $placeholders = implode(',', array_fill(0, count($officeIds), '?'));
            $sql = 'SELECT p.*, pr.employee_id, pr.employee_name_snapshot, pr.designation_snapshot, pr.gross_pay, pr.total_deductions, pr.net_pay,
                       pr.earnings_json, pr.deductions_json, pr.currency
                FROM payslips p
                JOIN payroll_records pr ON pr.id = p.payroll_record_id
                WHERE p.id = ? AND p.tenant_id = ? AND p.office_id IN (' . $placeholders . ')';
            $stmt = $this->connection->pdo()->prepare($sql . ' LIMIT 1');
            $stmt->execute(array_merge([$payslipId, $tenantId], $officeIds));
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            return $row === false ? null : $row;
        }

        $stmt = $this->connection->pdo()->prepare($sql . ' LIMIT 1');
        $stmt->execute($bindings);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row === false ? null : $row;
    }

    public function markDownloaded(int $payslipId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payslips
             SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute(['id' => $payslipId]);
    }

    public function supersedePublishedForPeriod(string $tenantId, int $officeId, int $periodYear, int $periodMonth): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE payslips
             SET status = "superseded"
             WHERE tenant_id = :tenant_id
               AND office_id = :office_id
               AND period_year = :period_year
               AND period_month = :period_month
               AND status = "published"'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
            'period_year' => $periodYear,
            'period_month' => $periodMonth,
        ]);
    }
}
