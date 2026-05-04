<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoOtpChallengeRepository implements OtpChallengeRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(
        string $tenantId,
        int $userId,
        ?int $officeId,
        string $channel,
        string $purpose,
        string $destination,
        string $otpCode
    ): int {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO otp_challenges (
                tenant_id, user_id, office_id, channel, purpose, destination,
                otp_code_hash, expires_at
             ) VALUES (
                :tenant_id, :user_id, :office_id, :channel, :purpose, :destination,
                :otp_code_hash, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE)
             )'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'office_id' => $officeId,
            'channel' => $channel,
            'purpose' => $purpose,
            'destination' => $destination,
            'otp_code_hash' => password_hash($otpCode, PASSWORD_DEFAULT),
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function findPendingAdminChallenge(int $challengeId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT c.*, u.display_name, u.email, u.user_type
             FROM otp_challenges c
             JOIN users u ON u.id = c.user_id
             WHERE c.id = :id
               AND c.channel = "email"
               AND c.purpose = "admin_verification"
               AND c.status = "pending"
               AND c.expires_at > CURRENT_TIMESTAMP
             LIMIT 1'
        );
        $stmt->execute(['id' => $challengeId]);
        $challenge = $stmt->fetch(PDO::FETCH_ASSOC);

        return $challenge === false ? null : $challenge;
    }

    public function incrementAttempt(int $challengeId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE otp_challenges SET attempt_count = attempt_count + 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id'
        );
        $stmt->execute(['id' => $challengeId]);
    }

    public function markVerified(int $challengeId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE otp_challenges
             SET status = "verified", verified_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute(['id' => $challengeId]);
    }
}
