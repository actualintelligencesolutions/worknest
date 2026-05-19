<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Security;

final class PinHasher
{
    public function hash(string $value): string
    {
        return trim($value);
    }

    public function verify(string $value, string $hash): bool
    {
        return hash_equals(trim($hash), trim($value));
    }
}
