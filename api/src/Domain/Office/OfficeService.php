<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Office;

use Throwable;
use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Domain\Auth\SessionService;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Notifications\Mailer;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PlanRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\PayrollBatchRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\SiteOwnerInviteRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\TenantRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PasswordHasher;
use Worknest\Api\Infrastructure\Storage\FileStorageService;

final class OfficeService
{
    public function __construct(
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly PlanRepositoryInterface $planRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly PayrollBatchRepositoryInterface $payrollBatchRepository,
        private readonly SiteOwnerInviteRepositoryInterface $siteOwnerInviteRepository,
        private readonly TenantRepositoryInterface $tenantRepository,
        private readonly RoleRepositoryInterface $roleRepository,
        private readonly PasswordHasher $passwordHasher,
        private readonly FileStorageService $fileStorage,
        private readonly Mailer $mailer,
        private readonly SessionService $sessionService,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger,
        private readonly array $config
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
            'site_owner' => $this->currentSiteOwner($tenantId, $office),
            'pending_site_owner_invite' => $this->pendingSiteOwnerInvite($tenantId, (int) $office['id']),
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

    public function inviteSiteOwner(int $officeId, string $tenantId, array $actor, array $payload): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        if (($office['office_type'] ?? '') !== 'branch') {
            throw new ValidationException('Site owners can only be assigned to branch offices.');
        }

        $this->assertOfficeAccess($officeId, $actor);

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        $displayName = trim((string) ($payload['name'] ?? ''));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            throw new ValidationException('A valid site owner email is required.');
        }

        $existingUser = $this->userRepository->findByEmail($tenantId, $email);
        if ($existingUser !== null && ($existingUser['user_type'] ?? '') === 'employee') {
            throw new ValidationException('Employee accounts cannot be reassigned as site owners.');
        }

        $tenant = $this->tenantRepository->findByTenantId($tenantId);
        if ($tenant === null) {
            throw new NotFoundException('Workspace not found.');
        }

