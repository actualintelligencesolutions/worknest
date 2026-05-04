<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Middleware;

use Worknest\Api\Application\Http\Request;

final class MiddlewarePipeline
{
    /**
     * @param array<int, callable> $middleware
     */
    public function __construct(private readonly array $middleware = [])
    {
    }

    public function process(Request $request, callable $destination): mixed
    {
        $next = array_reduce(
            array_reverse($this->middleware),
            static fn (callable $stack, callable $current): callable => static fn (Request $req) => $current($req, $stack),
            $destination
        );

        return $next($request);
    }
}
