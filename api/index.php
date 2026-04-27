<?php

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

function api_send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-TENANT-ID');
    header('Access-Control-Max-Age: 86400');
}

api_send_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function api_json(array $payload, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
    exit;
}

function api_success(mixed $data = null, int $status = 200): void
{
    api_json(['success' => true, 'data' => $data, 'error' => null], $status);
}

function api_error(string $code, string $message, int $status = 400, array $details = []): void
{
    api_json([
        'success' => false,
        'data' => null,
        'error' => ['code' => $code, 'message' => $message, 'details' => $details],
    ], $status);
}

function api_db(array $config): PDO
{
    static $pdo = null;
    if ($pdo instanceof PDO) {
        return $pdo;
    }

    $db = $config['database'];
    $dsn = sprintf('mysql:host=%s;port=%s;dbname=%s;charset=%s', $db['host'], $db['port'], $db['name'], $db['charset']);
    $pdo = new PDO($dsn, $db['user'], $db['pass'], [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    ]);

    return $pdo;
}

function api_path(): string
{
    $path = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
    $path = rtrim($path ?: '/', '/') ?: '/';

    return str_starts_with($path, '/api/') ? (substr($path, 4) ?: '/') : ($path === '/api' ? '/' : $path);
}

function api_method(): string
{
    return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET');
}

function api_body(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $body = json_decode($raw, true);
    if (!is_array($body)) {
        api_error('INVALID_JSON', 'Request body must be valid JSON.', 422);
    }

    return $body;
}

function api_tenant(): string
{
    $tenant = $_GET['tenant'] ?? ($_SERVER['HTTP_X_TENANT_ID'] ?? 'default');
    $tenant = trim((string) $tenant);

    if ($tenant === '' || !preg_match('/^[a-zA-Z0-9_-]+$/', $tenant)) {
        api_error('INVALID_TENANT', 'Tenant must be a non-empty slug containing only letters, numbers, hyphens, or underscores.', 422);
    }

    return $tenant;
}

function slugify(string $value): string
{
    $slug = strtolower(trim(preg_replace('/[^a-zA-Z0-9]+/', '-', $value) ?? '', '-'));
    return $slug !== '' ? $slug : 'tenant';
}

function reserved_tenant_ids(): array
{
    return ['admin', 'api', 'app', 'login', 'worknest'];
}

function send_admin_email_otp(string $email, string $otp, string $companyName): bool
{
    if (!function_exists('mail')) {
        return false;
    }

    $subject = 'Your Worknest admin verification code';
    $message = "Use this OTP to verify the admin account for {$companyName}: {$otp}\n\nThis code expires in 10 minutes.";
    $headers = 'From: no-reply@worknest.local';

    return @mail($email, $subject, $message, $headers);
}

function generate_otp_code(): string
{
    return '3333';
}

function normalize_phone(string $phone): string
{
    $digits = preg_replace('/\D+/', '', $phone) ?? '';
    if (strlen($digits) === 10) {
        return '+91' . $digits;
    }
    if (strlen($digits) === 12 && str_starts_with($digits, '91')) {
        return '+' . $digits;
    }
    if (str_starts_with(trim($phone), '+') && strlen($digits) >= 10) {
        return '+' . $digits;
    }

    return $digits === '' ? '' : '+' . $digits;
}

function valid_phone(string $phone): bool
{
    return preg_match('/^\+[1-9][0-9]{9,14}$/', $phone) === 1;
}

function id_from_path(string $path, string $pattern): ?int
{
    return preg_match($pattern, $path, $matches) === 1 ? (int) $matches[1] : null;
}

function registry(): array
{
    $contents = file_get_contents(__DIR__ . '/endpoints.registry.json');
    if ($contents === false) {
        api_error('REGISTRY_UNAVAILABLE', 'Endpoint registry could not be read.', 500);
    }
    $registry = json_decode($contents, true);
    if (!is_array($registry)) {
        api_error('REGISTRY_INVALID', 'Endpoint registry is not valid JSON.', 500);
    }

    return $registry;
}

function search_registry(string $query): array
{
    $query = strtolower(trim($query));
    $endpoints = registry()['endpoints'] ?? [];
    if ($query === '') {
        return $endpoints;
    }

    return array_values(array_filter($endpoints, static function (array $endpoint) use ($query): bool {
        $haystack = strtolower(implode(' ', [
            $endpoint['id'] ?? '',
            $endpoint['method'] ?? '',
            $endpoint['path'] ?? '',
            $endpoint['purpose'] ?? '',
            implode(' ', $endpoint['database']['related_tables'] ?? []),
        ]));

        foreach (explode(' ', $query) as $term) {
            if ($term !== '' && str_contains($haystack, $term)) {
                return true;
            }
        }

        return false;
    }));
}

function bearer_token(): ?array
{
    $header = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
    if (!str_starts_with($header, 'Bearer ')) {
        return null;
    }

    $decoded = base64_decode(substr($header, 7), true);
    $payload = $decoded === false ? null : json_decode($decoded, true);

    return is_array($payload) ? $payload : null;
}

function make_token(array $payload): string
{
    $payload['issued_at'] = time();
    return base64_encode(json_encode($payload, JSON_UNESCAPED_SLASHES));
}

function require_actor(string $tenant, ?string $role = null): array
{
    $actor = bearer_token();
    if ($actor === null || ($actor['tenant_id'] ?? null) !== $tenant) {
        api_error('UNAUTHORIZED', 'A valid bearer token is required.', 401);
    }
    if ($role !== null && ($actor['role'] ?? null) !== $role) {
        api_error('FORBIDDEN', 'This action is not available for the current role.', 403);
    }

    return $actor;
}

function find_plan(PDO $pdo, int $planId): ?array
{
    $stmt = $pdo->prepare('SELECT id, plan_code, name, price_cents, currency, description, status FROM plans WHERE id = :id AND status = "active" AND deleted_at IS NULL');
    $stmt->execute(['id' => $planId]);
    $plan = $stmt->fetch();

    return $plan === false ? null : $plan;
}

