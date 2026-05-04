<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Storage;

use Worknest\Api\Application\Exceptions\ApiException;

final class FileStorageService
{
    public function __construct(private readonly string $basePath)
    {
    }

    public function ensureDirectory(string $relativePath): string
    {
        $path = rtrim($this->basePath, '/') . '/' . trim($relativePath, '/');
        if (!is_dir($path) && !mkdir($path, 0775, true) && !is_dir($path)) {
            throw new ApiException('STORAGE_ERROR', 'Unable to create storage directory.', 500);
        }

        return $path;
    }

    public function storeUploadedFile(array $file, string $relativeDirectory, string $storedFilename): string
    {
        $directory = $this->ensureDirectory($relativeDirectory);
        $target = $directory . '/' . $storedFilename;

        if (!move_uploaded_file((string) $file['tmp_name'], $target)) {
            throw new ApiException('STORAGE_ERROR', 'Unable to store uploaded file.', 500);
        }

        return $target;
    }

    public function write(string $relativePath, string $content): string
    {
        $directory = dirname($relativePath);
        $this->ensureDirectory($directory);
        $fullPath = rtrim($this->basePath, '/') . '/' . ltrim($relativePath, '/');
        if (file_put_contents($fullPath, $content) === false) {
            throw new ApiException('STORAGE_ERROR', 'Unable to write file.', 500);
        }

        return $fullPath;
    }

    public function absolutePath(string $relativePath): string
    {
        return rtrim($this->basePath, '/') . '/' . ltrim($relativePath, '/');
    }
}
