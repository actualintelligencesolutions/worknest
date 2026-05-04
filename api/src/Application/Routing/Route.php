<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Routing;

final class Route
{
    public function __construct(
        private readonly string $method,
        private readonly string $pattern,
        private readonly mixed $handler
    ) {
    }

    public function method(): string
    {
        return $this->method;
    }

    public function pattern(): string
    {
        return $this->pattern;
    }

    public function handler(): mixed
    {
        return $this->handler;
    }
}
