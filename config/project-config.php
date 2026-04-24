<?php

declare(strict_types=1);

function project_config_read_json(string $path, array $fallback = []): array
{
    if (!is_file($path)) {
        return $fallback;
    }

    $contents = file_get_contents($path);
    if ($contents === false) {
        return $fallback;
    }

    $data = json_decode($contents, true);

    return is_array($data) ? $data : $fallback;
}

function project_config_root(): string
{
    return __DIR__;
}

function project_load_env_file(string $path, bool $override = false): void
{
    if (!is_file($path) || !is_readable($path)) {
        return;
    }

    $lines = file($path, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    if ($lines === false) {
        return;
    }

    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || $line[0] === '#' || strpos($line, '=') === false) {
            continue;
        }

        [$key, $value] = explode('=', $line, 2);
        $key = trim($key);
        if ($key === '' || (!$override && project_env_value($key) !== null)) {
            continue;
        }

        $value = trim($value);
        if (
            strlen($value) >= 2
            && (($value[0] === '"' && $value[-1] === '"') || ($value[0] === "'" && $value[-1] === "'"))
        ) {
            $value = substr($value, 1, -1);
        }

        if (function_exists('putenv')) {
            putenv($key . '=' . $value);
        }
        $_ENV[$key] = $value;
        $_SERVER[$key] = $value;
    }
}

function project_env_value(string $key, ?string $default = null): ?string
{
    $value = getenv($key);
    if ($value !== false) {
        return $value;
    }

    if (array_key_exists($key, $_ENV)) {
        return (string) $_ENV[$key];
    }

    if (array_key_exists($key, $_SERVER)) {
        return (string) $_SERVER[$key];
    }

    return $default;
}

function project_environment_config(): array
{
    return project_config_read_json(project_config_root() . '/environments.json', [
        'active_environment' => 'local',
        'environments' => [],
        'paths' => [
            'ui_dist' => 'ui/dist',
            'api_base' => '/api',
            'dam_asset_base' => '/dam',
        ],
    ]);
}

function project_tenant_configs(): array
{
    $tenants = [];
    $files = glob(project_config_root() . '/tenants/*.json') ?: [];

    foreach ($files as $file) {
        $tenant = project_config_read_json($file);
        $tenantId = $tenant['tenant_id'] ?? null;

        if (is_string($tenantId) && $tenantId !== '') {
            $tenants[$tenantId] = $tenant;
        }
    }

    return $tenants;
}

function project_tenant_config(string $tenantId = 'default'): array
{
    $tenants = project_tenant_configs();

    return $tenants[$tenantId] ?? $tenants['default'] ?? [];
}
