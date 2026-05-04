<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Support;

use RuntimeException;

final class Container
{
    private array $bindings = [];
    private array $instances = [];

    public function set(string $id, callable $factory): void
    {
        $this->bindings[$id] = $factory;
    }

    public function singleton(string $id, callable $factory): void
    {
        $this->bindings[$id] = function (self $container) use ($factory, $id) {
            if (!array_key_exists($id, $this->instances)) {
                $this->instances[$id] = $factory($container);
            }

            return $this->instances[$id];
        };
    }

    public function get(string $id): mixed
    {
        if (!isset($this->bindings[$id])) {
            throw new RuntimeException('Container binding not found: ' . $id);
        }

        return $this->bindings[$id]($this);
    }
}
