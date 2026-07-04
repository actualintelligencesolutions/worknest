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
        if (!in_array($userType, ['branch_admin', 'site_owner', 'employee'], true)) {
            throw new ValidationException('User type must be branch_admin, site_owner, or employee.');
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
            if (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true) && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
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

        if ($userType === 'employee' && ($phone === null || $phone === '' || $employeeId === null || $employeeId === '')) {
            throw new ValidationException('Employee creation requires both phone number and employee ID.');
        }

        $role = $this->roleRepository->findByKey($userType);
        if ($role === null) {
            throw new ValidationException('Role is not configured.');
        }

        $employeePin = null;
        if ($userType === 'employee') {
            $employeePin = $this->resolvedPin((string) ($payload['initial_pin'] ?? ''));
        }

        $userId = $this->transactions->run(function () use ($tenantId, $actor, $payload, $userType, $officeId, $displayName, $firstName, $email, $phone, $employeeId, $role, $employeePin) {
            $userId = $this->userRepository->create([
                'tenant_id' => $tenantId,
                'office_id' => $officeId,
                'employee_id' => $employeeId ?: null,
                'first_name' => $firstName,
                'last_name' => trim((string) ($payload['last_name'] ?? '')) ?: null,
                'display_name' => $displayName,
                'email' => $email ?: null,
                'phone' => $phone ?: null,
                'password_hash' => in_array($userType, ['branch_admin', 'site_owner'], true) && !empty($payload['password'])
                    ? $this->passwordHasher->hash((string) $payload['password'])
                    : null,
                'employee_pin' => $userType === 'employee' ? $this->pinHasher->hash($employeePin ?? '') : null,
                'employment_type' => $this->nullableString($payload['employment_type'] ?? null),
                'date_of_joining' => $this->normalizeDate($payload['date_of_joining'] ?? null),
                'father_name' => $this->nullableString($payload['father_name'] ?? null),
                'uan' => $this->nullableString($payload['uan'] ?? null),
                'bank_name' => $this->nullableString($payload['bank_name'] ?? null),
                'bank_account_number' => $this->nullableString($payload['bank_account_number'] ?? null),
                'ifsc' => $this->nullableString($payload['ifsc'] ?? null),
                'designation' => $this->nullableString($payload['designation'] ?? null),
                'basic_rate' => $this->nullableMoney($payload['basic_rate'] ?? null),
                'user_type' => $userType,
                'status' => $userType === 'employee' ? 'active' : 'pending_verification',
            ]);

            $this->roleRepository->assignRole($tenantId, $userId, (int) $role['id'], $officeId, (int) $actor['id']);
            return $userId;
        });

        $this->auditLogger->log($tenantId, $officeId, (int) $actor['id'], 'user.created', 'user', (string) $userId, ['user_type' => $userType]);

        $user = $this->userRepository->findById($userId, $tenantId);
        if ($user !== null) {
            $user = $this->maskPinForActor($user, $actor);
        }

        return ['user' => $user];
    }

    public function listUsers(string $tenantId, array $actor, array $filters): array
    {
        $users = $this->userRepository->listAccessible($tenantId, $actor, $filters);

        return ['users' => array_map(fn (array $user): array => $this->maskPinForActor($user, $actor), $users)];
    }

    public function getUser(int $userId, string $tenantId, array $actor): array
    {
        $user = $this->userRepository->findById($userId, $tenantId);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }
        $this->assertUserAccess($user, $actor);

        return ['user' => $this->maskPinForActor($user, $actor)];
    }

    public function updateUser(int $userId, string $tenantId, array $actor, array $payload): array
    {
        $existing = $this->userRepository->findById($userId, $tenantId);
        if ($existing === null) {
            throw new NotFoundException('User not found.');
        }
        $this->assertUserAccess($existing, $actor);

        if (isset($payload['pin'])) {
            $payload['employee_pin'] = $this->pinHasher->hash($this->resolvedPin((string) $payload['pin']));
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
            if (
                $payload['phone'] !== null
                && $payload['phone'] !== ($existing['phone'] ?? null)
                && $this->userRepository->phoneExists($tenantId, $payload['phone'])
            ) {
                throw new ValidationException('A user with this phone number already exists for the tenant.');
            }
        }
        if (array_key_exists('email', $payload)) {
            $payload['email'] = $payload['email'] !== null && trim((string) $payload['email']) !== ''
                ? strtolower(trim((string) $payload['email']))
                : null;
            if (
                $payload['email'] !== null
                && $payload['email'] !== ($existing['email'] ?? null)
                && $this->userRepository->emailExists($tenantId, $payload['email'])
            ) {
                throw new ValidationException('A user with this email already exists for the tenant.');
            }
        }
        if (array_key_exists('employee_id', $payload)) {
            $payload['employee_id'] = $payload['employee_id'] !== null && trim((string) $payload['employee_id']) !== ''
                ? trim((string) $payload['employee_id'])
                : null;
            if (
                $payload['employee_id'] !== null
                && $payload['employee_id'] !== ($existing['employee_id'] ?? null)
                && $this->userRepository->employeeIdExists($tenantId, $payload['employee_id'])
            ) {
                throw new ValidationException('An employee with this employee ID already exists for the tenant.');
            }
        }
        foreach (['employment_type', 'father_name', 'uan', 'bank_name', 'bank_account_number', 'ifsc', 'designation'] as $field) {
            if (array_key_exists($field, $payload)) {
                $payload[$field] = $this->nullableString($payload[$field]);
            }
        }
        if (array_key_exists('date_of_joining', $payload)) {
            $payload['date_of_joining'] = $this->normalizeDate($payload['date_of_joining']);
        }
        if (array_key_exists('basic_rate', $payload)) {
            $payload['basic_rate'] = $this->nullableMoney($payload['basic_rate']);
        }

        $user = $this->userRepository->update($userId, $tenantId, $payload);
        if ($user === null) {
            throw new NotFoundException('User not found.');
        }

        $this->auditLogger->log($tenantId, $existing['office_id'] !== null ? (int) $existing['office_id'] : null, (int) $actor['id'], 'user.updated', 'user', (string) $userId, array_keys($payload));

        return ['user' => $user !== null ? $this->maskPinForActor($user, $actor) : null];
    }

    public function resetPin(int $userId, string $tenantId, array $actor, string $pin): array
    {
        $existing = $this->userRepository->findById($userId, $tenantId);
        if ($existing === null || $existing['user_type'] !== 'employee') {
            throw new NotFoundException('Employee not found.');
        }
        $this->assertUserAccess($existing, $actor);

        $nextPin = $this->resolvedPin($pin);
        $user = $this->userRepository->update($userId, $tenantId, [
            'employee_pin' => $this->pinHasher->hash($nextPin),
            'status' => 'active',
        ]);

        $this->auditLogger->log($tenantId, $existing['office_id'] !== null ? (int) $existing['office_id'] : null, (int) $actor['id'], 'employee.pin_reset', 'user', (string) $userId);

        return [
            'user' => $user !== null ? $this->maskPinForActor($user, $actor) : null,
            'pin_reset' => true,
            'revealed_pin' => $nextPin,
        ];
    }

    public function resetPinsForOffice(int $officeId, string $tenantId, array $actor): array
    {
        $office = $this->officeRepository->findById($officeId, $tenantId);
        if ($office === null) {
            throw new NotFoundException('Office not found.');
        }

        if (($office['office_type'] ?? '') !== 'branch') {
            throw new ValidationException('Employee PIN management is available only for branch offices.');
        }

        if (in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true) && !in_array($officeId, $actor['office_ids'] ?? [], true)) {
            throw new ForbiddenException();
        }

        $employees = $this->userRepository->listAccessible($tenantId, $actor, [
            'office_id' => $officeId,
            'user_type' => 'employee',
        ]);

        $results = [];
        foreach ($employees as $employee) {
            $pin = $this->generatePin();
            $this->userRepository->update((int) $employee['id'], $tenantId, [
                'employee_pin' => $this->pinHasher->hash($pin),
                'status' => 'active',
            ]);
            $results[] = [
                'user_id' => (int) $employee['id'],
                'employee_id' => $employee['employee_id'],
                'display_name' => $employee['display_name'],
                'phone' => $employee['phone'] ?? null,
                'email' => $employee['email'] ?? null,
                'revealed_pin' => $pin,
            ];
        }

        $this->auditLogger->log(
            $tenantId,
            $officeId,
            (int) $actor['id'],
            'employee.pin_bulk_reset',
            'office',
            (string) $officeId,
            ['employee_count' => count($results)]
        );

        return [
            'office_id' => $officeId,
            'employees' => $results,
            'pin_reset_count' => count($results),
        ];
    }

    private function assertUserAccess(array $user, array $actor): void
    {
        if (!in_array(($actor['user_type'] ?? ''), ['branch_admin', 'site_owner'], true)) {
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

    private function resolvedPin(string $pin): string
    {
        $trimmed = trim($pin);
        if ($trimmed === '') {
            return $this->generatePin();
        }

        if (preg_match('/^[0-9]{4,8}$/', $trimmed) !== 1) {
            throw new ValidationException('PIN must be 4 to 8 digits.');
        }

        return $trimmed;
    }

    private function generatePin(): string
    {
        return str_pad((string) random_int(0, 9999), 4, '0', STR_PAD_LEFT);
    }

    private function nullableString(mixed $value): ?string
    {
        if ($value === null) {
            return null;
        }

        $trimmed = trim((string) $value);

        return $trimmed === '' ? null : $trimmed;
    }

    private function nullableMoney(mixed $value): ?float
    {
        if ($value === null || trim((string) $value) === '') {
            return null;
        }

        $clean = preg_replace('/[^0-9.\-]/', '', (string) $value) ?? '';

        return $clean === '' ? null : round((float) $clean, 2);
    }

    private function normalizeDate(mixed $value): ?string
    {
        $trimmed = $this->nullableString($value);
        if ($trimmed === null) {
            return null;
        }

        $timestamp = strtotime($trimmed);

        return $timestamp === false ? null : date('Y-m-d', $timestamp);
    }

    private function maskPinForActor(array $user, array $actor): array
    {
        if (
            ($user['user_type'] ?? '') !== 'employee'
            || !in_array(($actor['user_type'] ?? ''), ['tenant_owner', 'branch_admin'], true)
        ) {
            unset($user['employee_pin']);
        }

        return $user;
    }
}
