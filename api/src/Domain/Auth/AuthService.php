<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Auth;

use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\UnauthorizedException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\TenantRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PasswordHasher;
use Worknest\Api\Infrastructure\Security\PinHasher;

final class AuthService
{
    public function __construct(
        private readonly TenantRepositoryInterface $tenantRepository,
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly UserRepositoryInterface $userRepository,
        private readonly RoleRepositoryInterface $roleRepository,
        private readonly PasswordHasher $passwordHasher,
        private readonly PinHasher $pinHasher,
        private readonly OtpService $otpService,
        private readonly SessionService $sessionService,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger
    ) {
    }

    public function checkWorkspaceAvailability(string $tenantId): array
    {
        if (strlen($tenantId) < 3) {
            throw new ValidationException('Workspace address must be at least 3 characters.');
        }

        if (in_array($tenantId, $this->reservedTenantIds(), true)) {
            return [
                'tenant_id' => $tenantId,
                'available' => false,
                'reason' => 'reserved',
            ];
        }

        return [
            'tenant_id' => $tenantId,
            'available' => $this->tenantRepository->findByTenantId($tenantId) === null,
            'reason' => $this->tenantRepository->findByTenantId($tenantId) === null ? null : 'taken',
        ];
    }

    public function registerCompany(array $payload): array
    {
        $companyName = trim((string) ($payload['company_name'] ?? ''));
        $tenantId = $this->slugify((string) ($payload['tenant_id'] ?? $companyName));
        $adminName = trim((string) ($payload['admin_name'] ?? ''));
        $adminEmail = strtolower(trim((string) ($payload['admin_email'] ?? '')));
        $adminPhone = $this->normalizePhone((string) ($payload['admin_phone'] ?? ''));
        $password = (string) ($payload['admin_password'] ?? '');

        if (
            $companyName === '' ||
            $adminName === '' ||
            !filter_var($adminEmail, FILTER_VALIDATE_EMAIL) ||
            !$this->validPhone($adminPhone) ||
            strlen($password) < 8
        ) {
            throw new ValidationException('Company, owner details, valid phone, and an 8 character password are required.');
        }

        $availability = $this->checkWorkspaceAvailability($tenantId);
        if ($availability['available'] !== true) {
            throw new ApiException('WORKSPACE_UNAVAILABLE', 'This workspace address is not available.', 409);
        }

        return $this->transactions->run(function () use ($tenantId, $companyName, $adminName, $adminEmail, $adminPhone, $password) {
            $this->tenantRepository->create($tenantId, $companyName);
            $nameParts = $this->splitName($adminName);
            $userId = $this->userRepository->create([
                'tenant_id' => $tenantId,
                'first_name' => $nameParts['first_name'],
                'last_name' => $nameParts['last_name'],
                'display_name' => $adminName,
                'email' => $adminEmail,
                'phone' => $adminPhone,
                'password_hash' => $this->passwordHasher->hash($password),
                'user_type' => 'tenant_owner',
                'status' => 'pending_verification',
            ]);

            $this->tenantRepository->setPrimaryOwnerUserId($tenantId, $userId);
            $tenantOwnerRole = $this->roleRepository->findByKey('tenant_owner');
            if ($tenantOwnerRole !== null) {
                $this->roleRepository->assignRole($tenantId, $userId, (int) $tenantOwnerRole['id'], null, $userId);
            }

            $verification = $this->otpService->createAdminVerificationChallenge(
                $tenantId,
                $userId,
                $adminEmail,
                $companyName
            );

            $this->auditLogger->log(
                $tenantId,
                null,
                $userId,
                'tenant.registered',
                'tenant',
                $tenantId,
                ['company_name' => $companyName]
            );

            return [
                'tenant' => [
                    'tenant_id' => $tenantId,
                    'name' => $companyName,
                ],
                'user' => [
                    'id' => $userId,
                    'name' => $adminName,
                    'email' => $adminEmail,
                    'role' => 'tenant_owner',
                    'status' => 'pending_verification',
                ],
                'verification' => $verification,
                'next_step' => 'verify_admin_email',
            ];
        });
    }

    public function verifyAdminOtp(int $challengeId, string $otpCode): array
    {
        if ($challengeId <= 0 || trim($otpCode) === '') {
            throw new ValidationException('Challenge and OTP code are required.');
        }

        $challenge = $this->transactions->run(function () use ($challengeId, $otpCode) {
            $challenge = $this->otpService->verifyAdminChallenge($challengeId, $otpCode);
            $this->userRepository->markVerified((int) $challenge['user_id']);
            $this->tenantRepository->markActive($challenge['tenant_id']);
            return $challenge;
        });

        $token = $this->sessionService->createSession($challenge['tenant_id'], (int) $challenge['user_id'], 'web');

        return [
            'token' => $token,
            'tenant' => ['tenant_id' => $challenge['tenant_id']],
            'user' => [
                'id' => (int) $challenge['user_id'],
                'name' => $challenge['display_name'],
                'email' => $challenge['email'],
                'role' => $challenge['user_type'],
                'status' => 'active',
            ],
            'next_step' => 'setup_company',
        ];
    }

    public function loginOwner(string $tenantId, string $email, string $password): array
    {
        return $this->loginAdmin($tenantId, $email, $password, 'tenant_owner');
    }

    public function loginHrAdmin(string $tenantId, string $email, string $password): array
    {
        try {
            return $this->loginAdmin($tenantId, $email, $password, 'tenant_owner');
        } catch (UnauthorizedException) {
            try {
                return $this->loginAdmin($tenantId, $email, $password, 'branch_admin');
            } catch (UnauthorizedException) {
                return $this->loginAdmin($tenantId, $email, $password, 'site_owner');
            }
        }
    }

