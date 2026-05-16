<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\User;

use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Database\TransactionManager;
use Worknest\Api\Infrastructure\Repositories\OfficeRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\RoleRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;
use Worknest\Api\Infrastructure\Security\PasswordHasher;
use Worknest\Api\Infrastructure\Security\PinHasher;

final class UserService
{
    public function __construct(
        private readonly UserRepositoryInterface $userRepository,
        private readonly OfficeRepositoryInterface $officeRepository,
        private readonly RoleRepositoryInterface $roleRepository,
        private readonly PasswordHasher $passwordHasher,
        private readonly PinHasher $pinHasher,
        private readonly TransactionManager $transactions,
        private readonly AuditLogger $auditLogger
    ) {
    }

    public function createUser(string $tenantId, array $actor, array $payload): array
    {
        $userType = (string) ($payload['user_type'] ?? '');
        if (!in_array($userType, ['branch_admin', 'employee'], true)) {
            throw new ValidationException('User type must be branch_admin or employee.');
        }

        $officeId = isset($payload['office_id']) ? (int) $payload['office_id'] : null;
        if ($userType === 'employee' && ($officeId === null || $officeId <= 0)) {
            throw new ValidationException('Employee creation requires a branch office.');
        }

        if ($officeId !== null) {
            $office = $this->officeRepository->findById($officeId, $tenantId);
            if ($office === null) {
                throw new ValidationException('Office was not found.');
            }
            if (($actor['user_type'] ?? '') === 'branch_admin' && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
                throw new ForbiddenException();
            }
        }

        $displayName = trim((string) ($payload['display_name'] ?? trim(((string) ($payload['first_name'] ?? '')) . ' ' . ((string) ($payload['last_name'] ?? '')))));
        $firstName = trim((string) ($payload['first_name'] ?? ''));
        if ($firstName === '' || $displayName === '') {
            throw new ValidationException('First name and display name are required.');
        }

        $email = isset($payload['email']) ? strtolower(trim((string) $payload['email'])) : null;
        $phone = isset($payload['phone']) ? $this->normalizePhone((string) $payload['phone']) : null;
        if ($email !== null && $email !== '' && $this->userRepository->emailExists($tenantId, $email)) {
            throw new ValidationException('A user with this email already exists for the tenant.');
        }
        if ($phone !== null && $phone !== '' && $this->userRepository->phoneExists($tenantId, $phone)) {
            throw new ValidationException('A user with this phone number already exists for the tenant.');
        }

        $employeeId = isset($payload['employee_id']) ? trim((string) $payload['employee_id']) : null;
        if ($employeeId !== null && $employeeId !== '' && $this->userRepository->employeeIdExists($tenantId, $employeeId)) {
            throw new ValidationException('An employee with this employee ID already exists for the tenant.');
        }

        if ($userType === 'employee' && ($email === null || $email === '') && ($phone === null || $phone === '')) {
            throw new ValidationException('Employee creation requires at least one login identifier: email or phone.');
        }

        $role = $this->roleRepository->findByKey($userType);
        if ($role === null) {
            throw new ValidationException('Role is not configured.');
        }

        $userId = $this->transactions->run(function () use ($tenantId, $actor, $payload, $userType, $officeId, $displayName, $firstName, $email, $employeeId, $role) {
            $userId = $this->userRepository->create([
                'tenant_id' => $tenantId,
                'office_id' => $officeId,
                'employee_id' => $employeeId ?: null,
                'first_name' => $firstName,
                'last_name' => trim((string) ($payload['last_name'] ?? '')) ?: null,
                'display_name' => $displayName,
                'email' => $email ?: null,
                'phone' => $phone ?: null,
                'password_hash' => $userType === 'branch_admin' && !empty($payload['password'])
                    ? $this->passwordHasher->hash((string) $payload['password'])
                    : null,
                'pin_hash' => $userType === 'employee' && !empty($payload['initial_pin'])
                    ? $this->pinHasher->hash((string) $payload['initial_pin'])
                    : null,
                'user_type' => $userType,
                'status' => $userType === 'employee' ? 'active' : 'pending_verification',
            ]);

            $this->roleRepository->assignRole($tenantId, $userId, (int) $role['id'], $officeId, (int) $actor['id']);
            return $userId;
        });

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'user.created', 'user', (string) $userId, ['user_type' => $userType]);

