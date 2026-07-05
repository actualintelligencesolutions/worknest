<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Payroll\PayrollService;
use Worknest\Api\Domain\Tenant\TenantResolver;

final class PayrollController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly TenantResolver $tenantResolver,
        private readonly PayrollService $payrollService
    ) {
    }

    public function upload(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->uploadBatch(
            $tenantId,
            $actor,
            [
                'office_id' => $request->post('office_id'),
                'period_month' => $request->post('period_month'),
                'period_year' => $request->post('period_year'),
            ],
            $request->file('file') ?? $request->file('payroll_file') ?? []
        ), 201);
    }

    public function list(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->listBatches($tenantId, $actor, [
            'office_id' => $request->query('office_id'),
        ]));
    }

    public function detail(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);

        return Response::success(
            $this->payrollService->getBatchDetail((int) $request->attribute('id'), $tenantId, $actor)
        );
    }

    public function mapping(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->saveMapping(
            (int) $request->attribute('id'),
            $tenantId,
            $actor,
            (array) ($request->body()['mapping'] ?? [])
        ));
    }

    public function validate(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->validateBatch((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function confirm(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->confirmBatch((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function importMissingEmployees(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success(
            $this->payrollService->importMissingEmployees((int) $request->attribute('id'), $tenantId, $actor)
        );
    }

    public function publish(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->publishBatch((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function unpublish(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin', 'site_owner']);
        return Response::success($this->payrollService->unpublishBatch((int) $request->attribute('id'), $tenantId, $actor));
    }
}
