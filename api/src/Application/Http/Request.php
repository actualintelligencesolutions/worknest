<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Http;

use Worknest\Api\Application\Exceptions\ValidationException;

final class Request
{
    private ?array $jsonBody = null;

    public function __construct(
        private readonly string $method,
        private readonly string $path,
        private readonly array $queryParams,
        private readonly array $postParams,
        private readonly array $files,
        private readonly array $server,
        private readonly string $rawBody,
        private array $attributes = []
    ) {
    }

    public static function fromGlobals(): self
    {
        $uriPath = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH);
        $path = rtrim((string) ($uriPath ?: '/'), '/') ?: '/';
        $path = str_starts_with($path, '/api/') ? (substr($path, 4) ?: '/') : ($path === '/api' ? '/' : $path);

        return new self(
            strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $path,
            $_GET,
            $_POST,
            $_FILES,
            $_SERVER,
            (string) file_get_contents('php://input')
        );
    }

    public function method(): string
    {
        return $this->method;
    }

    public function path(): string
    {
        return $this->path;
    }

    public function query(string $key, mixed $default = null): mixed
    {
        return $this->queryParams[$key] ?? $default;
    }

    public function post(string $key, mixed $default = null): mixed
    {
        return $this->postParams[$key] ?? $default;
    }

    public function file(string $key): ?array
    {
        $file = $this->files[$key] ?? null;
        return is_array($file) ? $file : null;
    }

    public function header(string $name, mixed $default = null): mixed
    {
        $serverKey = 'HTTP_' . strtoupper(str_replace('-', '_', $name));
        return $this->server[$serverKey] ?? $default;
    }

    public function body(): array
    {
        if ($this->jsonBody !== null) {
            return $this->jsonBody;
        }

        if (trim($this->rawBody) === '') {
            $this->jsonBody = [];
            return $this->jsonBody;
        }

        $decoded = json_decode($this->rawBody, true);
        if (!is_array($decoded)) {
            throw new ValidationException('Request body must be valid JSON.');
        }

        $this->jsonBody = $decoded;
        return $this->jsonBody;
    }

    public function rawBody(): string
    {
        return $this->rawBody;
    }

    public function server(string $key, mixed $default = null): mixed
    {
        return $this->server[$key] ?? $default;
    }

    public function setAttribute(string $key, mixed $value): void
    {
        $this->attributes[$key] = $value;
    }

    public function attribute(string $key, mixed $default = null): mixed
    {
        return $this->attributes[$key] ?? $default;
    }
}
