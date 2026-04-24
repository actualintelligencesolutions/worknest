<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/config/project-config.php';

function dam_env(string $key, ?string $default = null): ?string
{
    $value = getenv($key);

    return $value === false ? $default : $value;
}

return [
    'project' => [
        'environment' => project_environment_config(),
        'tenants' => project_tenant_configs(),
    ],
    'dev_key' => dam_env('DAM_DEV_KEY', 'change-me'),
    'max_upload_bytes' => (int) dam_env('MAX_UPLOAD_BYTES', '10485760'),
    'storage_root' => __DIR__ . '/dam',
    'log_file' => __DIR__ . '/logs/actions.log',
    'database' => [
        'host' => dam_env('DB_HOST', '127.0.0.1'),
        'port' => dam_env('DB_PORT', '3306'),
        'name' => dam_env('DB_NAME', 'template_database'),
        'user' => dam_env('DB_USER', 'root'),
        'pass' => dam_env('DB_PASS', ''),
        'charset' => dam_env('DB_CHARSET', 'utf8mb4'),
    ],
];
