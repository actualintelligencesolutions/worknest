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
