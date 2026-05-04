<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Database;

use Throwable;

final class TransactionManager
{
    public function __construct(private readonly DatabaseConnection $connection)
    {
    }

    public function run(callable $callback): mixed
    {
        $pdo = $this->connection->pdo();
        $pdo->beginTransaction();

        try {
            $result = $callback($pdo);
            $pdo->commit();
            return $result;
        } catch (Throwable $exception) {
            if ($pdo->inTransaction()) {
                $pdo->rollBack();
            }

            throw $exception;
        }
    }
}
