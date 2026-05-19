<?php

declare(strict_types=1);

namespace Worknest\Api\Application\Http;

final class Response
{
    public function __construct(
        private readonly int $statusCode = 200,
        private readonly array $headers = [],
        private readonly string $content = ''
    ) {
    }

    public static function json(array $payload, int $statusCode = 200, array $headers = []): self
    {
        $headers['Content-Type'] = 'application/json';
        return new self(
            $statusCode,
            $headers,
            (string) json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
        );
    }

    public static function success(mixed $data = null, int $statusCode = 200): self
    {
        return self::json([
            'success' => true,
            'data' => $data,
            'error' => null,
        ], $statusCode);
    }

    public static function error(string $code, string $message, int $statusCode, array $details = []): self
    {
        return self::json([
            'success' => false,
            'data' => null,
            'error' => [
                'code' => $code,
                'message' => $message,
                'details' => $details,
            ],
        ], $statusCode);
    }

    public static function file(string $path, string $contentType, string $filename): self
    {
        return self::binary(
            (string) file_get_contents($path),
            $contentType,
            $filename
        );
    }

    public static function binary(string $content, string $contentType, string $filename): self
    {
        return new self(200, [
            'Content-Type' => $contentType,
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
        ], $content);
    }

    public function send(): void
    {
        http_response_code($this->statusCode);
        foreach ($this->headers as $name => $value) {
            header($name . ': ' . $value);
        }
        echo $this->content;
    }
}
