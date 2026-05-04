<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Storage;

use Worknest\Api\Application\Exceptions\ValidationException;

final class CsvParser
{
    public function parse(string $path): array
    {
        $handle = fopen($path, 'r');
        if ($handle === false) {
            throw new ValidationException('Uploaded file could not be read.');
        }

        $headers = fgetcsv($handle);
        if (!is_array($headers) || $headers === []) {
            fclose($handle);
            throw new ValidationException('Payroll file must include a header row.');
        }

        $headers = array_map(static fn (mixed $value): string => trim((string) $value), $headers);
        $rows = [];

        while (($row = fgetcsv($handle)) !== false) {
            if (count(array_filter($row, static fn (mixed $value): bool => trim((string) $value) !== '')) === 0) {
                continue;
            }

            $record = [];
            foreach ($headers as $index => $header) {
                $record[$header] = trim((string) ($row[$index] ?? ''));
            }
            $rows[] = $record;
        }

        fclose($handle);

        return [
            'headers' => $headers,
            'rows' => $rows,
        ];
    }
}
