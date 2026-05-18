<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Office;

use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PlanRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollBatchRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\TenantRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PasswordHasher;

final class OfficeService
{
    public function __construct(
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly PlanRepositoryInterface $planRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly PayrollBatchRepositoryInterface $payrollBatchRepository,
        private readonly TenantRepositoryInterface $tenantRepository,
        private readonly RoleRepositoryInterface $roleRepository,
        private readonly PasswordHasher $passwordHasher,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger
    ) {
    }

    public function listOffices(string $tenantId, array $actor): array
    {
        $offices = $this->officeRepository->listAccessible($tenantId, $actor);
        $mainOffices = 0;
        $branches = 0;
        foreach ($offices as $office) {
            if (($office['office_type'] ?? '') === 'main_office') {
                $mainOffices++;
            }
            if (($office['office_type'] ?? '') === 'branch') {
                $branches++;
            }
        }

        $offices = array_map(fn (array $office): array => array_merge($office, [
            'usage_summary' => $this->usageSummary($tenantId, $office),
        ]), $offices);

        return [
            'offices' => $offices,
            'locations' => $offices,
            'summary' => [
                'main_offices' => $mainOffices,
                'branches' => $branches,
                'total' => count($offices),
            ],
        ];
    }

    public function getOffice(int $officeId, string $tenantId, array $actor): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $this->assertOfficeAccess($officeId, $actor);