        if ($existingUser !== null) {
            $userId = (int) $existingUser['id'];
            if (($existingUser['user_type'] ?? '') !== 'tenant_owner') {
                $this->userRepository->update($userId, $tenantId, [
                    'office_id' => $officeId,
                    'user_type' => 'site_owner',
                    'status' => 'active',
                ]);
            }

            $siteOwnerRole = $this->roleRepository->findByKey('site_owner');
            if ($siteOwnerRole === null) {
                throw new ApiException('ROLE_MISSING', 'Site owner role is not configured.', 500);
            }

            $this->roleRepository->assignRole($tenantId, $userId, (int) $siteOwnerRole['id'], $officeId, (int) $actor['id']);

            $settings = $this->officeSettings($office);
            $settings['active_site_owner_user_id'] = $userId;
            $settings['active_site_owner_name'] = $existingUser['display_name'];
            $settings['active_site_owner_email'] = $existingUser['email'];
            $settings['active_site_owner_assigned_at'] = gmdate(DATE_ATOM);
            unset($settings['pending_site_owner_invite_id'], $settings['pending_site_owner_invited_email'], $settings['pending_site_owner_invited_name']);
            $this->officeRepository->update($officeId, $tenantId, ['settings_json' => $settings]);

            $this->mailer->sendSiteOwnerAccessGranted(
                $email,
                $tenantId,
                (string) ($tenant['name'] ?? $tenantId),
                (string) ($office['name'] ?? 'Branch')
            );

            $updatedOffice = $this->officeRepository->findById($officeId, $tenantId);

            $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.site_owner_access_granted', 'office', (string) $officeId, [
                'user_id' => $userId,
                'email' => $email,
            ]);

            return [
                'office' => $updatedOffice,
                'site_owner' => $this->currentSiteOwner($tenantId, $updatedOffice ?: $office),
                'pending_site_owner_invite' => null,
                'status' => 'access_granted',
            ];
        }

        $token = bin2hex(random_bytes(24));
        $tokenHash = hash('sha256', $token);
        $inviteId = $this->siteOwnerInviteRepository->create([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
            'invited_email' => $email,
            'invited_name' => $displayName !== '' ? $displayName : null,
            'token_hash' => $tokenHash,
            'invited_by_user_id' => (int) $actor['id'],
            'expires_at' => gmdate('Y-m-d H:i:s', strtotime('+7 days')),
        ]);

        $settings = $this->officeSettings($office);
        $settings['pending_site_owner_invite_id'] = $inviteId;
        $settings['pending_site_owner_invited_email'] = $email;
        $settings['pending_site_owner_invited_name'] = $displayName !== '' ? $displayName : null;
        $settings['pending_site_owner_invited_at'] = gmdate(DATE_ATOM);
        $this->officeRepository->update($officeId, $tenantId, ['settings_json' => $settings]);

        $acceptUrl = rtrim((string) ($this->config['app']['frontend_url'] ?? 'https://preview.worknestapp.com'), '/')
            . '/invite/site-owner?token=' . urlencode($token);
        $this->mailer->sendSiteOwnerInvite(
            $email,
            (string) ($tenant['name'] ?? $tenantId),
            (string) ($office['name'] ?? 'Branch'),
            $acceptUrl
        );

        $updatedOffice = $this->officeRepository->findById($officeId, $tenantId);
        $invite = $this->siteOwnerInviteRepository->findById($inviteId, $tenantId);

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'office.site_owner_invited', 'office', (string) $officeId, [
            'invite_id' => $inviteId,
            'email' => $email,
        ]);

        return [
            'office' => $updatedOffice,
            'site_owner' => $this->currentSiteOwner($tenantId, $updatedOffice ?: $office),
            'pending_site_owner_invite' => $invite,
            'status' => 'invite_pending',
        ];
    }

    public function resendSiteOwnerInvite(int $officeId, int $inviteId, string $tenantId, array $actor): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $this->assertOfficeAccess($officeId, $actor);
        $invite = $this->siteOwnerInviteRepository->findById($inviteId, $tenantId);
        if ($invite === null || (int) $invite['office_id'] !== $officeId) {
            throw new NotFoundException('Invite not found.');
        }
        if (($invite['status'] ?? '') !== 'pending') {
            throw new ValidationException('Only pending invites can be resent.');
        }

        $token = bin2hex(random_bytes(24));
        $tokenHash = hash('sha256', $token);
        $this->siteOwnerInviteRepository->updateStatus($inviteId, 'cancelled');
        $newInviteId = $this->siteOwnerInviteRepository->create([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
            'invited_email' => $invite['invited_email'],
            'invited_name' => $invite['invited_name'] ?? null,
            'token_hash' => $tokenHash,
            'invited_by_user_id' => (int) $actor['id'],
            'expires_at' => gmdate('Y-m-d H:i:s', strtotime('+7 days')),
        ]);

        $settings = $this->officeSettings($office);
        $settings['pending_site_owner_invite_id'] = $newInviteId;
        $settings['pending_site_owner_invited_email'] = $invite['invited_email'];
        $settings['pending_site_owner_invited_name'] = $invite['invited_name'] ?? null;
        $settings['pending_site_owner_invited_at'] = gmdate(DATE_ATOM);
        $this->officeRepository->update($officeId, $tenantId, ['settings_json' => $settings]);

        $tenant = $this->tenantRepository->findByTenantId($tenantId);
        $acceptUrl = rtrim((string) ($this->config['app']['frontend_url'] ?? 'https://preview.worknestapp.com'), '/')
            . '/invite/site-owner?token=' . urlencode($token);
        $this->mailer->sendSiteOwnerInvite(
            (string) $invite['invited_email'],
            (string) ($tenant['name'] ?? $tenantId),
            (string) ($office['name'] ?? 'Branch'),
            $acceptUrl
        );

        return [
            'pending_site_owner_invite' => $this->siteOwnerInviteRepository->findById($newInviteId, $tenantId),
        ];
    }

    public function cancelSiteOwnerInvite(int $officeId, int $inviteId, string $tenantId, array $actor): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $this->assertOfficeAccess($officeId, $actor);
        $invite = $this->siteOwnerInviteRepository->findById($inviteId, $tenantId);
        if ($invite === null || (int) $invite['office_id'] !== $officeId) {
            throw new NotFoundException('Invite not found.');
        }

        $this->siteOwnerInviteRepository->updateStatus($inviteId, 'cancelled');
        $settings = $this->officeSettings($office);
        unset($settings['pending_site_owner_invite_id'], $settings['pending_site_owner_invited_email'], $settings['pending_site_owner_invited_name'], $settings['pending_site_owner_invited_at']);
        $this->officeRepository->update($officeId, $tenantId, ['settings_json' => $settings]);

        return ['cancelled' => true];
    }

    public function getSiteOwnerInviteByToken(string $token): array
    {
        $invite = $this->siteOwnerInviteRepository->findPendingByTokenHash(hash('sha256', trim($token)));
        if ($invite === null) {
            throw new NotFoundException('Invite not found or no longer valid.');
        }

        return [
            'invite' => $this->invitePayload($invite),
        ];
    }

    public function acceptSiteOwnerInvite(string $token, array $payload): array
    {
        $invite = $this->siteOwnerInviteRepository->findPendingByTokenHash(hash('sha256', trim($token)));
        if ($invite === null) {
            throw new NotFoundException('Invite not found or no longer valid.');
        }

        $tenantId = (string) $invite['tenant_id'];
        $officeId = (int) $invite['office_id'];
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        $email = strtolower(trim((string) $invite['invited_email']));
        $password = (string) ($payload['password'] ?? '');
        $displayName = trim((string) ($payload['name'] ?? $invite['invited_name'] ?? ''));

        if ($displayName === '' || strlen($password) < 8) {
            throw new ValidationException('Name and an 8 character password are required.');
        }

        $siteOwnerRole = $this->roleRepository->findByKey('site_owner');
        if ($siteOwnerRole === null) {
            throw new ApiException('ROLE_MISSING', 'Site owner role is not configured.', 500);
        }

        $userId = $this->transactions->run(function () use ($tenantId, $officeId, $invite, $email, $password, $displayName, $siteOwnerRole) {
            $existingUser = $this->userRepository->findByEmail($tenantId, $email);
            if ($existingUser !== null) {
                if (($existingUser['user_type'] ?? '') === 'employee') {
                    throw new ValidationException('Employee accounts cannot accept site owner invitations.');
                }

                $this->userRepository->update((int) $existingUser['id'], $tenantId, [
                    'office_id' => $officeId,
                    'display_name' => $displayName,
                    'password_hash' => $this->passwordHasher->hash($password),
                    'status' => 'active',
                    'user_type' => ($existingUser['user_type'] ?? '') === 'tenant_owner' ? 'tenant_owner' : 'site_owner',
                ]);

                $userId = (int) $existingUser['id'];
            } else {
                $nameParts = $this->splitName($displayName);
                $userId = $this->userRepository->create([
                    'tenant_id' => $tenantId,
                    'office_id' => $officeId,
                    'first_name' => $nameParts['first_name'],
                    'last_name' => $nameParts['last_name'],
                    'display_name' => $displayName,
                    'email' => $email,
                    'phone' => null,
                    'password_hash' => $this->passwordHasher->hash($password),
                    'user_type' => 'site_owner',
                    'status' => 'active',
                ]);
            }

            $this->roleRepository->assignRole($tenantId, $userId, (int) $siteOwnerRole['id'], $officeId, (int) ($invite['invited_by_user_id'] ?? $userId));
            $this->userRepository->markVerified($userId);
            $this->siteOwnerInviteRepository->markAccepted((int) $invite['id'], $userId);

            return $userId;
        });

        $settings = $this->officeSettings($office);
        $settings['active_site_owner_user_id'] = $userId;
        $settings['active_site_owner_name'] = $displayName;
        $settings['active_site_owner_email'] = $email;
        $settings['active_site_owner_assigned_at'] = gmdate(DATE_ATOM);
        unset($settings['pending_site_owner_invite_id'], $settings['pending_site_owner_invited_email'], $settings['pending_site_owner_invited_name'], $settings['pending_site_owner_invited_at']);
        $this->officeRepository->update($officeId, $tenantId, ['settings_json' => $settings]);

        $user = $this->userRepository->findById($userId, $tenantId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $this->auditLogger->log($tenantId, $officeId, $userId, 'office.site_owner_invite_accepted', 'office', (string) $officeId, [
            'invite_id' => (int) $invite['id'],
            'email' => $email,
        ]);

        return [
            'user' => [
                'id' => (int) $user['id'],
                'name' => $user['display_name'],
                'email' => $user['email'],
                'role' => $user['user_type'],
            ],
            'tenant' => [
                'tenant_id' => $tenantId,
            ],
            'session' => [
                'token' => $this->sessionService->createSession($tenantId, $userId, 'web'),
                'session_type' => 'web',
            ],
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
        $settings = is_array($payload['settings'] ?? null) ? $payload['settings'] : [];
        if (($payload['office_type'] ?? '') === 'branch' && $mainOffice !== null) {
            $mainOfficeSettings = $this->decodeOfficeSettings($mainOffice['settings_json'] ?? null);
            foreach (['workspace_logo_path', 'workspace_logo_mime'] as $key) {
                if (!isset($settings[$key]) && isset($mainOfficeSettings[$key])) {
                    $settings[$key] = $mainOfficeSettings[$key];
                }
            }
        }
        if (($payload['_logo_file'] ?? null) !== null) {
            $settings = $this->storeWorkspaceLogo($tenantId, $payload['_logo_file'], $settings);
        }

        $created = $this->transactions->run(function ($pdo) use ($tenantId, $actor, $payload, $name, $parentOfficeId, $planId, $settings) {
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
                'settings_json' => $settings,
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
        if (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true) && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
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

    private function decodeOfficeSettings(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function storeWorkspaceLogo(string $tenantId, array $file, array $settings): array
    {
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) === UPLOAD_ERR_NO_FILE || ($file['size'] ?? 0) <= 0) {
            return $settings;
        }

        if (($file['error'] ?? UPLOAD_ERR_OK) !== UPLOAD_ERR_OK) {
            throw new ValidationException('Workspace logo upload failed.');
        }

        if (($file['size'] ?? 0) > 2 * 1024 * 1024) {
            throw new ValidationException('Workspace logo cannot exceed 2MB.');
        }

        $imageInfo = is_string($file['tmp_name'] ?? null) && is_file((string) $file['tmp_name'])
            ? @getimagesize((string) $file['tmp_name'])
            : false;
        $detectedMime = is_array($imageInfo) ? strtolower((string) ($imageInfo['mime'] ?? '')) : '';
        if (!in_array($detectedMime, ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'], true)) {
            throw new ValidationException('Workspace logo must be a PNG, JPG, or WEBP image.');
        }

        $extension = match ($detectedMime) {
            'image/png' => 'png',
            'image/webp' => 'webp',
            default => 'jpg',
        };

        if (isset($settings['workspace_logo_path']) && is_string($settings['workspace_logo_path'])) {
            $this->fileStorage->deleteIfExists($settings['workspace_logo_path']);
        }

        $storedFilename = 'workspace-logo-' . bin2hex(random_bytes(8)) . '.' . $extension;
        $relativePath = 'uploads/workspace-logos/' . $tenantId . '/' . $storedFilename;
        $this->fileStorage->storeUploadedFile($file, 'uploads/workspace-logos/' . $tenantId, $storedFilename);
        $settings['workspace_logo_path'] = $relativePath;
        $settings['workspace_logo_mime'] = $detectedMime;

        return $settings;
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

    private function currentSiteOwner(string $tenantId, array $office): ?array
    {
        $settings = $this->officeSettings($office);
        $userId = isset($settings['active_site_owner_user_id']) ? (int) $settings['active_site_owner_user_id'] : 0;
        if ($userId <= 0) {
            return null;
        }

        $user = $this->userRepository->findById($userId, $tenantId);
        if ($user === null) {
            return [
                'id' => $userId,
                'name' => $settings['active_site_owner_name'] ?? null,
                'email' => $settings['active_site_owner_email'] ?? null,
                'status' => null,
            ];
        }

        return [
            'id' => (int) $user['id'],
            'name' => $user['display_name'],
            'email' => $user['email'],
            'status' => $user['status'],
        ];
    }

    private function pendingSiteOwnerInvite(string $tenantId, int $officeId): ?array
    {
        try {
            $invite = $this->siteOwnerInviteRepository->findLatestPendingByOffice($tenantId, $officeId);
            return $invite ? $this->invitePayload($invite) : null;
        } catch (Throwable $exception) {
            if ($this->isMissingSiteOwnerInvitesTable($exception)) {
                return null;
            }

            throw $exception;
        }
    }

    private function invitePayload(array $invite): array
    {
        return [
            'id' => (int) $invite['id'],
            'tenant_id' => $invite['tenant_id'],
            'office_id' => (int) $invite['office_id'],
            'office_name' => $invite['office_name'] ?? null,
            'office_code' => $invite['office_code'] ?? null,
            'tenant_name' => $invite['tenant_name'] ?? null,
            'invited_email' => $invite['invited_email'],
            'invited_name' => $invite['invited_name'] ?? null,
            'status' => $invite['status'],
            'expires_at' => $invite['expires_at'] ?? null,
            'created_at' => $invite['created_at'] ?? null,
            'accepted_at' => $invite['accepted_at'] ?? null,
        ];
    }

    private function officeSettings(array $office): array
    {
        $settings = $office['settings_json'] ?? null;
        if (is_array($settings)) {
            return $settings;
        }
        if (is_string($settings) && $settings !== '') {
            $decoded = json_decode($settings, true);
            if (is_array($decoded)) {
                return $decoded;
            }
        }

        return [];
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

    private function isMissingSiteOwnerInvitesTable(Throwable $exception): bool
    {
        return str_contains($exception->getMessage(), 'site_owner_invites')
            && str_contains($exception->getMessage(), 'Base table or view not found');
    }
}