        return ['user' => $this->userRepository->findById($userId, $tenantId)];
    }

    public function listUsers(string $tenantId, array $actor, array $filters): array
    {
        return ['users' => $this->userRepository->listAccessible($tenantId, $actor, $filters)];
    }

    public function getUser(int $userId, string $tenantId, array $actor): array
    {
        $user = $this->userRepository->findById($userId, $tenantId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }
        $this->assertUserAccess($user, $actor);

        return ['user' => $user];
    }

    public function updateUser(int $userId, string $tenantId, array $actor, array $payload): array
    {
        $existing = $this->userRepository->findById($userId, $tenantId);
        if ($existing === null) {
            throw new NotFoundException('User not found.');
        }
        $this->assertUserAccess($existing, $actor);

        if (isset($payload['pin'])) {
            $payload['pin_hash'] = $this->pinHasher->hash((string) $payload['pin']);
            unset($payload['pin']);
        }
        if (isset($payload['password'])) {
            $payload['password_hash'] = $this->passwordHasher->hash((string) $payload['password']);
            unset($payload['password']);
        }
        if (isset($payload['display_name']) && trim((string) $payload['display_name']) === '') {
            throw new ValidationException('Display name cannot be empty.');
        }
        if (array_key_exists('phone', $payload)) {
            $payload['phone'] = $payload['phone'] !== null && trim((string) $payload['phone']) !== ''
                ? $this->normalizePhone((string) $payload['phone'])
                : null;
        }
        if (array_key_exists('email', $payload)) {
            $payload['email'] = $payload['email'] !== null && trim((string) $payload['email']) !== ''
                ? strtolower(trim((string) $payload['email']))
                : null;
        }

        $user = $this->userRepository->update($userId, $tenantId, $payload);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $this->auditLogger->log($tenantId, $existing['office_id'] !== null ? (int) $existing['office_id'] : null, (int) $actor['id'], 'user.updated', 'user', (string) $userId, array_keys($payload));

        return ['user' => $user];
    }

    public function resetPin(int $userId, string $tenantId, array $actor, string $pin): array
    {
        if (strlen(trim($pin)) < 4) {
            throw new ValidationException('PIN must be at least 4 digits.');
        }

        $existing = $this->userRepository->findById($userId, $tenantId);
        if ($existing === null || $existing['user_type'] !== 'employee') {
            throw new NotFoundException('Employee not found.');
        }
        $this->assertUserAccess($existing, $actor);

        $user = $this->userRepository->update($userId, $tenantId, [
            'pin_hash' => $this->pinHasher->hash($pin),
            'status' => 'active',
        ]);

        $this->auditLogger->log($tenantId, $existing['office_id'] !== null ? (int) $existing['office_id'] : null, (int) $actor['id'], 'employee.pin_reset', 'user', (string) $userId);

        return ['user' => $user, 'pin_reset' => true];
    }

    private function assertUserAccess(array $user, array $actor): void
    {
        if (($actor['user_type'] ?? '') !== 'branch_admin') {
            return;
        }

        $officeId = $user['office_id'] !== null ? (int) $user['office_id'] : null;
        if ($officeId === null || !in_array($officeId, $actor['office_ids'] ?? [], true)) {
            throw new ForbiddenException();
        }
    }

    private function normalizePhone(string $phone): string
    {
        $digits = preg_replace('/\D+/', '', $phone) ?? '';
        if ($digits === '') {
            return '';
        }
        if (strlen($digits) === 10) {
            return '+91' . $digits;
        }
        if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
            return '+' . $digits;
        }
        if (str_starts_with(trim($phone), '+')) {
            return '+' . $digits;
        }

        return '+' . $digits;
    }
}
