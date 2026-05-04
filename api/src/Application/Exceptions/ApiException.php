<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Exceptions;

use RuntimeException;

class ApiException extends RuntimeException
{
    public function __construct(
        private readonly string $errorCode,
        string $message,
        private readonly int $statusCode = 400,
        private readonly array $details = []
    ) {
        parent::__construct($message, $statusCode);
    }

    public function errorCode(): string
    {
        return $this->errorCode;
    }

    public function statusCode(): int
    {
        return $this->statusCode;
    }

    public function details(): array
    {
        return $this->details;
    }
}
