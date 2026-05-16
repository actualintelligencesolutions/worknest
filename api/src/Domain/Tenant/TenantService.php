<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Tenant;

use Worknest\Api\Application\Exceptions\ForbiddenException;
use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Domain\Audit\AuditLogger;
use Worknest\Api\Infrastructure\Repositories\TenantRepositoryInterface;

final class TenantService
{
    public function __construct(
        private readonly TenantRepositoryInterface $tenantRepository,
        private readonly AuditLogger $auditLogger
    ) {
    }

    public function getTenant(string $tenantId, array $actor): array
    {
        $this->assertTenantOwner($tenantId, $actor);

        $tenant = $this->tenantRepository->findByTenantId($tenantId);
        if ($tenant === null) {
            throw new NotFoundException('Tenant not found.');
        }

        return ['tenant' => $tenant];
    }

    public function updateTenant(string $tenantId, array $actor, array $payload): array
    {
        $this->assertTenantOwner($tenantId, $actor);

        $allowed = [];
        if (array_key_exists('name', $payload)) {
            $name = trim((string) $payload['name']);
            if ($name === '') {
                throw new ValidationException('Tenant name cannot be empty.');
            }
            $allowed['name'] = $name;
        }

        if (array_key_exists('legal_name', $payload)) {
            $allowed['legal_name'] = trim((string) $payload['legal_name']) ?: null;
        }

        if (array_key_exists('onboarding_status', $payload)) {
            $allowed['onboarding_status'] = (string) $payload['onboarding_status'];
        }

        $tenant = $this->tenantRepository->update($tenantId, $allowed);
        if ($tenant === null) {
            throw new NotFoundException('Tenant not found.');
        }

        $this->auditLogger->log($tenantId, null, (int) $actor['id'], 'tenant.updated', 'tenant', $tenantId, array_keys($allowed));

        return ['tenant' => $tenant];
    }

    private function assertTenantOwner(string $tenantId, array $actor): void
    {
        if (($actor['tenant_id'] ?? null) !== $tenantId || ($actor['user_type'] ?? '') !== 'tenant_owner') {
            throw new ForbiddenException();
        }
    }
}
