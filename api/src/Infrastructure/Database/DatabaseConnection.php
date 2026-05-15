<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Database;

use PDO;
use Worknest\Api\Application\Exceptions\ApiException;

final class DatabaseConnection
{
    private ?PDO $pdo = null;

    public function __construct(private readonly array $config)
    {
    }

    public function pdo(): PDO
    {
        if ($this->pdo instanceof PDO) {
            return $this->pdo;
        }

        $database = $this->config['database'];
        $this->assertDatabaseConfig($database);
        $dsn = sprintf(
            'mysql:host=%s;port=%s;dbname=%s;charset=%s',
            $database['host'],
            $database['port'],
            $database['name'],
            $database['charset']
        );

        $this->pdo = new PDO($dsn, $database['user'], $database['pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);

        return $this->pdo;
    }

    private function assertDatabaseConfig(array $database): void
    {
        $requiredKeys = [
            'host' => 'DB_HOST',
            'name' => 'DB_NAME',
            'user' => 'DB_USER or DB_USERNAME',
            'pass' => 'DB_PASS or DB_PASSWORD',
        ];

        $missing = [];

        foreach ($requiredKeys as $configKey => $envHint) {
            if (!array_key_exists($configKey, $database) || $database[$configKey] === null) {
                $missing[] = $envHint;
            }
        }

        if ($missing === []) {
            return;
        }

        throw new ApiException(
            'DATABASE_CONFIG_ERROR',
            'Database configuration is incomplete.',
            500,
            ['missing' => $missing]
        );
    }
}
