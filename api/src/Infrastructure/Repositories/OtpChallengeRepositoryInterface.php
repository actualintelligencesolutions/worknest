<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface OtpChallengeRepositoryInterface
{
    public function create(
        string $tenantId,
        int $userId,
        ?int $officeId,
        string $channel,
        string $purpose,
        string $destination,
        string $otpCode
    ): int;

    public function findPendingAdminChallenge(int $challengeId): ?array;

    public function incrementAttempt(int $challengeId): void;

    public function markVerified(int $challengeId): void;
}
