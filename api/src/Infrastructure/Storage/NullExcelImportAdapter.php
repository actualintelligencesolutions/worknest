<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Storage;

use Worknest\Api\Application\Exceptions\ApiException;

final class NullExcelImportAdapter implements ExcelImportAdapter
{
    public function parse(string $path): array
    {
        throw new ApiException('XLSX_UNAVAILABLE', 'XLSX parsing is not enabled in this environment yet.', 500);
    }
}
