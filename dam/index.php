<?php

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

function json_response(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function success_response(mixed $data = null, int $status = 200): void
{
    json_response(['success' => true, 'data' => $data, 'error' => null], $status);
}

function error_response(string $code, string $message, int $status = 400, array $details = []): void
{
    json_response([
        'success' => false,
        'data' => null,
        'error' => [
            'code' => $code,
            'message' => $message,
            'details' => $details,
        ],
    ], $status);
}

function db(array $config): PDO
{
    static $pdo = null;

    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = $config['database'];
    $dsn = sprintf(
        'mysql:host=%s;port=%s;dbname=%s;charset=%s',
        $db['host'],
        $db['port'],
        $db['name'],
        $db['charset']
    );

    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function request_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = rtrim($path ?: '/', '/') ?: '/';

    if ($path === '/dam') {
        return '/';
    }

    if (str_starts_with($path, '/dam/')) {
        return substr($path, 4) ?: '/';
    }

    return $path;
}

function request_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function tenant_from_request(): string
{
    $tenant = $_GET['tenant'] ?? $_POST['tenant'] ?? ($_SERVER['HTTP_X_TENANT_ID'] ?? 'default');
    $tenant = trim((string) $tenant);

    if ($tenant === '' || !preg_match('/^[a-zA-Z0-9_-]+$/', $tenant)) {
        error_response('INVALID_TENANT', 'Tenant must be a non-empty slug containing only letters, numbers, hyphens, or underscores.', 422);
    }

    return $tenant;
}

function tenant_exists(array $config, string $tenant): bool
{
    $tenants = $config['project']['tenants'] ?? [];

    return isset($tenants[$tenant]);
}

function require_known_tenant(array $config, string $tenant): void
{
    if (!tenant_exists($config, $tenant)) {
        error_response('INVALID_TENANT', 'Tenant config was not found.', 404);
    }
}

function require_dev_key(array $config): void
{
    $provided = $_SERVER['HTTP_X_DEV_KEY'] ?? '';
    $expected = (string) $config['dev_key'];

    if ($expected === '' || !hash_equals($expected, (string) $provided)) {
        error_response('UNAUTHORIZED_DAM_ACCESS', 'A valid X-DEV-KEY header is required for this DAM operation.', 401);
    }
}

function log_action(array $config, string $action, array $context = []): void
{
    $line = json_encode([
        'at' => gmdate('c'),
        'action' => $action,
        'context' => $context,
    ], JSON_UNESCAPED_SLASHES);

    file_put_contents($config['log_file'], $line . PHP_EOL, FILE_APPEND);
}

function slugify(string $value): string
{
    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $value) ?? '', '-'));
    return $slug !== '' ? $slug : 'asset';
}

function asset_select_sql(string $extraWhere = ''): string
{
    return "SELECT id, tenant_id, folder_id, collection_id, parent_asset_id, original_filename,
        generated_filename, storage_path, storage_type, mime_type, file_size, title, alt_text,
        description, version, created_at, updated_at, deleted_at
        FROM assets
        WHERE deleted_at IS NULL {$extraWhere}";
}

function find_asset(PDO $pdo, int $id, string $tenant): ?array
{
    $stmt = $pdo->prepare(asset_select_sql('AND id = :id AND tenant_id = :tenant_id'));
    $stmt->execute(['id' => $id, 'tenant_id' => $tenant]);
    $asset = $stmt->fetch();

    return $asset === false ? null : $asset;
}

function generated_filename(string $originalFilename): string
{
    $extension = strtolower(pathinfo($originalFilename, PATHINFO_EXTENSION));
    $safeBase = slugify(pathinfo($originalFilename, PATHINFO_FILENAME));
    $unique = bin2hex(random_bytes(16));

    return $extension === '' ? "{$safeBase}-{$unique}" : "{$safeBase}-{$unique}.{$extension}";
}

function ensure_tenant_directory(array $config, string $tenant): string
{
    $directory = $config['storage_root'] . '/' . $tenant;

    if (!is_dir($directory) && !mkdir($directory, 0775, true)) {
        error_response('STORAGE_ERROR', 'Unable to create tenant asset directory.', 500);
    }

    return $directory;
}

