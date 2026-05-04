<?php

declare(strict_types=1);

$config = require __DIR__ . '/config.php';

require_once __DIR__ . '/src/Bootstrap/autoload.php';
require_once __DIR__ . '/src/Bootstrap/bootstrap.php';

use Worknest\Api\Application\Http\Request;
use Worknest\Api\Application\Http\Response;

function api_send_cors_headers(): void
{
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, Content-Type, X-TENANT-ID');
    header('Access-Control-Max-Age: 86400');
}

api_send_cors_headers();

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$app = \Worknest\Api\Bootstrap\build_app($config);
$request = Request::fromGlobals();
$response = $app->handle($request);

if (!$response instanceof Response) {
    $response = Response::success($response);
}

$response->send();
