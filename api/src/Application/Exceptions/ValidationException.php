<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Exceptions;

final class ValidationException extends ApiException
{
    public function __construct(string $message, array $details = [])
    {
        parent::__construct('VALIDATION_ERROR', $message, 422, $details);
    }
}
