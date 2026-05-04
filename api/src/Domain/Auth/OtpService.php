<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Auth;

use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Infrastructure\Notifications\Mailer;
use Worknest\Api\Infrastructure\Repositories\OtpChallengeRepositoryInterface;

final class OtpService
{
    public function __construct(
        private readonly OtpChallengeRepositoryInterface $otpChallengeRepository,
        private readonly Mailer $mailer
    ) {
    }

    public function createAdminVerificationChallenge(
        string $tenantId,
        int $userId,
        string $destination,
        string $companyName
    ): array {
        $otpCode = '3333';
        $challengeId = $this->otpChallengeRepository->create(
            $tenantId,
            $userId,
            null,
            'email',
            'admin_verification',
            $destination,
            $otpCode
        );

        return [
            'challenge_id' => $challengeId,
            'channel' => 'email',
            'destination' => $destination,
            'email_sent' => $this->mailer->sendAdminOtp($destination, $otpCode, $companyName),
            'dev_otp' => $otpCode,
        ];
    }

    public function verifyAdminChallenge(int $challengeId, string $otpCode): array
    {
        $challenge = $this->otpChallengeRepository->findPendingAdminChallenge($challengeId);
        if ($challenge === null || !password_verify($otpCode, (string) $challenge['otp_code_hash'])) {
            if ($challenge !== null) {
                $this->otpChallengeRepository->incrementAttempt((int) $challenge['id']);
            }
            throw new ApiException('INVALID_OTP', 'The OTP is invalid or expired.', 422);
        }

        $this->otpChallengeRepository->markVerified((int) $challenge['id']);

        return $challenge;
    }
}
