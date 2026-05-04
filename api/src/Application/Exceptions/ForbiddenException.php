<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Exceptions;

final class ForbiddenException extends ApiException
{
    public function __construct(string $message = 'This action is not available for the current role.')
    {
        parent::__construct('FORBIDDEN', $message, 403);
    }
}
