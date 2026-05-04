<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Support;

use Throwable;
use Worknest\Api\Application\Exceptions\ApiException;
use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;
use Worknest\Api\Application\Middleware\MiddlewarePipeline;
use Worknest\Api\Application\Routing\Router;
use Worknest\Api\Presentation\Responses\ApiExceptionHandler;

final class App
{
    public function __construct(
        private readonly Router $router,
        private readonly MiddlewarePipeline $pipeline,
        private readonly ApiExceptionHandler $exceptionHandler
    ) {
    }

    public function handle(Request $request): Response
    {
        try {
            $result = $this->pipeline->process($request, fn (Request $req) => $this->router->dispatch($req));

            if ($result instanceof Response) {
                return $result;
            }

            return Response::success($result);
        } catch (ApiException $exception) {
            return $this->exceptionHandler->handleApiException($exception);
        } catch (Throwable $exception) {
            return $this->exceptionHandler->handleThrowable($exception);
        }
    }
}
