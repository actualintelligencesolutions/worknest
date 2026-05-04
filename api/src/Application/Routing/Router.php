<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Routing;

use Worknest\Api\Application\Exceptions\NotFoundException;
use Worknest\Api\Application\Http\Request;

final class Router
{
    /**
     * @var Route[]
     */
    private array $routes = [];

    public function add(string $method, string $pattern, mixed $handler): void
    {
        $this->routes[] = new Route(strtoupper($method), $pattern, $handler);
    }

    public function dispatch(Request $request): mixed
    {
        foreach ($this->routes as $route) {
            if ($route->method() !== $request->method()) {
                continue;
            }

            $pattern = '#^' . preg_replace('#\{([a-zA-Z_][a-zA-Z0-9_]*)\}#', '(?P<$1>[^/]+)', $route->pattern()) . '$#';
            if (preg_match($pattern, $request->path(), $matches) !== 1) {
                continue;
            }

            foreach ($matches as $key => $value) {
                if (!is_int($key)) {
                    $request->setAttribute($key, $value);
                }
            }

            return ($route->handler())($request);
        }

        throw new NotFoundException();
    }
}
