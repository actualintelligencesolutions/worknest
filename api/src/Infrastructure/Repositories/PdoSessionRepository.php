<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoSessionRepository implements SessionRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(string $tenantId, int $userId, string $sessionType, string $rawToken, string $expiresAt): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO auth_sessions (
                tenant_id, user_id, session_type, token_hash, expires_at, ip_address, user_agent
             ) VALUES (
                :tenant_id, :user_id, :session_type, :token_hash, :expires_at, NULL, NULL
             )'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'user_id' => $userId,
            'session_type' => $sessionType,
            'token_hash' => hash('sha256', $rawToken),
            'expires_at' => $expiresAt,
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function findActiveByToken(string $rawToken): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT * FROM auth_sessions
             WHERE token_hash = :token_hash
               AND revoked_at IS NULL
               AND expires_at > CURRENT_TIMESTAMP
             LIMIT 1'
        );
        $stmt->execute(['token_hash' => hash('sha256', $rawToken)]);
        $session = $stmt->fetch(PDO::FETCH_ASSOC);

        return $session === false ? null : $session;
    }

    public function revokeByToken(string $rawToken): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE auth_sessions SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = :token_hash AND revoked_at IS NULL'
        );
        $stmt->execute(['token_hash' => hash('sha256', $rawToken)]);
    }
}
