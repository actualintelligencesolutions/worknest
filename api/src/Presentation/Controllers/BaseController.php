<?php

declare(strict_types=1);

namespace Worknest\Api\Presentation\Controllers;

use Worknest\Api\Application\Http\Request;

abstract class BaseController
{
    protected function bearerToken(Request $request): string
    {
        $header = (string) $request->header('Authorization', '');
        return str_starts_with($header, 'Bearer ') ? substr($header, 7) : '';
    }
}
