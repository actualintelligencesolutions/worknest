<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Payslip\PayslipService;
use Worknest\Api\Domain\Tenant\TenantResolver;

final class PayslipController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly TenantResolver $tenantResolver,
        private readonly PayslipService $payslipService
    ) {
    }

    public function list(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner', 'employee']);
        return Response::success($this->payslipService->listPayslips($tenantId, $actor));
    }

    public function detail(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner', 'employee']);
        return Response::success($this->payslipService->getPayslip((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function download(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner', 'employee']);
        $payload = $this->payslipService->downloadPayslip((int) $request->attribute('id'), $tenantId, $actor);

        return Response::binary($payload['content'], 'application/pdf', $payload['filename']);
    }
}