function validate_upload(array $config, string $field = 'asset'): array
{
    if (!isset($_FILES[$field])) {
        error_response('MISSING_UPLOAD', "Expected uploaded file field '{$field}'.", 422);
    }

    $file = $_FILES[$field];

    if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        error_response('UPLOAD_FAILED', 'The uploaded file could not be processed.', 422, ['upload_error' => $file['error'] ?? null]);
    }

    if (($file['size'] ?? 0) <= 0) {
        error_response('EMPTY_UPLOAD', 'Uploaded file is empty.', 422);
    }

    if (($file['size'] ?? 0) > $config['max_upload_bytes']) {
        error_response('UPLOAD_TOO_LARGE', 'Uploaded file exceeds the configured maximum size.', 413, [
            'max_upload_bytes' => $config['max_upload_bytes'],
        ]);
    }

    return $file;
}

function mime_type_for_upload(array $file): string
{
    $detected = mime_content_type($file['tmp_name']);
    return $detected !== false ? $detected : 'application/octet-stream';
}

function create_asset_record(PDO $pdo, array $input): int
{
    $stmt = $pdo->prepare(
        'INSERT INTO assets (
            tenant_id, folder_id, collection_id, parent_asset_id, original_filename,
            generated_filename, storage_path, storage_type, mime_type, file_size,
            title, alt_text, description, version
        ) VALUES (
            :tenant_id, :folder_id, :collection_id, :parent_asset_id, :original_filename,
            :generated_filename, :storage_path, :storage_type, :mime_type, :file_size,
            :title, :alt_text, :description, :version
        )'
    );

    $stmt->execute($input);

    return (int) $pdo->lastInsertId();
}

function upload_asset(array $config, ?array $parentAsset = null): array
{
    require_dev_key($config);

    $tenant = tenant_from_request();
    require_known_tenant($config, $tenant);
    $file = validate_upload($config);
    $directory = ensure_tenant_directory($config, $tenant);
    $generated = generated_filename((string) $file['name']);
    $target = $directory . '/' . $generated;
    $relativePath = 'dam/' . $tenant . '/' . $generated;

    if (!move_uploaded_file($file['tmp_name'], $target)) {
        error_response('STORAGE_ERROR', 'Unable to move uploaded file into DAM storage.', 500);
    }

    $pdo = db($config);
    $version = $parentAsset === null ? 1 : ((int) $parentAsset['version'] + 1);
    $folderId = isset($_POST['folder_id']) && $_POST['folder_id'] !== '' ? (int) $_POST['folder_id'] : null;
    $collectionId = isset($_POST['collection_id']) && $_POST['collection_id'] !== '' ? (int) $_POST['collection_id'] : null;
    $assetId = create_asset_record($pdo, [
        'tenant_id' => $tenant,
        'folder_id' => $folderId,
        'collection_id' => $collectionId,
        'parent_asset_id' => $parentAsset['id'] ?? null,
        'original_filename' => (string) $file['name'],
        'generated_filename' => $generated,
        'storage_path' => $relativePath,
        'storage_type' => 'local',
        'mime_type' => mime_type_for_upload($file),
        'file_size' => (int) $file['size'],
        'title' => $_POST['title'] ?? null,
        'alt_text' => $_POST['alt_text'] ?? null,
        'description' => $_POST['description'] ?? null,
        'version' => $version,
    ]);
    $asset = find_asset($pdo, $assetId, $tenant);

    if ($asset === null) {
        error_response('ASSET_NOT_FOUND', 'Asset was stored but could not be read back from the database.', 500);
    }

    log_action($config, $parentAsset === null ? 'asset.uploaded' : 'asset.version_created', [
        'tenant' => $tenant,
        'asset_id' => $assetId,
        'parent_asset_id' => $parentAsset['id'] ?? null,
    ]);

    return $asset;
}

function parse_json_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        error_response('INVALID_JSON', 'Request body must be valid JSON.', 422);
    }

    return $data;
}

function asset_id_from_path(string $path, string $pattern): ?int
{
    if (preg_match($pattern, $path, $matches) !== 1) {
        return null;
    }

    return (int) $matches[1];
}

