<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Exceptions;

final class NotFoundException extends ApiException
{
    public function __construct(string $message = 'No API route matched this request.')
    {
        parent::__construct('NOT_FOUND', $message, 404);
    }
}
