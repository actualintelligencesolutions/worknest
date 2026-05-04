<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Auth;

use DateInterval;
use DateTimeImmutable;
use Worknest\Api\Application\Exceptions\UnauthorizedException;
use Worknest\Api\Infrastructure\Repositories\SessionRepositoryInterface;
use Worknest\Api\Infrastructure\Repositories\UserRepositoryInterface;

final class SessionService
{
    public function __construct(
        private readonly SessionRepositoryInterface $sessionRepository,
        private readonly UserRepositoryInterface $userRepository
    ) {
    }

    public function createSession(string $tenantId, int $userId, string $sessionType = 'web'): string
    {
        $token = bin2hex(random_bytes(32));
        $expiresAt = (new DateTimeImmutable())
            ->add(new DateInterval($sessionType === 'employee_portal' ? 'PT12H' : 'P7D'))
            ->format('Y-m-d H:i:s');

        $this->sessionRepository->create($tenantId, $userId, $sessionType, $token, $expiresAt);

        return $token;
    }

    public function authenticate(string $token, ?string $tenantId = null): array
    {
        $session = $this->sessionRepository->findActiveByToken($token);
        if ($session === null) {
            throw new UnauthorizedException();
        }

        if ($tenantId !== null && $session['tenant_id'] !== $tenantId) {
            throw new UnauthorizedException();
        }

        $user = $this->userRepository->findById((int) $session['user_id'], $session['tenant_id']);
        if ($user === null) {
            throw new UnauthorizedException();
        }

        return [
            'session_id' => (int) $session['id'],
            'tenant_id' => $session['tenant_id'],
            'user' => $user,
            'session_type' => $session['session_type'],
        ];
    }

    public function revoke(string $token): void
    {
        $this->sessionRepository->revokeByToken($token);
    }
}
