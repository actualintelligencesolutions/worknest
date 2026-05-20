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
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        $payload = $this->officeService->listOffices($tenantId, $actor);

        if ($this->isV2($request)) {
            return Response::success([
                'offices' => $payload['offices'],
                'summary' => $payload['summary'],
            ]);
        }

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
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        $payload = $this->officeService->getOffice((int) $request->attribute('id'), $tenantId, $actor);
        return Response::success($this->isV2($request) ? $this->canonicalOfficePayload($payload) : $payload);
    }

    public function sitePortal(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $officeCode = strtoupper(trim((string) ($request->query('office_code', ''))));
        return Response::success($this->officeService->getSitePortal($tenantId, $officeCode));
    }

    public function createMainOffice(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        $payload = $this->officeService->createMainOffice($tenantId, $actor, array_merge($request->body(), [
            '_logo_file' => $request->file('logo'),
        ]));
        return Response::success($this->isV2($request) ? $this->canonicalOfficePayload($payload) : $payload, 201);
    }

    public function createBranch(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        $payload = $this->officeService->createBranch($tenantId, $actor, array_merge($request->body(), [
            '_logo_file' => $request->file('logo'),
        ]));
        return Response::success($this->isV2($request) ? $this->canonicalOfficePayload($payload) : $payload, 201);
    }

    public function create(Request $request): Response
    {
        $body = $request->body();
        $officeType = (string) ($body['office_type'] ?? 'branch');
        return $officeType === 'main_office'
            ? $this->createMainOffice($request)
            : $this->createBranch($request);
    }

    public function update(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
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

    public function listPlans(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->officeService->listPlanAssignments(
            (int) $request->attribute('id'),
            $tenantId,
            $actor
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

    public function inviteSiteOwner(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->officeService->inviteSiteOwner(
            (int) $request->attribute('id'),
            $tenantId,
            $actor,
            $request->body()
        ), 201);
    }

    public function resendSiteOwnerInvite(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->officeService->resendSiteOwnerInvite(
            (int) $request->attribute('id'),
            (int) $request->attribute('inviteId'),
            $tenantId,
            $actor
        ));
    }

    public function cancelSiteOwnerInvite(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->officeService->cancelSiteOwnerInvite(
            (int) $request->attribute('id'),
            (int) $request->attribute('inviteId'),
            $tenantId,
            $actor
        ));
    }

    public function inviteAcceptanceDetail(Request $request): Response
    {
        $token = trim((string) $request->query('token', ''));
        return Response::success($this->officeService->getSiteOwnerInviteByToken($token));
    }

    public function acceptSiteOwnerInvite(Request $request): Response
    {
        $body = $request->body();
        return Response::success($this->officeService->acceptSiteOwnerInvite(
            trim((string) ($body['token'] ?? '')),
            $body
        ));
    }

    private function canonicalOfficePayload(array $payload): array
    {
        unset($payload['location']);
        return $payload;
    }
}
