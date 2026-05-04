<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Storage;

interface ExcelImportAdapter
{
    public function parse(string $path): array;
}
