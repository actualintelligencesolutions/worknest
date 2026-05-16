<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Auth\OtpService;
use Worknest\Api\Domain\Office\OfficeService;
use Worknest\Api\Domain\Tenant\TenantResolver;
use Worknest\Api\Domain\Tenant\TenantService;

final class TenantController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly OtpService $otpService,
        private readonly TenantResolver $tenantResolver,
        private readonly TenantService $tenantService,
        private readonly OfficeService $officeService
    ) {
    }

    public function create(Request $request): Response
    {
        return Response::success($this->authService->registerCompany($request->body()), 201);
    }

    public function checkSlug(Request $request): Response
    {
        $tenantId = strtolower(trim((string) $request->query('tenant_id', '')));
        return Response::success($this->authService->checkWorkspaceAvailability($tenantId));
    }

    public function detail(Request $request): Response
    {
        $tenantId = (string) $request->attribute('tenantId');
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->tenantService->getTenant($tenantId, $actor));
    }

    public function update(Request $request): Response
    {
        $tenantId = (string) $request->attribute('tenantId');
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->tenantService->updateTenant($tenantId, $actor, $request->body()));
    }

    public function createMainOffice(Request $request): Response
    {
        $tenantId = (string) $request->attribute('tenantId');
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        return Response::success($this->officeService->createMainOffice($tenantId, $actor, $request->body()), 201);
    }

    public function createOtpChallenge(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner']);
        $body = $request->body();
        $channel = strtolower(trim((string) ($body['channel'] ?? 'email')));
        $destination = strtolower(trim((string) ($body['destination'] ?? $actor['email'] ?? '')));

        if ($channel !== 'email' || $destination === '') {
            return Response::error('UNSUPPORTED_OTP_CHANNEL', 'Only email OTP challenges are supported in MVP.', 422);
        }

        return Response::success([
            'challenge' => $this->otpService->createAdminVerificationChallenge(
                $tenantId,
                (int) $actor['id'],
                $destination,
                (string) ($body['context_name'] ?? 'Worknest')
            ),
        ], 201);
    }

    public function verifyOtp(Request $request): Response
    {
        $body = $request->body();
        return Response::success([
            'verification' => $this->authService->verifyAdminOtp(
                (int) ($body['challenge_id'] ?? 0),
                trim((string) ($body['otp_code'] ?? ''))
            ),
        ]);
    }
}
