<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Infrastructure\Repositories\PlanRepositoryInterface;

final class SystemController extends BaseController
{
    public function __construct(
        private readonly array $config,
        private readonly PlanRepositoryInterface $planRepository
    ) {
    }

    public function health(Request $request): Response
    {
        return Response::success([
            'status' => 'ok',
            'service' => 'api',
            'environment' => $this->config['project']['environment']['active_environment'] ?? 'local',
        ]);
    }

    public function endpoints(Request $request): Response
    {
        $contents = file_get_contents(dirname(__DIR__, 3) . '/endpoints.registry.json');
        $registry = $contents !== false ? json_decode($contents, true) : ['endpoints' => []];
        $query = strtolower(trim((string) $request->query('query', '')));
        $matches = $registry['endpoints'] ?? [];

        if ($query !== '') {
            $matches = array_values(array_filter($matches, static function (array $endpoint) use ($query): bool {
                $haystack = strtolower(implode(' ', [
                    $endpoint['id'] ?? '',
                    $endpoint['method'] ?? '',
                    $endpoint['path'] ?? '',
                    $endpoint['purpose'] ?? '',
                ]));
                foreach (explode(' ', $query) as $term) {
                    if ($term !== '' && str_contains($haystack, $term)) {
                        return true;
                    }
                }
                return false;
            }));
        }

        return Response::success([
            'matches' => $matches,
            'reuse_prompt' => count($matches) > 0
                ? 'There is already an endpoint that may satisfy this request.'
                : 'No endpoint matched this request. Define the registry entry before implementation.',
        ]);
    }

    public function plans(Request $request): Response
    {
        return Response::success(['plans' => $this->planRepository->allActive()]);
    }
}
