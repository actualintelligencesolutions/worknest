<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Security;

final class PinHasher
{
    public function hash(string $value): string
    {
        return password_hash($value, PASSWORD_DEFAULT);
    }

    public function verify(string $value, string $hash): bool
    {
        return password_verify($value, $hash);
    }
}