function location_payload(array $location, array $admin, array $plan): array
{
    return [
        'location' => [
            'id' => (int) $location['id'],
            'tenant_id' => $location['tenant_id'],
            'location_type' => $location['location_type'],
            'name' => $location['name'],
            'status' => $location['status'],
        ],
        'admin' => [
            'id' => (int) $admin['id'],
            'name' => $admin['name'],
            'email' => $admin['email'],
            'role' => $admin['role'],
            'status' => $admin['status'],
        ],
        'plan' => $plan,
    ];
}

function create_company_location(PDO $pdo, string $tenant, string $locationType, string $name, int $planId, string $adminName, string $adminEmail): array
{
    if ($name === '' || $adminName === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL) || $planId <= 0) {
        api_error('VALIDATION_ERROR', 'Location name, admin name, admin email, and active plan are required.', 422);
    }

    $plan = find_plan($pdo, $planId);
    if ($plan === null) {
        api_error('INVALID_PLAN', 'Choose an active plan.', 422);
    }

    $stmt = $pdo->prepare('SELECT id FROM users WHERE tenant_id = :tenant_id AND email = :email AND deleted_at IS NULL LIMIT 1');
    $stmt->execute(['tenant_id' => $tenant, 'email' => $adminEmail]);
    if ($stmt->fetch() !== false) {
        api_error('ADMIN_EMAIL_EXISTS', 'An admin with this email already exists for this tenant.', 409);
    }

    if ($locationType === 'main_office') {
        $stmt = $pdo->prepare('SELECT id FROM company_locations WHERE tenant_id = :tenant_id AND location_type = "main_office" AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['tenant_id' => $tenant]);
        if ($stmt->fetch() !== false) {
            api_error('MAIN_OFFICE_EXISTS', 'Main Office already exists for this tenant.', 409);
        }
    } else {
        $stmt = $pdo->prepare('SELECT id FROM company_locations WHERE tenant_id = :tenant_id AND location_type = "branch" AND LOWER(name) = LOWER(:name) AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['tenant_id' => $tenant, 'name' => $name]);
        if ($stmt->fetch() !== false) {
            api_error('BRANCH_EXISTS', 'A branch with this name already exists.', 409);
        }
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('INSERT INTO users (tenant_id, name, email, password_hash, role, status) VALUES (:tenant_id, :name, :email, :password_hash, "hr_admin", "pending_verification")');
    $stmt->execute([
        'tenant_id' => $tenant,
        'name' => $adminName,
        'email' => $adminEmail,
        'password_hash' => password_hash(bin2hex(random_bytes(24)), PASSWORD_DEFAULT),
    ]);
    $adminId = (int) $pdo->lastInsertId();

    $stmt = $pdo->prepare('INSERT INTO company_locations (tenant_id, location_type, name, plan_id, admin_user_id) VALUES (:tenant_id, :location_type, :name, :plan_id, :admin_user_id)');
    $stmt->execute([
        'tenant_id' => $tenant,
        'location_type' => $locationType,
        'name' => $name,
        'plan_id' => $planId,
        'admin_user_id' => $adminId,
    ]);
    $locationId = (int) $pdo->lastInsertId();
    $pdo->commit();

    $locationStmt = $pdo->prepare('SELECT id, tenant_id, location_type, name, status FROM company_locations WHERE id = :id');
    $locationStmt->execute(['id' => $locationId]);
    $location = $locationStmt->fetch();
    if ($location === false) {
        api_error('LOCATION_NOT_FOUND', 'The created location could not be loaded.', 500);
    }

    return location_payload($location, [
        'id' => $adminId,
        'name' => $adminName,
        'email' => $adminEmail,
        'role' => 'hr_admin',
        'status' => 'pending_verification',
    ], $plan);
}

function ensure_storage_dir(string $tenant, string $area): string
{
    $dir = __DIR__ . '/storage/' . $area . '/' . $tenant;
    if (!is_dir($dir) && !mkdir($dir, 0775, true)) {
        api_error('STORAGE_ERROR', 'Unable to create storage directory.', 500);
    }

    return $dir;
}

function parse_csv_file(string $path): array
{
    $handle = fopen($path, 'r');
    if ($handle === false) {
        api_error('INVALID_FILE', 'Uploaded file could not be read.', 422);
    }

    $headers = fgetcsv($handle);
    if (!is_array($headers) || count($headers) === 0) {
        fclose($handle);
        api_error('INVALID_FILE', 'Payroll file must include a header row.', 422);
    }
    $headers = array_map(static fn ($value): string => trim((string) $value), $headers);
    $rows = [];
    while (($row = fgetcsv($handle)) !== false) {
        if (count(array_filter($row, static fn ($value): bool => trim((string) $value) !== '')) === 0) {
            continue;
        }
        $record = [];
        foreach ($headers as $index => $header) {
            $record[$header] = trim((string) ($row[$index] ?? ''));
        }
        $rows[] = $record;
    }
    fclose($handle);

    return ['headers' => $headers, 'rows' => $rows];
}

function parse_xlsx_file(string $path): array
{
    if (!class_exists(ZipArchive::class)) {
        api_error('XLSX_UNAVAILABLE', 'XLSX parsing requires the PHP zip extension.', 500);
    }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) {
        api_error('INVALID_FILE', 'Uploaded XLSX file could not be opened.', 422);
    }

    $sharedStrings = [];
    $sharedXml = $zip->getFromName('xl/sharedStrings.xml');
    if ($sharedXml !== false) {
        $xml = simplexml_load_string($sharedXml);
        if ($xml !== false) {
            foreach ($xml->si as $si) {
                $sharedStrings[] = (string) ($si->t ?? '');
            }
        }
    }

    $sheetXml = $zip->getFromName('xl/worksheets/sheet1.xml');
    $zip->close();
    if ($sheetXml === false) {
        api_error('INVALID_FILE', 'Uploaded XLSX file does not include a first worksheet.', 422);
    }

    $xml = simplexml_load_string($sheetXml);
    if ($xml === false) {
        api_error('INVALID_FILE', 'Uploaded XLSX worksheet is invalid.', 422);
    }

    $table = [];
    foreach ($xml->sheetData->row as $row) {
        $values = [];
        foreach ($row->c as $cell) {
            $attrs = $cell->attributes();
            $reference = (string) ($attrs['r'] ?? '');
            preg_match('/^([A-Z]+)/', $reference, $matches);
            $index = isset($matches[1]) ? column_index($matches[1]) : count($values);
            $value = (string) ($cell->v ?? '');
            if ((string) ($attrs['t'] ?? '') === 's') {
                $value = $sharedStrings[(int) $value] ?? $value;
            }
            $values[$index] = trim($value);
        }
        if ($values !== []) {
            ksort($values);
            $table[] = array_values($values);
        }
    }

    $headers = array_map('trim', $table[0] ?? []);
    if ($headers === []) {
        api_error('INVALID_FILE', 'Payroll file must include a header row.', 422);
    }
    $rows = [];
    foreach (array_slice($table, 1) as $line) {
        $record = [];
        foreach ($headers as $index => $header) {
            $record[$header] = trim((string) ($line[$index] ?? ''));
        }
        $rows[] = $record;
    }

    return ['headers' => $headers, 'rows' => $rows];
}

function column_index(string $letters): int
{
    $index = 0;
    foreach (str_split($letters) as $letter) {
        $index = ($index * 26) + (ord($letter) - 64);
    }

    return $index - 1;
}

function parse_payroll_file(string $path, string $filename): array
{
    $extension = strtolower(pathinfo($filename, PATHINFO_EXTENSION));
    if ($extension === 'csv') {
        return parse_csv_file($path);
    }
    if ($extension === 'xlsx') {
        return parse_xlsx_file($path);
    }

    api_error('INVALID_FILE', 'Upload must be CSV or XLSX.', 422);
}

function mapping_suggestions(array $headers): array
{
    $targets = [
        'employee_code' => ['emp code', 'employee code', 'employee id', 'staff id'],
        'employee_name' => ['emp name', 'employee name', 'name'],
        'phone' => ['phone', 'mobile', 'contact', 'mobile number'],
        'basic' => ['basic', 'basic salary'],
        'hra' => ['hra', 'house rent'],
        'allowances' => ['allowance', 'allowances', 'special allowance'],
        'gross_pay' => ['gross', 'gross pay', 'gross salary'],
        'pf' => ['pf', 'provident fund'],
        'esi' => ['esi'],
        'professional_tax' => ['pt', 'professional tax'],
        'tds' => ['tds', 'tax deducted'],
        'total_deductions' => ['deduction', 'deductions', 'total deduction'],
        'net_pay' => ['net', 'net pay', 'net salary', 'net amt'],
    ];
    $suggestions = [];
    foreach ($targets as $field => $needles) {
        foreach ($headers as $header) {
            $normalized = strtolower(trim((string) $header));
            foreach ($needles as $needle) {
                if ($normalized === $needle || str_contains($normalized, $needle)) {
                    $suggestions[$field] = ['source' => $header, 'confidence' => $normalized === $needle ? 'high' : 'medium'];
                    continue 3;
                }
            }
        }
    }

    return $suggestions;
}

function money_value(mixed $value): float
{
    $clean = preg_replace('/[^0-9.\-]/', '', (string) $value) ?? '0';
    return round((float) ($clean === '' ? 0 : $clean), 2);
}

function normalize_row(array $row, array $mapping): array
{
    $get = static fn (string $field): string => isset($mapping[$field]) ? trim((string) ($row[$mapping[$field]] ?? '')) : '';
    $earnings = [
        'basic' => money_value($get('basic')),
        'hra' => money_value($get('hra')),
        'allowances' => money_value($get('allowances')),
    ];
    $deductions = [
        'pf' => money_value($get('pf')),
        'esi' => money_value($get('esi')),
        'professional_tax' => money_value($get('professional_tax')),
        'tds' => money_value($get('tds')),
    ];
    $gross = $get('gross_pay') !== '' ? money_value($get('gross_pay')) : array_sum($earnings);
    $deductionTotal = $get('total_deductions') !== '' ? money_value($get('total_deductions')) : array_sum($deductions);

    return [
        'employee_code' => $get('employee_code'),
        'employee_name' => $get('employee_name'),
        'phone' => normalize_phone($get('phone')),
        'gross_pay' => $gross,
        'total_deductions' => $deductionTotal,
        'net_pay' => $get('net_pay') !== '' ? money_value($get('net_pay')) : round($gross - $deductionTotal, 2),
        'earnings' => $earnings,
        'deductions' => $deductions,
    ];
}

function validate_normalized(array $row, array $seenCodes): array
{
    $errors = [];
    if ($row['employee_code'] === '') {
        $errors[] = 'Missing employee code.';
    }
    if ($row['employee_name'] === '') {
        $errors[] = 'Missing employee name.';
    }
    if (!valid_phone($row['phone'])) {
        $errors[] = 'Invalid or missing phone number.';
    }
    if ($row['employee_code'] !== '' && isset($seenCodes[$row['employee_code']])) {
        $errors[] = 'Duplicate employee code in this import.';
    }
    if ($row['gross_pay'] < 0 || $row['total_deductions'] < 0 || $row['net_pay'] < 0) {
        $errors[] = 'Payroll amounts cannot be negative.';
    }
    if (abs(($row['gross_pay'] - $row['total_deductions']) - $row['net_pay']) > 1) {
        $errors[] = 'Net pay does not match gross pay minus deductions.';
    }

    return $errors;
}

function pdf_payload(array $payslip, array $period): string
{
    $lines = [
        'Worknest Payslip',
        'Period: ' . $period['period_month'] . '/' . $period['period_year'],
        'Employee: ' . $payslip['employee_name'] . ' (' . $payslip['employee_code'] . ')',
        'Gross Pay: INR ' . number_format((float) $payslip['gross_pay'], 2),
        'Deductions: INR ' . number_format((float) $payslip['total_deductions'], 2),
        'Net Pay: INR ' . number_format((float) $payslip['net_pay'], 2),
    ];
    $text = implode("\\n", array_map(static fn (string $line): string => str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line), $lines));
    $stream = "BT /F1 14 Tf 72 760 Td ({$text}) Tj ET";
    $objects = [
        '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
        '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
        '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >> endobj',
        '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
        '5 0 obj << /Length ' . strlen($stream) . " >> stream\n{$stream}\nendstream endobj",
    ];
    $pdf = "%PDF-1.4\n";
    $offsets = [0];
    foreach ($objects as $object) {
        $offsets[] = strlen($pdf);
        $pdf .= $object . "\n";
    }
    $xref = strlen($pdf);
    $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
    foreach (array_slice($offsets, 1) as $offset) {
        $pdf .= sprintf("%010d 00000 n \n", $offset);
    }
    $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

    return $pdf;
}

