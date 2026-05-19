<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Tenant;

use Worknest\Api\Application\Exceptions\ValidationException;
use Worknest\Api\Application\Http\Request;

final class TenantResolver
{
    public function fromRequest(Request $request, bool $required = true): ?string
    {
        $tenantId = trim((string) ($request->query('tenant') ?? $request->header('X-TENANT-ID', '')));
        if ($tenantId === '') {
            $body = $request->body();
            $tenantId = trim((string) ($body['tenant_id'] ?? $body['tenant'] ?? $body['workspace'] ?? ''));
        }

        if ($tenantId === '') {
            if ($required) {
                throw new ValidationException('Tenant must be a non-empty slug containing only letters, numbers, hyphens, or underscores.');
            }

            return null;
        }

        if (preg_match('/^[a-zA-Z0-9_-]+$/', $tenantId) !== 1) {
            throw new ValidationException('Tenant must be a non-empty slug containing only letters, numbers, hyphens, or underscores.');
        }

        return $tenantId;
    }
}
