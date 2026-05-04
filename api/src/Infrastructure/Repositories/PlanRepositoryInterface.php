<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Repositories;

interface PlanRepositoryInterface
{
    public function allActive(): array;

    public function findActiveById(int $planId): ?array;
}