    public function loginBranchAdmin(string $tenantId, string $email, string $password): array
    {
        return $this->loginAdmin($tenantId, $email, $password, 'branch_admin');
    }

    public function loginEmployee(string $tenantId, string $employeeId, string $pin): array
    {
        $identifier = $this->normalizeEmployeeIdentifier($employeeId);
        $user = $this->userRepository->findActiveEmployeeByIdentifier($tenantId, $identifier);
        if ($user === null || empty($user['pin_hash']) || !$this->pinHasher->verify($pin, (string) $user['pin_hash'])) {
            throw new UnauthorizedException('Invalid employee login or PIN.');
        }

        $this->userRepository->updateLastLoginAt((int) $user['id']);
        $token = $this->sessionService->createSession($tenantId, (int) $user['id'], 'employee_portal');

        return [
            'token' => $token,
            'user' => [
                'id' => (int) $user['id'],
                'employee_id' => $user['employee_id'],
                'name' => $user['display_name'],
                'office_id' => $user['office_id'] !== null ? (int) $user['office_id'] : null,
                'user_type' => $user['user_type'],
            ],
            'tenant' => [
                'tenant_id' => $tenantId,
            ],
            'session' => [
                'token' => $token,
                'session_type' => 'employee_portal',
            ],
        ];
    }

    public function loginEmployeeForOffice(string $tenantId, string $officeCode, string $employeeId, string $pin): array
    {
        $office = $this->officeRepository->findByCode($tenantId, $officeCode);
        if ($office === null) {
            throw new ValidationException('The requested site portal could not be found.');
        }

        $payload = $this->loginEmployee($tenantId, $employeeId, $pin);
        if ((int) ($payload['user']['office_id'] ?? 0) !== (int) $office['id']) {
            throw new ForbiddenException('This employee does not belong to the requested site.');
        }

        return $payload;
    }

    public function logout(string $token): array
    {
        $this->sessionService->revoke($token);
        return ['revoked' => true];
    }

    public function currentActor(string $token, ?string $tenantId): array
    {
        $session = $this->sessionService->authenticate($token, $tenantId);
        $user = $session['user'];

        return [
            'actor' => [
                'id' => (int) $user['id'],
                'tenant_id' => $session['tenant_id'],
                'office_id' => $user['office_id'] !== null ? (int) $user['office_id'] : null,
                'employee_id' => $user['employee_id'],
                'name' => $user['display_name'],
                'email' => $user['email'],
                'phone' => $user['phone'],
                'user_type' => $user['user_type'],
                'status' => $user['status'],
                'office_ids' => $this->roleRepository->listOfficeIdsForUser($session['tenant_id'], (int) $user['id']),
            ],
        ];
    }

    public function requireActor(string $token, ?string $tenantId, ?array $allowedUserTypes = null): array
    {
        $actor = $this->currentActor($token, $tenantId)['actor'];
        if ($allowedUserTypes !== null && !in_array($actor['user_type'], $allowedUserTypes, true)) {
            throw new ForbiddenException();
        }

        return $actor;
    }

    private function loginAdmin(string $tenantId, string $email, string $password, string $userType): array
    {
        $user = $this->userRepository->findActiveByEmail($tenantId, strtolower(trim($email)), $userType);
        if ($user === null || empty($user['password_hash']) || !$this->passwordHasher->verify($password, (string) $user['password_hash'])) {
            throw new UnauthorizedException('Invalid email or password.');
        }

        $this->userRepository->updateLastLoginAt((int) $user['id']);
        $token = $this->sessionService->createSession($tenantId, (int) $user['id'], 'web');

        return [
            'token' => $token,
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
                'token' => $token,
                'session_type' => 'web',
            ],
        ];
    }

    private function slugify(string $value): string
    {
        $slug = strtolower(trim((string) preg_replace('/[^a-zA-Z0-9]+/', '-', $value), '-'));
        return $slug !== '' ? $slug : 'tenant';
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if (strlen($digits) === 10) {
            return '+91' . $digits;
        }
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            return '+' . $digits;
        }
        if (str_starts_with(trim($phone), '+') && strlen($digits) >= 10) {
            return '+' . $digits;
        }

        return $digits === '' ? '' : '+' . $digits;
    }

    private function validPhone(string $phone): bool
    {
        return preg_match('/^\+[1-9][0-9]{9,14}$/', $phone) === 1;
    }

    private function normalizeEmployeeIdentifier(string $identifier): string
    {
        $trimmed = trim($identifier);
        $lowered = strtolower($trimmed);
        if (filter_var($lowered, FILTER_VALIDATE_EMAIL)) {
            return $lowered;
        }

        if (preg_match('/^\+?[0-9][0-9\s\-]{7,}$/', $trimmed) === 1) {
            return $this->normalizePhone($trimmed);
        }

        return $trimmed;
    }

    private function reservedTenantIds(): array
    {
        return ['admin', 'api', 'app', 'login', 'worknest'];
    }

    private function splitName(string $displayName): array
    {
        $parts = preg_split('/\s+/', trim($displayName)) ?: [];
        $firstName = $parts[0] ?? $displayName;
        $lastName = count($parts) > 1 ? implode(' ', array_slice($parts, 1)) : null;

        return [
            'first_name' => $firstName,
            'last_name' => $lastName,
        ];
    }
}
