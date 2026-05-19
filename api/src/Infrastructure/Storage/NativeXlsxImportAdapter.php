<?php

declare(strict_types=1);

namespace Worknest\Api\Infrastructure\Storage;

use SimpleXMLElement;
use Worknest\Api\Application\Exceptions\ValidationException;
use ZipArchive;

final class NativeXlsxImportAdapter implements ExcelImportAdapter
{
    private const NS_MAIN = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
    private const NS_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
    private const NS_PKG_REL = 'http://schemas.openxmlformats.org/package/2006/relationships';

    public function parse(string $path): array
    {
        $zip = new ZipArchive();
        if ($zip->open($path) !== true) {
            throw new ValidationException('Uploaded XLSX file could not be opened.');
        }

        try {
            $workbookXml = $this->zipString($zip, 'xl/workbook.xml');
            $workbookRelsXml = $this->zipString($zip, 'xl/_rels/workbook.xml.rels');
            $sharedStrings = $this->sharedStrings($zip);
            $sheetTargets = $this->sheetTargets($workbookXml, $workbookRelsXml);

            $sheets = [];
            foreach ($sheetTargets as $sheetName => $target) {
                $sheetXml = $this->zipString($zip, $target);
                $sheets[$sheetName] = $this->parseSheet($sheetXml, $sharedStrings);
            }

            return ['sheets' => $sheets];
        } finally {
            $zip->close();
        }
    }

    private function sharedStrings(ZipArchive $zip): array
    {
        if ($zip->locateName('xl/sharedStrings.xml') === false) {
            return [];
        }

        $xml = $this->zipString($zip, 'xl/sharedStrings.xml');
        $root = $this->xml($xml);
        $values = [];

        foreach ($this->xpath($root, '//main:si', ['main' => self::NS_MAIN]) as $item) {
            $textNodes = $this->xpath($item, './/main:t', ['main' => self::NS_MAIN]);
            if ($textNodes === []) {
                $values[] = '';
                continue;
            }

            if (count($textNodes) === 1) {
                $values[] = (string) $textNodes[0];
                continue;
            }

            $parts = [];
            foreach ($textNodes as $node) {
                $parts[] = (string) $node;
            }
            $values[] = implode('', $parts);
        }

        return $values;
    }

    private function sheetTargets(string $workbookXml, string $relsXml): array
    {
        $workbook = $this->xml($workbookXml);
        $rels = $this->xml($relsXml);

        $relationshipMap = [];
        foreach ($this->xpath($rels, '//pkg:Relationship', ['pkg' => self::NS_PKG_REL]) as $relationship) {
            $attributes = $relationship->attributes();
            $relationshipMap[(string) $attributes['Id']] = $this->normalizeWorksheetTarget((string) $attributes['Target']);
        }

        $sheets = [];
        foreach ($this->xpath($workbook, '//main:sheets/main:sheet', ['main' => self::NS_MAIN, 'r' => self::NS_REL]) as $sheet) {
            $name = trim((string) $sheet['name']);
            $relationshipId = (string) $sheet->attributes('r', true)['id'];
            if ($name === '' || $relationshipId === '' || !isset($relationshipMap[$relationshipId])) {
                continue;
            }
            $sheets[$name] = $relationshipMap[$relationshipId];
        }

        return $sheets;
    }

    private function parseSheet(string $xml, array $sharedStrings): array
    {
        $sheet = $this->xml($xml);
        $rows = [];

        foreach ($this->xpath($sheet, '//main:sheetData/main:row', ['main' => self::NS_MAIN]) as $rowNode) {
            $rowValues = [];
            foreach ($this->xpath($rowNode, './main:c', ['main' => self::NS_MAIN]) as $cell) {
                $reference = (string) ($cell['r'] ?? '');
                $columnIndex = $this->columnIndexFromReference($reference);
                $rowValues[$columnIndex] = $this->cellValue($cell, $sharedStrings);
            }
            if ($rowValues === []) {
                continue;
            }
            ksort($rowValues);
            $rows[] = $rowValues;
        }

        return $this->tabularizeRows($rows);
    }

    private function tabularizeRows(array $rows): array
    {
        $headerRow = null;
        $headerIndex = null;

        foreach ($rows as $index => $row) {
            $flat = array_map(fn (mixed $value): string => trim((string) $value), $row);
            if (array_filter($flat, static fn (string $value): bool => $value !== '') === []) {
                continue;
            }
            $headerRow = $flat;
            $headerIndex = $index;
            break;
        }

        if ($headerRow === null) {
            return ['headers' => [], 'rows' => []];
        }

        $highestIndex = max(array_keys($headerRow));
        $headers = [];
        for ($index = 0; $index <= $highestIndex; $index++) {
            $headers[] = trim((string) ($headerRow[$index] ?? ''));
        }

        $records = [];
        foreach (array_slice($rows, $headerIndex + 1) as $row) {
            $record = [];
            foreach ($headers as $index => $header) {
                $record[$header] = trim((string) ($row[$index] ?? ''));
            }
            $records[] = $record;
        }

        return [
            'headers' => $headers,
            'rows' => $records,
        ];
    }

    private function cellValue(SimpleXMLElement $cell, array $sharedStrings): string
    {
        $type = (string) ($cell['t'] ?? '');

        if ($type === 'inlineStr') {
            $inline = $this->xpath($cell, './main:is/main:t', ['main' => self::NS_MAIN]);

            return trim((string) ($inline[0] ?? ''));
        }

        $valueNodes = $this->xpath($cell, './main:v', ['main' => self::NS_MAIN]);
        $value = trim((string) ($valueNodes[0] ?? ''));

        if ($type === 's') {
            $index = (int) $value;
            return trim((string) ($sharedStrings[$index] ?? ''));
        }

        if ($type === 'b') {
            return $value === '1' ? 'TRUE' : 'FALSE';
        }

        return $value;
    }

    private function columnIndexFromReference(string $reference): int
    {
        $letters = preg_replace('/[^A-Z]/', '', strtoupper($reference)) ?? '';
        $index = 0;

        for ($i = 0, $length = strlen($letters); $i < $length; $i++) {
            $index = ($index * 26) + (ord($letters[$i]) - 64);
        }

        return max(0, $index - 1);
    }

    private function normalizeWorksheetTarget(string $target): string
    {
        $normalized = ltrim($target, '/');
        if (str_starts_with($normalized, 'xl/')) {
            return $normalized;
        }

        return 'xl/' . ltrim($normalized, '/');
    }

    private function zipString(ZipArchive $zip, string $path): string
    {
        $contents = $zip->getFromName($path);
        if (!is_string($contents)) {
            throw new ValidationException('Uploaded XLSX file is missing workbook data.');
        }

        return $contents;
    }

    private function xml(string $xml): SimpleXMLElement
    {
        $root = simplexml_load_string($xml);
        if (!$root instanceof SimpleXMLElement) {
            throw new ValidationException('Uploaded XLSX file could not be parsed.');
        }

        return $root;
    }

    /**
     * @return SimpleXMLElement[]
     */
    private function xpath(SimpleXMLElement $element, string $query, array $namespaces): array
    {
        foreach ($namespaces as $prefix => $namespace) {
            $element->registerXPathNamespace($prefix, $namespace);
        }

        $result = $element->xpath($query);

        return is_array($result) ? $result : [];
    }
}
