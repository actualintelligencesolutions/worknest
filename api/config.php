<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/project-config.php';

project_load_env_file(__DIR__ . '/.env', true);

function api_env(string $key, ?string $default = null): ?string
{
    return project_env_value($key, $default);
}

return [
    'app' => [
        'frontend_url' => api_env('APP_FRONTEND_URL', 'https://preview.worknestapp.com'),
    ],
    'project' => [
        'environment' => project_environment_config(),
        'tenants' => project_tenant_configs(),
    ],
    'database' => [
        'host' => project_env_first(['DB_HOST', 'DATABASE_HOST'], '127.0.0.1'),
        'port' => project_env_first(['DB_PORT', 'DATABASE_PORT'], '3306'),
        'name' => project_env_first(['DB_NAME', 'DATABASE_NAME'], 'template_database'),
        'user' => project_env_first(['DB_USER', 'DB_USERNAME', 'DATABASE_USER', 'DATABASE_USERNAME']),
        'pass' => project_env_first(['DB_PASS', 'DB_PASSWORD', 'DATABASE_PASS', 'DATABASE_PASSWORD']),
        'charset' => project_env_first(['DB_CHARSET', 'DATABASE_CHARSET'], 'utf8mb4'),
    ],
];
