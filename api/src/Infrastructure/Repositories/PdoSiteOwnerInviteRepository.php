<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

use PDO;
use Worknest\Api\Infrastructure\Database\DatabaseConnection;

final class PdoSiteOwnerInviteRepository implements SiteOwnerInviteRepositoryInterface
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function create(array $payload): int
    {
        $stmt = $this->connection->pdo()->prepare(
            'INSERT INTO site_owner_invites (
                tenant_id, office_id, invited_email, invited_name, invited_role, token_hash,
                status, invited_by_user_id, expires_at
             ) VALUES (
                :tenant_id, :office_id, :invited_email, :invited_name, :invited_role, :token_hash,
                :status, :invited_by_user_id, :expires_at
             )'
        );
        $stmt->execute([
            'tenant_id' => $payload['tenant_id'],
            'office_id' => $payload['office_id'],
            'invited_email' => $payload['invited_email'],
            'invited_name' => $payload['invited_name'] ?? null,
            'invited_role' => $payload['invited_role'] ?? 'site_owner',
            'token_hash' => $payload['token_hash'],
            'status' => $payload['status'] ?? 'pending',
            'invited_by_user_id' => $payload['invited_by_user_id'],
            'expires_at' => $payload['expires_at'],
        ]);

        return (int) $this->connection->pdo()->lastInsertId();
    }

    public function findById(int $id, string $tenantId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT soi.*, o.name AS office_name, o.office_code, t.name AS tenant_name
             FROM site_owner_invites soi
             JOIN offices o ON o.id = soi.office_id
             JOIN tenants t ON t.tenant_id = soi.tenant_id
             WHERE soi.id = :id AND soi.tenant_id = :tenant_id
             LIMIT 1'
        );
        $stmt->execute([
            'id' => $id,
            'tenant_id' => $tenantId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function findLatestPendingByOffice(string $tenantId, int $officeId): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT soi.*, o.name AS office_name, o.office_code, t.name AS tenant_name
             FROM site_owner_invites soi
             JOIN offices o ON o.id = soi.office_id
             JOIN tenants t ON t.tenant_id = soi.tenant_id
             WHERE soi.tenant_id = :tenant_id
               AND soi.office_id = :office_id
               AND soi.status = "pending"
             ORDER BY soi.id DESC
             LIMIT 1'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function findPendingByTokenHash(string $tokenHash): ?array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT soi.*, o.name AS office_name, o.office_code, t.name AS tenant_name
             FROM site_owner_invites soi
             JOIN offices o ON o.id = soi.office_id
             JOIN tenants t ON t.tenant_id = soi.tenant_id
             WHERE soi.token_hash = :token_hash
               AND soi.status = "pending"
             LIMIT 1'
        );
        $stmt->execute(['token_hash' => $tokenHash]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row === false ? null : $row;
    }

    public function listByOffice(string $tenantId, int $officeId): array
    {
        $stmt = $this->connection->pdo()->prepare(
            'SELECT soi.*, o.name AS office_name, o.office_code, t.name AS tenant_name
             FROM site_owner_invites soi
             JOIN offices o ON o.id = soi.office_id
             JOIN tenants t ON t.tenant_id = soi.tenant_id
             WHERE soi.tenant_id = :tenant_id
               AND soi.office_id = :office_id
             ORDER BY soi.id DESC'
        );
        $stmt->execute([
            'tenant_id' => $tenantId,
            'office_id' => $officeId,
        ]);

        return $stmt->fetchAll();
    }

    public function markAccepted(int $inviteId, int $acceptedByUserId): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE site_owner_invites
             SET status = "accepted",
                 accepted_by_user_id = :accepted_by_user_id,
                 accepted_at = CURRENT_TIMESTAMP,
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $inviteId,
            'accepted_by_user_id' => $acceptedByUserId,
        ]);
    }

    public function updateStatus(int $inviteId, string $status): void
    {
        $stmt = $this->connection->pdo()->prepare(
            'UPDATE site_owner_invites
             SET status = :status, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id'
        );
        $stmt->execute([
            'id' => $inviteId,
            'status' => $status,
        ]);
    }
}
