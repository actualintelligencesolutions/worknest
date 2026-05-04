<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Office\OfficeService;
use Worknest\Api\Domain\Tenant\TenantResolver;

final class OfficeController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly TenantResolver $tenantResolver,
        private readonly OfficeService $officeService
    ) {
    }

    public function list(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        $payload = $this->officeService->listOffices($tenantId, $actor);

        if ($request->path() === '/locations') {
            return Response::success([
                'locations' => $payload['locations'],
                'summary' => $payload['summary'],
            ]);
        }

        return Response::success($payload);
    }

    public function detail(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->officeService->getOffice((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function createMainOffice(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->officeService->createMainOffice($tenantId, $actor, $request->body()), 201);
    }

    public function createBranch(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->officeService->createBranch($tenantId, $actor, $request->body()), 201);
    }

    public function update(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->officeService->updateOffice((int) $request->attribute('id'), $tenantId, $actor, $request->body()));
    }

    public function assignPlan(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        $body = $request->body();
        return Response::success($this->officeService->assignPlan(
            (int) $request->attribute('id'),
            $tenantId,
            $actor,
            (int) ($body['plan_id'] ?? 0),
            isset($body['starts_on']) ? (string) $body['starts_on'] : null
        ));
    }

    public function assignAdmins(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        $body = $request->body();
        return Response::success($this->officeService->assignAdmins(
            (int) $request->attribute('id'),
            $tenantId,
            $actor,
            array_map('intval', (array) ($body['user_ids'] ?? []))
        ));
    }
}