try {
    $method = request_method();
    $path = request_path();

    if ($method === 'GET' && $path === '/health') {
        success_response([
            'status' => 'ok',
            'service' => 'dam',
            'environment' => $config['project']['environment']['active_environment'] ?? 'local',
        ]);
    }

    if ($method === 'GET' && $path === '/') {
        header('Content-Type: text/html; charset=UTF-8');
        echo '<!doctype html><html><head><title>Developer DAM</title></head><body>';
        echo '<h1>Developer DAM Manager</h1>';
        echo '<p>Use the JSON endpoints documented in dam/README.md.</p>';
        echo '</body></html>';
        exit;
    }

    if ($method === 'GET' && $path === '/assets') {
        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $stmt = db($config)->prepare(asset_select_sql('AND tenant_id = :tenant_id ORDER BY created_at DESC'));
        $stmt->execute(['tenant_id' => $tenant]);
        success_response(['assets' => $stmt->fetchAll()]);
    }

    if ($method === 'POST' && $path === '/assets') {
        success_response(upload_asset($config), 201);
    }

    $assetId = asset_id_from_path($path, '#^/assets/([0-9]+)$#');
    if ($assetId !== null && $method === 'GET') {
        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $asset = find_asset(db($config), $assetId, $tenant);

        if ($asset === null) {
            error_response('ASSET_NOT_FOUND', 'No asset exists for this tenant and id.', 404);
        }

        success_response($asset);
    }

    if ($assetId !== null && $method === 'PUT') {
        require_dev_key($config);

        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $body = parse_json_body();
        $asset = find_asset(db($config), $assetId, $tenant);

        if ($asset === null) {
            error_response('ASSET_NOT_FOUND', 'No asset exists for this tenant and id.', 404);
        }

        $stmt = db($config)->prepare(
            'UPDATE assets
             SET title = :title, alt_text = :alt_text, description = :description, updated_at = CURRENT_TIMESTAMP
             WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute([
            'id' => $assetId,
            'tenant_id' => $tenant,
            'title' => $body['title'] ?? $asset['title'],
            'alt_text' => $body['alt_text'] ?? $asset['alt_text'],
            'description' => $body['description'] ?? $asset['description'],
        ]);

        log_action($config, 'asset.metadata_updated', ['tenant' => $tenant, 'asset_id' => $assetId]);
        success_response(find_asset(db($config), $assetId, $tenant));
    }

    if ($assetId !== null && $method === 'DELETE') {
        require_dev_key($config);

        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $stmt = db($config)->prepare(
            'UPDATE assets SET deleted_at = CURRENT_TIMESTAMP WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL'
        );
        $stmt->execute(['id' => $assetId, 'tenant_id' => $tenant]);

        if ($stmt->rowCount() === 0) {
            error_response('ASSET_NOT_FOUND', 'No asset exists for this tenant and id.', 404);
        }

        log_action($config, 'asset.deleted', ['tenant' => $tenant, 'asset_id' => $assetId]);
        success_response(['deleted' => true, 'asset_id' => $assetId]);
    }

    $versionAssetId = asset_id_from_path($path, '#^/assets/([0-9]+)/versions$#');
    if ($versionAssetId !== null && $method === 'POST') {
        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $parentAsset = find_asset(db($config), $versionAssetId, $tenant);

        if ($parentAsset === null) {
            error_response('ASSET_NOT_FOUND', 'No asset exists for this tenant and id.', 404);
        }

        success_response(upload_asset($config, $parentAsset), 201);
    }

    $fileAssetId = asset_id_from_path($path, '#^/assets/([0-9]+)/file$#');
    $publicFileAssetId = asset_id_from_path($path, '#^/([0-9]+)$#');
    $streamAssetId = $fileAssetId ?? $publicFileAssetId;
    if ($streamAssetId !== null && $method === 'GET') {
        $tenant = tenant_from_request();
        require_known_tenant($config, $tenant);
        $asset = find_asset(db($config), $streamAssetId, $tenant);

        if ($asset === null) {
            error_response('ASSET_NOT_FOUND', 'No asset exists for this tenant and id.', 404);
        }

        $fullPath = __DIR__ . '/' . $asset['storage_path'];
        if (!is_file($fullPath)) {
            error_response('ASSET_FILE_MISSING', 'Asset metadata exists but the file is missing from local storage.', 404);
        }

        header('Content-Type: ' . $asset['mime_type']);
        header('Content-Length: ' . filesize($fullPath));
        header('Content-Disposition: inline; filename="' . basename($asset['original_filename']) . '"');
        readfile($fullPath);
        exit;
    }

    error_response('NOT_FOUND', 'No DAM route matched this request.', 404);
} catch (PDOException $exception) {
    error_response('DATABASE_ERROR', 'The DAM database operation failed.', 500, ['message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    error_response('SERVER_ERROR', 'The DAM server failed unexpectedly.', 500, ['message' => $exception->getMessage()]);
}
