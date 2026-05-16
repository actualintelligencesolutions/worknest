<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Domain\Auth\AuthService;
use Worknest\Api\Domain\Tenant\TenantResolver;
use Worknest\Api\Domain\User\UserService;

final class UserController extends BaseController
{
    public function __construct(
        private readonly AuthService $authService,
        private readonly TenantResolver $tenantResolver,
        private readonly UserService $userService
    ) {
    }

    public function create(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->userService->createUser($tenantId, $actor, $request->body()), 201);
    }

    public function list(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        $payload = $this->userService->listUsers($tenantId, $actor, [
            'office_id' => $request->query('office_id'),
            'user_type' => $request->query('user_type'),
        ]);

        if ($this->isV2($request)) {
            return Response::success($payload);
        }

        if ($request->path() === '/employees') {
            return Response::success(['employees' => $payload['users']]);
        }

        return Response::success($payload);
    }

    public function detail(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->userService->getUser((int) $request->attribute('id'), $tenantId, $actor));
    }

    public function update(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        return Response::success($this->userService->updateUser((int) $request->attribute('id'), $tenantId, $actor, $request->body()));
    }

    public function resetPin(Request $request): Response
    {
        $tenantId = (string) $this->tenantResolver->fromRequest($request);
        $actor = $this->authService->requireActor($this->bearerToken($request), $tenantId, ['tenant_owner', 'branch_admin']);
        $body = $request->body();
        return Response::success($this->userService->resetPin(
            (int) $request->attribute('id'),
            $tenantId,
            $actor,
            (string) ($body['pin'] ?? '')
        ));
    }
}
