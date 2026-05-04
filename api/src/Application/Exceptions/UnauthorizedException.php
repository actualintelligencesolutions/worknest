<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Exceptions;

final class UnauthorizedException extends ApiException
{
    public function __construct(string $message = 'A valid bearer token is required.')
    {
        parent::__construct('UNAUTHORIZED', $message, 401);
    }
}
