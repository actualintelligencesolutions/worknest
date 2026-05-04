<?php

declare(strict_types=1);

spl_autoload_register(static function (string $class): void {
    $prefix = 'Worknest\\Api\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relativeClass = substr($class, strlen($prefix));
    $file = __DIR__ . '/../' . str_replace('\\', '/', $relativeClass) . '.php';

    if (is_file($file)) {
        require_once $file;
    }
});