        return [
            'office' => $office,
            'location' => $office,
            'plan' => [
                'id' => $office['plan_id'] ?? null,
                'plan_code' => $office['plan_code'] ?? null,
                'name' => $office['plan_name'] ?? null,
                'price_cents' => $office['price_cents'] ?? null,
                'currency' => $office['currency'] ?? null,
            ],
            'usage_summary' => $this->usageSummary($tenantId, $office),
            'plan_assignments' => $this->officeRepository->listPlanAssignments((int) $office['id'], $tenantId),
            'admin' => $this->primaryAdminForOffice($tenantId, (int) $office['id'], $actor),
        ];
    }

    public function getSitePortal(string $tenantId, string $officeCode): array
    {
        $office = $this->officeRepository->findByCode($tenantId, $officeCode);
        if ($office === null) {
            throw new NotFoundException('Site portal not found.');
        }

        return [
            'site' => [
                'id' => (int) $office['id'],
                'tenant_id' => $office['tenant_id'],
                'office_code' => $office['office_code'],
                'name' => $office['name'],
                'office_type' => $office['office_type'],
                'status' => $office['status'],
                'city' => $office['city'] ?? null,
                'state' => $office['state'] ?? null,
            ],
        ];
    }

    public function createMainOffice(string $tenantId, array $actor, array $payload): array
    {
        if ($this->officeRepository->findMainOffice($tenantId) !== null) {
            throw new ApiException('MAIN_OFFICE_EXISTS', 'Main office already exists for this tenant.', 409);
        }

        return $this->createOffice($tenantId, $actor, array_merge($payload, [
            'office_type' => 'main_office',
            'name' => trim((string) ($payload['name'] ?? 'Main Office')) ?: 'Main Office',
        ]));
    }

    public function createBranch(string $tenantId, array $actor, array $payload): array
    {
        return $this->createOffice($tenantId, $actor, array_merge($payload, [
            'office_type' => 'branch',
        ]));
    }

    public function updateOffice(int $officeId, string $tenantId, array $actor, array $payload): array
    {
        $this->assertOfficeAccess($officeId, $actor);
        $office = $this->officeRepository->update($officeId, $tenantId, $payload);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.updated', 'office', (string) $officeId, $payload);

        return ['office' => $office];
    }

    public function assignPlan(int $officeId, string $tenantId, array $actor, int $planId, ?string $startsOn = null): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }
        $this->assertOfficeAccess($officeId, $actor);

        $plan = $this->planRepository->findActiveById($planId);
        if ($plan === null) {
            throw new ValidationException('Choose an active plan.');
        }

        $this->transactions->run(function ($pdo) use ($tenantId, $officeId, $actor, $planId, $startsOn): void {
            $pdo->prepare(
                'UPDATE tenant_plans SET status = "expired", ends_on = CURDATE()
                 WHERE tenant_id = :tenant_id AND office_id = :office_id AND status = "active"'
            )->execute([
                'tenant_id' => $tenantId,
                'office_id' => $officeId,
            ]);

            $pdo->prepare(
                'INSERT INTO tenant_plans (tenant_id, office_id, plan_id, status, starts_on, assigned_by_user_id)
                 VALUES (:tenant_id, :office_id, :plan_id, "active", :starts_on, :assigned_by_user_id)'
            )->execute([
                'tenant_id' => $tenantId,
                'office_id' => $officeId,
                'plan_id' => $planId,
                'starts_on' => $startsOn ?: date('Y-m-d'),
                'assigned_by_user_id' => (int) $actor['id'],
            ]);
        });

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.plan_assigned', 'office', (string) $officeId, ['plan_id' => $planId]);

        return [
            'office' => $this->officeRepository->findById($officeId, $tenantId),
            'plan' => $plan,
        ];
    }

    public function assignAdmins(int $officeId, string $tenantId, array $actor, array $userIds): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }
        $this->assertOfficeAccess($officeId, $actor);

        $branchAdminRole = $this->roleRepository->findByKey('branch_admin');
        if ($branchAdminRole === null) {
            throw new ApiException('ROLE_MISSING', 'Branch admin role is not configured.', 500);
        }

        foreach ($userIds as $userId) {
            $user = $this->userRepository->findById((int) $userId, $tenantId);
            if ($user === null || $user['user_type'] !== 'branch_admin') {
                throw new ValidationException('Only branch admin users can be assigned to offices.');
            }
            $this->roleRepository->assignRole($tenantId, (int) $userId, (int) $branchAdminRole['id'], $officeId, (int) $actor['id']);
        }

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.admins_assigned', 'office', (string) $officeId, ['user_ids' => array_values($userIds)]);

        return [
            'office' => $this->officeRepository->findById($officeId, $tenantId),
            'assigned_user_ids' => array_values($userIds),
        ];
    }

    public function listPlanAssignments(int $officeId, string $tenantId, array $actor): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $this->assertOfficeAccess($officeId, $actor);

        return [
            'office' => $office,
            'plan_assignments' => $this->officeRepository->listPlanAssignments($officeId, $tenantId),
            'usage_summary' => $this->usageSummary($tenantId, $office),
        ];
    }

    private function createOffice(string $tenantId, array $actor, array $payload): array
    {
        $name = trim((string) ($payload['name'] ?? $payload['branch_name'] ?? ''));
        $planId = (int) ($payload['plan_id'] ?? 0);

        if ($name === '' || $planId <= 0) {
            throw new ValidationException('Office name and active plan are required.');
        }

        $plan = $this->planRepository->findActiveById($planId);
        if ($plan === null) {
            throw new ValidationException('Choose an active plan.');
        }

        $mainOffice = $this->officeRepository->findMainOffice($tenantId);
        $parentOfficeId = ($payload['office_type'] ?? '') === 'branch' ? ($mainOffice['id'] ?? null) : null;

        $created = $this->transactions->run(function ($pdo) use ($tenantId, $actor, $payload, $name, $parentOfficeId, $planId) {
            $officeCode = trim((string) ($payload['office_code'] ?? $this->defaultOfficeCode($name, (string) $payload['office_type'])));
            $officeId = $this->officeRepository->create([
                'tenant_id' => $tenantId,
                'office_code' => $officeCode,
                'name' => $name,
                'office_type' => $payload['office_type'],
                'parent_office_id' => $parentOfficeId,
                'status' => 'active',
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
                'settings_json' => $payload['settings'] ?? [],
            ]);

            $pdo->prepare(
                'INSERT INTO tenant_plans (tenant_id, office_id, plan_id, status, starts_on, assigned_by_user_id)
                 VALUES (:tenant_id, :office_id, :plan_id, "active", CURDATE(), :assigned_by_user_id)'
            )->execute([
                'tenant_id' => $tenantId,
                'office_id' => $officeId,
                'plan_id' => $planId,
                'assigned_by_user_id' => (int) $actor['id'],
            ]);

            $admin = null;
            $adminName = trim((string) ($payload['admin_name'] ?? ''));
            $adminEmail = strtolower(trim((string) ($payload['admin_email'] ?? '')));
            $adminPhone = trim((string) ($payload['admin_phone'] ?? ''));
            if ($adminName !== '' && filter_var($adminEmail, FILTER_VALIDATE_EMAIL)) {
                $role = $this->roleRepository->findByKey('branch_admin');
                $nameParts = $this->splitName($adminName);
                $adminUserId = $this->userRepository->create([
                    'tenant_id' => $tenantId,
                    'office_id' => $officeId,
                    'first_name' => $nameParts['first_name'],
                    'last_name' => $nameParts['last_name'],
                    'display_name' => $adminName,
                    'email' => $adminEmail,
                    'phone' => $adminPhone !== '' ? $adminPhone : null,
                    'password_hash' => $this->passwordHasher->hash(bin2hex(random_bytes(16))),
                    'user_type' => 'branch_admin',
                    'status' => 'pending_verification',
                ]);
                if ($role !== null) {
                    $this->roleRepository->assignRole($tenantId, $adminUserId, (int) $role['id'], $officeId, (int) $actor['id']);
                }
                $admin = [
                    'id' => $adminUserId,
                    'name' => $adminName,
                    'email' => $adminEmail,
                    'phone' => $adminPhone !== '' ? $adminPhone : null,
                    'role' => 'branch_admin',
                    'status' => 'pending_verification',
                ];
            }

            return [
                'office_id' => $officeId,
                'admin' => $admin,
            ];
        });

        $officeId = (int) $created['office_id'];
        if (($payload['office_type'] ?? '') === 'main_office') {
            $this->tenantRepository->setOnboardingStatus($tenantId, 'branch_setup_pending');
        }
        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.created', 'office', (string) $officeId, ['name' => $name, 'office_type' => $payload['office_type']]);

        return [
            'office' => $this->officeRepository->findById($officeId, $tenantId),
            'location' => $this->officeRepository->findById($officeId, $tenantId),
            'plan' => $plan,
            'admin' => $created['admin'],
        ];
    }

    private function assertOfficeAccess(int $officeId, array $actor): void
    {
        if (($actor['user_type'] ?? '') === 'branch_admin' && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
            throw new ForbiddenException();
        }
    }

    private function defaultOfficeCode(string $name, string $officeType): string
    {
        $slug = strtoupper(preg_replace('/[^A-Za-z0-9]+/', '', $name) ?? 'OFFICE');
        $slug = substr($slug, 0, 8);
        return ($officeType === 'main_office' ? 'MAIN' : 'BR') . ($slug !== '' ? '-' . $slug : '');
    }

    private function splitName(string $displayName): array
    {
        $parts = preg_split('/\s+/', trim($displayName)) ?: [];
        return [
            'first_name' => $parts[0] ?? $displayName,
            'last_name' => count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : null,
        ];
    }

    private function primaryAdminForOffice(string $tenantId, int $officeId, array $actor): ?array
    {
        $admins = $this->userRepository->listAccessible($tenantId, [
            'user_type' => 'tenant_owner',
        ], [
            'office_id' => $officeId,
            'user_type' => 'branch_admin',
        ]);

        if ($admins === []) {
            return null;
        }

        $admin = $admins[0];

        return [
            'id' => (int) $admin['id'],
            'name' => $admin['display_name'],
            'email' => $admin['email'],
            'status' => $admin['status'],
        ];
    }

    private function usageSummary(string $tenantId, array $office): array
    {
        $officeId = (int) $office['id'];
        $employeeCount = $this->userRepository->countActiveEmployeesByOffice($tenantId, $officeId);
        $periodYear = (int) date('Y');
        $periodMonth = (int) date('n');
        $payrollBatchCount = $this->payrollBatchRepository->countByOfficeAndPeriod($tenantId, $officeId, $periodYear, $periodMonth);
        $employeeLimit = isset($office['employee_limit']) ? (int) $office['employee_limit'] : null;
        $monthlyPayrollLimit = isset($office['monthly_payroll_limit']) ? (int) $office['monthly_payroll_limit'] : null;

        return [
            'employee_count' => $employeeCount,
            'employee_limit' => $employeeLimit,
            'employee_limit_reached' => $employeeLimit !== null && $employeeLimit > 0 ? $employeeCount >= $employeeLimit : false,
            'monthly_payroll_count' => $payrollBatchCount,
            'monthly_payroll_limit' => $monthlyPayrollLimit,
            'monthly_payroll_limit_reached' => $monthlyPayrollLimit !== null && $monthlyPayrollLimit > 0
                ? $payrollBatchCount >= $monthlyPayrollLimit
                : false,
            'period_year' => $periodYear,
            'period_month' => $periodMonth,
        ];
    }
}