try {
    $method = api_method();
    $path = api_path();
    $pdo = api_db($config);

    if ($method === 'GET' && $path === '/health') {
        api_success(['status' => 'ok', 'service' => 'api', 'environment' => $config['project']['environment']['active_environment'] ?? 'local']);
    }

    if ($method === 'GET' && $path === '/endpoints') {
        $matches = search_registry((string) ($_GET['query'] ?? ''));
        api_success([
            'matches' => $matches,
            'reuse_prompt' => count($matches) > 0 ? 'There is already an endpoint that may satisfy this request.' : 'No endpoint matched this request. Define the registry entry before implementation.',
        ]);
    }

    if ($method === 'GET' && $path === '/plans') {
        $stmt = $pdo->query('SELECT id, plan_code, name, price_cents, currency, description, status FROM plans WHERE status = "active" AND deleted_at IS NULL ORDER BY price_cents ASC');
        api_success(['plans' => $stmt->fetchAll()]);
    }

    if ($method === 'GET' && $path === '/locations') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $stmt = $pdo->prepare('SELECT id, tenant_id, location_type, name, status, created_at FROM company_locations WHERE tenant_id = :tenant_id AND deleted_at IS NULL ORDER BY location_type ASC, name ASC');
        $stmt->execute(['tenant_id' => $tenant]);
        $locations = $stmt->fetchAll();
        $mainOfficeCount = 0;
        $branchCount = 0;
        foreach ($locations as $location) {
            if (($location['location_type'] ?? '') === 'main_office') {
                $mainOfficeCount++;
            }
            if (($location['location_type'] ?? '') === 'branch') {
                $branchCount++;
            }
        }
        api_success([
            'locations' => $locations,
            'summary' => [
                'main_offices' => $mainOfficeCount,
                'branches' => $branchCount,
                'total' => count($locations),
            ],
        ]);
    }

    if ($method === 'POST' && $path === '/main-office') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $body = api_body();
        $payload = create_company_location(
            $pdo,
            $tenant,
            'main_office',
            'Main Office',
            (int) ($body['plan_id'] ?? 0),
            trim((string) ($body['admin_name'] ?? '')),
            strtolower(trim((string) ($body['admin_email'] ?? '')))
        );
        api_success($payload, 201);
    }

    if ($method === 'POST' && $path === '/branches') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $body = api_body();
        $payload = create_company_location(
            $pdo,
            $tenant,
            'branch',
            trim((string) ($body['branch_name'] ?? '')),
            (int) ($body['plan_id'] ?? 0),
            trim((string) ($body['admin_name'] ?? '')),
            strtolower(trim((string) ($body['admin_email'] ?? '')))
        );
        api_success($payload, 201);
    }

    if ($method === 'GET' && $path === '/companies/check-workspace') {
        $tenant = slugify((string) ($_GET['tenant_id'] ?? ''));
        if (strlen($tenant) < 3) {
            api_error('VALIDATION_ERROR', 'Workspace address must be at least 3 characters.', 422);
        }
        if (in_array($tenant, reserved_tenant_ids(), true)) {
            api_success([
                'tenant_id' => $tenant,
                'available' => false,
                'reason' => 'reserved',
            ]);
        }

        $stmt = $pdo->prepare('SELECT id FROM tenants WHERE tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['tenant_id' => $tenant]);
        $tenantExists = $stmt->fetch() !== false;

        api_success([
            'tenant_id' => $tenant,
            'available' => !$tenantExists,
            'reason' => $tenantExists ? 'taken' : null,
        ]);
    }

    if ($method === 'POST' && $path === '/companies/register') {
        $body = api_body();
        $companyName = trim((string) ($body['company_name'] ?? ''));
        $tenant = slugify((string) ($body['tenant_id'] ?? $companyName));
        $adminName = trim((string) ($body['admin_name'] ?? ''));
        $adminEmail = strtolower(trim((string) ($body['admin_email'] ?? '')));
        $adminPhone = normalize_phone((string) ($body['admin_phone'] ?? ''));
        $password = (string) ($body['admin_password'] ?? '');

        if ($companyName === '' || $adminName === '' || !filter_var($adminEmail, FILTER_VALIDATE_EMAIL) || !valid_phone($adminPhone) || strlen($password) < 8) {
            api_error('VALIDATION_ERROR', 'Company, HR admin details, valid phone, and an 8 character password are required.', 422);
        }
        if (strlen($tenant) < 3 || in_array($tenant, reserved_tenant_ids(), true)) {
            api_error('WORKSPACE_UNAVAILABLE', 'This workspace address is not available.', 409);
        }

        $stmt = $pdo->prepare('SELECT id FROM tenants WHERE tenant_id = :tenant_id AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['tenant_id' => $tenant]);
        if ($stmt->fetch() !== false) {
            api_error('WORKSPACE_UNAVAILABLE', 'This workspace address is already taken.', 409);
        }

        $otp = generate_otp_code();

        $pdo->beginTransaction();
        $stmt = $pdo->prepare('INSERT INTO tenants (tenant_id, name) VALUES (:tenant_id, :name)');
        $stmt->execute(['tenant_id' => $tenant, 'name' => $companyName]);
        $stmt = $pdo->prepare('INSERT INTO users (tenant_id, name, email, phone, password_hash, role, status) VALUES (:tenant_id, :name, :email, :phone, :password_hash, "hr_admin", "pending_verification")');
        $stmt->execute([
            'tenant_id' => $tenant,
            'name' => $adminName,
            'email' => $adminEmail,
            'phone' => $adminPhone,
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
        ]);
        $userId = (int) $pdo->lastInsertId();
        $pdo->prepare('UPDATE tenants SET primary_admin_user_id = :user_id WHERE tenant_id = :tenant_id')
            ->execute(['tenant_id' => $tenant, 'user_id' => $userId]);
        $stmt = $pdo->prepare('INSERT INTO user_verification_challenges (tenant_id, user_id, channel, destination, otp_code, expires_at) VALUES (:tenant_id, :user_id, "email", :destination, :otp_code, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))');
        $stmt->execute([
            'tenant_id' => $tenant,
            'user_id' => $userId,
            'destination' => $adminEmail,
            'otp_code' => $otp,
        ]);
        $challengeId = (int) $pdo->lastInsertId();
        $pdo->prepare('INSERT INTO onboarding_flows (tenant_id, status, current_step) VALUES (:tenant_id, "not_started", "company_profile")')
            ->execute(['tenant_id' => $tenant]);
        $pdo->commit();
        $emailSent = send_admin_email_otp($adminEmail, $otp, $companyName);

        api_success([
            'tenant' => ['tenant_id' => $tenant, 'name' => $companyName],
            'user' => ['id' => $userId, 'name' => $adminName, 'email' => $adminEmail, 'role' => 'hr_admin', 'status' => 'pending_verification'],
            'verification' => [
                'challenge_id' => $challengeId,
                'channel' => 'email',
                'destination' => $adminEmail,
                'email_sent' => $emailSent,
                'dev_otp' => $otp,
            ],
            'next_step' => 'verify_admin_email',
        ], 201);
    }

    if ($method === 'POST' && $path === '/auth/admin/verify-otp') {
        $body = api_body();
        $challengeId = (int) ($body['challenge_id'] ?? 0);
        $otpCode = trim((string) ($body['otp_code'] ?? ''));

        $stmt = $pdo->prepare(
            'SELECT c.id, c.tenant_id, c.user_id, c.otp_code, c.attempt_count, u.name, u.email, u.role
             FROM user_verification_challenges c
             JOIN users u ON u.id = c.user_id
             WHERE c.id = :id
               AND c.channel = "email"
               AND c.status = "pending"
               AND c.expires_at > CURRENT_TIMESTAMP
               AND c.deleted_at IS NULL
               AND u.deleted_at IS NULL
             LIMIT 1'
        );
        $stmt->execute(['id' => $challengeId]);
        $challenge = $stmt->fetch();

        if ($challenge === false || !hash_equals((string) $challenge['otp_code'], $otpCode)) {
            if ($challenge !== false) {
                $pdo->prepare('UPDATE user_verification_challenges SET attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP WHERE id = :id')
                    ->execute(['id' => (int) $challenge['id']]);
            }
            api_error('INVALID_OTP', 'The OTP is invalid or expired.', 422);
        }

        $pdo->beginTransaction();
        $pdo->prepare('UPDATE user_verification_challenges SET status = "verified", verified_at = CURRENT_TIMESTAMP, last_attempt_at = CURRENT_TIMESTAMP WHERE id = :id')
            ->execute(['id' => (int) $challenge['id']]);
        $pdo->prepare('UPDATE users SET status = "active", email_verified_at = CURRENT_TIMESTAMP WHERE id = :id')
            ->execute(['id' => (int) $challenge['user_id']]);
        $pdo->prepare('UPDATE tenants SET status = "active", onboarding_status = "in_progress" WHERE tenant_id = :tenant_id')
            ->execute(['tenant_id' => $challenge['tenant_id']]);
        $pdo->prepare('UPDATE onboarding_flows SET status = "in_progress", current_step = "company_profile" WHERE tenant_id = :tenant_id')
            ->execute(['tenant_id' => $challenge['tenant_id']]);
        $pdo->commit();

        api_success([
            'token' => make_token(['tenant_id' => $challenge['tenant_id'], 'role' => 'hr_admin', 'user_id' => (int) $challenge['user_id']]),
            'tenant' => ['tenant_id' => $challenge['tenant_id']],
            'user' => ['id' => (int) $challenge['user_id'], 'name' => $challenge['name'], 'email' => $challenge['email'], 'role' => $challenge['role'], 'status' => 'active'],
            'next_step' => 'setup_company',
        ]);
    }

    if ($method === 'POST' && $path === '/auth/hr-login') {
        $tenant = api_tenant();
        $body = api_body();
        $stmt = $pdo->prepare('SELECT id, tenant_id, name, email, password_hash, role, status FROM users WHERE tenant_id = :tenant_id AND email = :email AND role = "hr_admin" AND status = "active" AND deleted_at IS NULL');
        $stmt->execute(['tenant_id' => $tenant, 'email' => strtolower(trim((string) ($body['email'] ?? '')))]);
        $user = $stmt->fetch();
        if ($user === false || !password_verify((string) ($body['password'] ?? ''), (string) $user['password_hash'])) {
            api_error('INVALID_CREDENTIALS', 'Invalid email or password.', 401);
        }
        api_success([
            'token' => make_token(['tenant_id' => $tenant, 'role' => 'hr_admin', 'user_id' => (int) $user['id']]),
            'user' => ['id' => (int) $user['id'], 'name' => $user['name'], 'email' => $user['email'], 'role' => $user['role']],
        ]);
    }

    if ($method === 'POST' && $path === '/auth/employee/request-otp') {
        $tenant = api_tenant();
        $phone = normalize_phone((string) (api_body()['phone'] ?? ''));
        $stmt = $pdo->prepare('SELECT id, name, employee_code, phone FROM employee_profiles WHERE tenant_id = :tenant_id AND phone = :phone AND deleted_at IS NULL');
        $stmt->execute(['tenant_id' => $tenant, 'phone' => $phone]);
        $employee = $stmt->fetch();
        if ($employee === false) {
            api_error('EMPLOYEE_NOT_FOUND', 'No employee exists for this phone number.', 404);
        }
        $otp = generate_otp_code();
        $stmt = $pdo->prepare('INSERT INTO employee_otp_challenges (tenant_id, phone, otp_code, expires_at) VALUES (:tenant_id, :phone, :otp_code, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 10 MINUTE))');
        $stmt->execute(['tenant_id' => $tenant, 'phone' => $phone, 'otp_code' => $otp]);
        api_success(['challenge_id' => (int) $pdo->lastInsertId(), 'dev_otp' => $otp]);
    }

    if ($method === 'POST' && $path === '/auth/employee/verify-otp') {
        $tenant = api_tenant();
        $body = api_body();
        $stmt = $pdo->prepare('SELECT id, phone, otp_code, attempt_count FROM employee_otp_challenges WHERE id = :id AND tenant_id = :tenant_id AND status = "pending" AND expires_at > CURRENT_TIMESTAMP AND deleted_at IS NULL');
        $stmt->execute(['id' => (int) ($body['challenge_id'] ?? 0), 'tenant_id' => $tenant]);
        $challenge = $stmt->fetch();
        if ($challenge === false || !hash_equals((string) $challenge['otp_code'], (string) ($body['otp_code'] ?? ''))) {
            if ($challenge !== false) {
                $pdo->prepare('UPDATE employee_otp_challenges SET attempt_count = attempt_count + 1, last_attempt_at = CURRENT_TIMESTAMP WHERE id = :id')->execute(['id' => (int) $challenge['id']]);
            }
            api_error('INVALID_OTP', 'The OTP is invalid or expired.', 401);
        }
        $pdo->prepare('UPDATE employee_otp_challenges SET status = "verified", last_attempt_at = CURRENT_TIMESTAMP WHERE id = :id')->execute(['id' => (int) $challenge['id']]);
        $stmt = $pdo->prepare('SELECT id, employee_code, name, phone FROM employee_profiles WHERE tenant_id = :tenant_id AND phone = :phone AND deleted_at IS NULL LIMIT 1');
        $stmt->execute(['tenant_id' => $tenant, 'phone' => $challenge['phone']]);
        $employee = $stmt->fetch();
        api_success([
            'token' => make_token(['tenant_id' => $tenant, 'role' => 'employee', 'employee_id' => (int) $employee['id']]),
            'employee' => $employee,
        ]);
    }

    if ($method === 'GET' && $path === '/auth/me') {
        $tenant = api_tenant();
        api_success(['actor' => require_actor($tenant)]);
    }

    if ($method === 'GET' && $path === '/employees') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $stmt = $pdo->prepare('SELECT id, employee_code, name, phone, email, status, created_at FROM employee_profiles WHERE tenant_id = :tenant_id AND deleted_at IS NULL ORDER BY name ASC');
        $stmt->execute(['tenant_id' => $tenant]);
        api_success(['employees' => $stmt->fetchAll()]);
    }

    if ($method === 'POST' && $path === '/payroll-periods') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $body = api_body();
        $month = (int) ($body['period_month'] ?? 0);
        $year = (int) ($body['period_year'] ?? 0);
        if ($month < 1 || $month > 12 || $year < 2000) {
            api_error('VALIDATION_ERROR', 'Payroll period is invalid.', 422);
        }
        $stmt = $pdo->prepare('INSERT INTO payroll_periods (tenant_id, period_month, period_year) VALUES (:tenant_id, :month, :year) ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP');
        $stmt->execute(['tenant_id' => $tenant, 'month' => $month, 'year' => $year]);
        $stmt = $pdo->prepare('SELECT * FROM payroll_periods WHERE tenant_id = :tenant_id AND period_month = :month AND period_year = :year AND deleted_at IS NULL');
        $stmt->execute(['tenant_id' => $tenant, 'month' => $month, 'year' => $year]);
        api_success(['period' => $stmt->fetch()], 201);
    }

    if ($method === 'POST' && $path === '/payroll-imports') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $periodId = (int) ($_POST['payroll_period_id'] ?? 0);
        if (!isset($_FILES['payroll_file']) || $periodId <= 0) {
            api_error('VALIDATION_ERROR', 'Payroll period and payroll file are required.', 422);
        }
        $file = $_FILES['payroll_file'];
        if (($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK || ($file['size'] ?? 0) <= 0) {
            api_error('INVALID_FILE', 'Payroll file upload failed.', 422);
        }
        if (($file['size'] ?? 0) > 10 * 1024 * 1024) {
            api_error('UPLOAD_TOO_LARGE', 'Payroll file cannot exceed 10MB.', 413);
        }
        $parsed = parse_payroll_file($file['tmp_name'], (string) $file['name']);
        $dir = ensure_storage_dir($tenant, 'payroll-imports');
        $stored = slugify(pathinfo((string) $file['name'], PATHINFO_FILENAME)) . '-' . bin2hex(random_bytes(8)) . '.' . strtolower(pathinfo((string) $file['name'], PATHINFO_EXTENSION));
        if (!move_uploaded_file($file['tmp_name'], $dir . '/' . $stored)) {
            api_error('STORAGE_ERROR', 'Unable to store payroll import.', 500);
        }
        $stmt = $pdo->prepare('INSERT INTO payroll_imports (tenant_id, payroll_period_id, original_filename, stored_filename, storage_path, mime_type, file_size, status) VALUES (:tenant_id, :period_id, :original, :stored, :path, :mime, :size, "uploaded")');
        $stmt->execute([
            'tenant_id' => $tenant,
            'period_id' => $periodId,
            'original' => (string) $file['name'],
            'stored' => $stored,
            'path' => 'storage/payroll-imports/' . $tenant . '/' . $stored,
            'mime' => (string) ($file['type'] ?? 'application/octet-stream'),
            'size' => (int) $file['size'],
        ]);
        $importId = (int) $pdo->lastInsertId();
        api_success([
            'import' => ['id' => $importId, 'status' => 'uploaded', 'payroll_period_id' => $periodId],
            'headers' => $parsed['headers'],
            'sample_rows' => array_slice($parsed['rows'], 0, 3),
            'mapping_suggestions' => mapping_suggestions($parsed['headers']),
        ], 201);
    }

    $mappingImportId = id_from_path($path, '#^/payroll-imports/([0-9]+)/mapping$#');
    if ($mappingImportId !== null && $method === 'PUT') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $body = api_body();
        $mapping = $body['mapping'] ?? [];
        foreach (['employee_code', 'employee_name', 'phone', 'net_pay'] as $field) {
            if (!is_array($mapping) || empty($mapping[$field])) {
                api_error('INVALID_MAPPING', 'Required mappings are missing.', 422, ['field' => $field]);
            }
        }
        $pdo->prepare('UPDATE payroll_imports SET mapping_json = :mapping, status = "mapped", updated_at = CURRENT_TIMESTAMP WHERE id = :id AND tenant_id = :tenant_id AND status IN ("uploaded", "mapped", "validated", "processed") AND deleted_at IS NULL')
            ->execute(['id' => $mappingImportId, 'tenant_id' => $tenant, 'mapping' => json_encode($mapping)]);
        $pdo->prepare('INSERT INTO payroll_mapping_templates (tenant_id, name, mapping_json) VALUES (:tenant_id, "Latest payroll mapping", :mapping)')
            ->execute(['tenant_id' => $tenant, 'mapping' => json_encode($mapping)]);
        api_success(['import' => ['id' => $mappingImportId, 'status' => 'mapped', 'mapping' => $mapping]]);
    }

    $processImportId = id_from_path($path, '#^/payroll-imports/([0-9]+)/process$#');
    if ($processImportId !== null && $method === 'POST') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $stmt = $pdo->prepare('SELECT * FROM payroll_imports WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL');
        $stmt->execute(['id' => $processImportId, 'tenant_id' => $tenant]);
        $import = $stmt->fetch();
        if ($import === false || empty($import['mapping_json'])) {
            api_error('INVALID_IMPORT_STATE', 'Import must be mapped before processing.', 422);
        }
        $parsed = parse_payroll_file(__DIR__ . '/' . $import['storage_path'], $import['original_filename']);
        $mapping = json_decode((string) $import['mapping_json'], true);
        $seenCodes = [];
        $summary = ['total_rows' => 0, 'valid_rows' => 0, 'error_rows' => 0, 'critical_errors' => []];
        $pdo->prepare('DELETE FROM payroll_import_rows WHERE payroll_import_id = :id')->execute(['id' => $processImportId]);
        foreach ($parsed['rows'] as $index => $row) {
            $normalized = normalize_row($row, $mapping);
            $errors = validate_normalized($normalized, $seenCodes);
            if ($normalized['employee_code'] !== '') {
                $seenCodes[$normalized['employee_code']] = true;
            }
            $status = $errors === [] ? 'valid' : 'error';
            $summary['total_rows']++;
            $summary[$status === 'valid' ? 'valid_rows' : 'error_rows']++;
            array_push($summary['critical_errors'], ...$errors);
            $pdo->prepare('INSERT INTO payroll_import_rows (tenant_id, payroll_import_id, `row_number`, raw_json, normalized_json, status, errors_json) VALUES (:tenant_id, :import_id, :row_number, :raw_json, :normalized_json, :status, :errors_json)')
                ->execute([
                    'tenant_id' => $tenant,
                    'import_id' => $processImportId,
                    'row_number' => $index + 2,
                    'raw_json' => json_encode($row),
                    'normalized_json' => json_encode($normalized),
                    'status' => $status,
                    'errors_json' => json_encode($errors),
                ]);
            if ($errors !== []) {
                continue;
            }
            $pdo->prepare('INSERT INTO employee_profiles (tenant_id, employee_code, name, phone, status) VALUES (:tenant_id, :code, :name, :phone, "active") ON DUPLICATE KEY UPDATE name = VALUES(name), phone = VALUES(phone), updated_at = CURRENT_TIMESTAMP')
                ->execute(['tenant_id' => $tenant, 'code' => $normalized['employee_code'], 'name' => $normalized['employee_name'], 'phone' => $normalized['phone']]);
            $employeeIdStmt = $pdo->prepare('SELECT id FROM employee_profiles WHERE tenant_id = :tenant_id AND employee_code = :code');
            $employeeIdStmt->execute(['tenant_id' => $tenant, 'code' => $normalized['employee_code']]);
            $employeeId = (int) $employeeIdStmt->fetchColumn();
            $pdo->prepare('INSERT INTO payslip_records (tenant_id, payroll_period_id, employee_profile_id, employee_code, employee_name, phone, gross_pay, total_deductions, net_pay, earnings_json, deductions_json, status) VALUES (:tenant_id, :period_id, :employee_id, :code, :name, :phone, :gross, :deductions, :net, :earnings, :deductions_json, "draft") ON DUPLICATE KEY UPDATE employee_name = VALUES(employee_name), phone = VALUES(phone), gross_pay = VALUES(gross_pay), total_deductions = VALUES(total_deductions), net_pay = VALUES(net_pay), earnings_json = VALUES(earnings_json), deductions_json = VALUES(deductions_json), updated_at = CURRENT_TIMESTAMP')
                ->execute([
                    'tenant_id' => $tenant,
                    'period_id' => (int) $import['payroll_period_id'],
                    'employee_id' => $employeeId,
                    'code' => $normalized['employee_code'],
                    'name' => $normalized['employee_name'],
                    'phone' => $normalized['phone'],
                    'gross' => $normalized['gross_pay'],
                    'deductions' => $normalized['total_deductions'],
                    'net' => $normalized['net_pay'],
                    'earnings' => json_encode($normalized['earnings']),
                    'deductions_json' => json_encode($normalized['deductions']),
                ]);
        }
        $nextStatus = $summary['error_rows'] > 0 ? 'validated' : 'processed';
        $pdo->prepare('UPDATE payroll_imports SET status = :status, validation_summary_json = :summary, updated_at = CURRENT_TIMESTAMP WHERE id = :id')
            ->execute(['id' => $processImportId, 'status' => $nextStatus, 'summary' => json_encode($summary)]);
        api_success(['import' => ['id' => $processImportId, 'status' => $nextStatus], 'summary' => $summary]);
    }

    $publishPeriodId = id_from_path($path, '#^/payroll-periods/([0-9]+)/publish$#');
    if ($publishPeriodId !== null && $method === 'POST') {
        $tenant = api_tenant();
        require_actor($tenant, 'hr_admin');
        $errorRows = $pdo->prepare('SELECT COUNT(*) FROM payroll_import_rows pir JOIN payroll_imports pi ON pi.id = pir.payroll_import_id WHERE pi.payroll_period_id = :period_id AND pir.tenant_id = :tenant_id AND pir.status = "error" AND pir.deleted_at IS NULL');
        $errorRows->execute(['period_id' => $publishPeriodId, 'tenant_id' => $tenant]);
        if ((int) $errorRows->fetchColumn() > 0) {
            api_error('PUBLISH_BLOCKED', 'Critical payroll errors must be fixed before publishing.', 422);
        }
        $periodStmt = $pdo->prepare('SELECT * FROM payroll_periods WHERE id = :id AND tenant_id = :tenant_id AND deleted_at IS NULL');
        $periodStmt->execute(['id' => $publishPeriodId, 'tenant_id' => $tenant]);
        $period = $periodStmt->fetch();
        if ($period === false) {
            api_error('PERIOD_NOT_FOUND', 'Payroll period was not found.', 404);
        }
        $stmt = $pdo->prepare('SELECT * FROM payslip_records WHERE payroll_period_id = :period_id AND tenant_id = :tenant_id AND deleted_at IS NULL');
        $stmt->execute(['period_id' => $publishPeriodId, 'tenant_id' => $tenant]);
        $generated = 0;
        foreach ($stmt->fetchAll() as $payslip) {
            $dir = ensure_storage_dir($tenant, 'payslips');
            $filename = 'payslip-' . $publishPeriodId . '-' . $payslip['employee_code'] . '.pdf';
            $payload = pdf_payload($payslip, $period);
            file_put_contents($dir . '/' . $filename, $payload);
            $hash = hash('sha256', $payload);
            $existing = $pdo->prepare('SELECT COALESCE(MAX(version), 0) FROM payslip_files WHERE payslip_record_id = :id');
            $existing->execute(['id' => (int) $payslip['id']]);
            $version = ((int) $existing->fetchColumn()) + 1;
            $pdo->prepare('INSERT INTO payslip_files (tenant_id, payslip_record_id, storage_path, file_hash, version) VALUES (:tenant_id, :record_id, :path, :hash, :version)')
                ->execute(['tenant_id' => $tenant, 'record_id' => (int) $payslip['id'], 'path' => 'storage/payslips/' . $tenant . '/' . $filename, 'hash' => $hash, 'version' => $version]);
            $generated++;
        }
        $pdo->prepare('UPDATE payslip_records SET status = "published", updated_at = CURRENT_TIMESTAMP WHERE payroll_period_id = :period_id AND tenant_id = :tenant_id')->execute(['period_id' => $publishPeriodId, 'tenant_id' => $tenant]);
        $pdo->prepare('UPDATE payroll_periods SET status = "published", published_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = :id AND tenant_id = :tenant_id')->execute(['id' => $publishPeriodId, 'tenant_id' => $tenant]);
        api_success(['period' => ['id' => $publishPeriodId, 'status' => 'published'], 'generated_files' => $generated]);
    }

    if ($method === 'GET' && $path === '/payslips') {
        $tenant = api_tenant();
        $actor = require_actor($tenant);
        $sql = 'SELECT pr.id, pr.employee_code, pr.employee_name, pr.gross_pay, pr.total_deductions, pr.net_pay, pr.status, pp.period_month, pp.period_year
            FROM payslip_records pr
            JOIN payroll_periods pp ON pp.id = pr.payroll_period_id
            WHERE pr.tenant_id = :tenant_id AND pr.deleted_at IS NULL';
        $params = ['tenant_id' => $tenant];
        if (($actor['role'] ?? '') === 'employee') {
            $sql .= ' AND pr.employee_profile_id = :employee_id AND pr.status = "published" AND pp.status = "published"';
            $params['employee_id'] = (int) $actor['employee_id'];
        }
        $sql .= ' ORDER BY pp.period_year DESC, pp.period_month DESC, pr.employee_name ASC';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        api_success(['payslips' => $stmt->fetchAll()]);
    }

    $downloadPayslipId = id_from_path($path, '#^/payslips/([0-9]+)/download$#');
    if ($downloadPayslipId !== null && $method === 'GET') {
        $tenant = api_tenant();
        $actor = require_actor($tenant);
        $sql = 'SELECT pr.*, pf.storage_path FROM payslip_records pr JOIN payslip_files pf ON pf.payslip_record_id = pr.id WHERE pr.id = :id AND pr.tenant_id = :tenant_id AND pr.status = "published" AND pr.deleted_at IS NULL AND pf.deleted_at IS NULL';
        $params = ['id' => $downloadPayslipId, 'tenant_id' => $tenant];
        if (($actor['role'] ?? '') === 'employee') {
            $sql .= ' AND pr.employee_profile_id = :employee_id';
            $params['employee_id'] = (int) $actor['employee_id'];
        }
        $sql .= ' ORDER BY pf.version DESC LIMIT 1';
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $payslip = $stmt->fetch();
        if ($payslip === false || !is_file(__DIR__ . '/' . $payslip['storage_path'])) {
            api_error('PAYSLIP_NOT_FOUND', 'No accessible payslip was found.', 404);
        }
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="worknest-payslip-' . $downloadPayslipId . '.pdf"');
        readfile(__DIR__ . '/' . $payslip['storage_path']);
        exit;
    }

    api_error('NOT_FOUND', 'No API route matched this request.', 404);
} catch (PDOException $exception) {
    if (isset($pdo) && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    api_error('DATABASE_ERROR', 'The API database operation failed.', 500, ['message' => $exception->getMessage()]);
} catch (Throwable $exception) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    api_error('SERVER_ERROR', 'Unexpected API failure.', 500, ['message' => $exception->getMessage()]);
}
