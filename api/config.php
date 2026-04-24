<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/project-config.php';

project_load_env_file(__DIR__ . '/.env');

function api_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    return $value === false ? $default : $value;
}

return [
    'project' => [
        'environment' => project_environment_config(),
        'tenants' => project_tenant_configs(),
    ],
    'database' => [
        'host' => api_env('DB_HOST', '127.0.0.1'),
        'port' => api_env('DB_PORT', '3306'),
        'name' => api_env('DB_NAME', 'template_database'),
        'user' => api_env('DB_USER', 'root'),
        'pass' => api_env('DB_PASS', ''),
        'charset' => api_env('DB_CHARSET', 'utf8mb4'),
    ],
];
