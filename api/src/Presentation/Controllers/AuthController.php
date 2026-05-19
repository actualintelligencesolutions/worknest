<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Tenant\TenantResolver;

final class AuthController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly TenantResolver $tenantResolver
    ) {
    }

    public function registerCompany(Request $request): Response
    {
        return Response::success($this->authService->registerCompany($request->body()), 201);
    }

    public function checkWorkspace(Request $request): Response
    {
        $tenantId = strtolower(trim((string) $request->query('tenant_id', '')));
        return Response::success($this->authService->checkWorkspaceAvailability($tenantId));
    }

    public function verifyAdminOtp(Request $request): Response
    {
        $body = $request->body();
        return Response::success(
            $this->authService->verifyAdminOtp(
                (int) ($body['challenge_id'] ?? 0),
                trim((string) ($body['otp_code'] ?? ''))
            )
        );
    }

    public function ownerLogin(Request $request): Response
    {
        $tenantId = $this->tenantResolver->fromRequest($request);
        $body = $request->body();
        $payload = $this->authService->loginOwner(
            (string) $tenantId,
            (string) ($body['email'] ?? ''),
            (string) ($body['password'] ?? '')
        );

        return Response::success($this->isV2($request) ? $this->adminLoginPayload($payload) : $payload);
    }

    public function branchLogin(Request $request): Response
    {
        $tenantId = $this->tenantResolver->fromRequest($request);
        $body = $request->body();
        $payload = $this->authService->loginBranchAdmin(
            (string) $tenantId,
            (string) ($body['email'] ?? ''),
            (string) ($body['password'] ?? '')
        );

        return Response::success($this->isV2($request) ? $this->adminLoginPayload($payload) : $payload);
    }

    public function adminLogin(Request $request): Response
    {
        $tenantId = $this->tenantResolver->fromRequest($request);
        $body = $request->body();
        $payload = $this->authService->loginHrAdmin(
            (string) $tenantId,
            (string) ($body['email'] ?? ''),
            (string) ($body['password'] ?? '')
        );

        return Response::success($this->isV2($request) ? $this->adminLoginPayload($payload) : $payload);
    }

    public function hrLogin(Request $request): Response
    {
        return $this->adminLogin($request);
    }

    public function employeeLogin(Request $request): Response
    {
        $tenantId = $this->tenantResolver->fromRequest($request);
        $body = $request->body();
        $officeCode = strtoupper(trim((string) ($request->query('office_code', ''))));
        $payload = $officeCode !== ''
            ? $this->authService->loginEmployeeForOffice(
                (string) $tenantId,
                $officeCode,
                (string) ($body['phone'] ?? ''),
                (string) ($body['pin'] ?? '')
            )
            : $this->authService->loginEmployee(
                (string) $tenantId,
                (string) ($body['phone'] ?? ''),
                (string) ($body['pin'] ?? '')
            );

        if (!$this->isV2($request)) {
            return Response::success($payload);
        }

        return Response::success([
            'actor' => $payload['user'],
            'tenant' => $payload['tenant'],
            'session' => $payload['session'],
        ]);
    }

    public function logout(Request $request): Response
    {
        return Response::success($this->authService->logout($this->bearerToken($request)));
    }

    public function me(Request $request): Response
    {
        $tenantId = $this->tenantResolver->fromRequest($request);
        $payload = $this->authService->currentActor($this->bearerToken($request), $tenantId);

        if (!$this->isV2($request)) {
            return Response::success($payload);
        }

        return Response::success([
            'actor' => $payload['actor'],
            'tenant' => ['tenant_id' => $tenantId],
        ]);
    }

    private function adminLoginPayload(array $payload): array
    {
        return [
            'actor' => $payload['user'],
            'tenant' => $payload['tenant'],
            'session' => $payload['session'],
        ];
    }
}
