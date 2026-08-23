<?php

declare(strict_types=1);

namespace Worknest\Api\Domain\Payslip;

use Worknest\Api\Infrastructure\Storage\FileStorageService;

final class PayslipPdfGenerator
{
    private const PAGE_WIDTH = 595.28;
    private const PAGE_HEIGHT = 841.89;
    private const MARGIN_X = 24.0;
    private const MARGIN_Y = 28.0;
    private const CONTENT_WIDTH = 547.28;

    private const LAYOUT_SIMPLE = 'simple';
    private const LAYOUT_MINT_MODERN = 'mint_modern';
    private const LAYOUT_STATEMENT_GRID = 'statement_grid';

    public function __construct(
        private readonly FileStorageService $fileStorage,
    ) {
    }

    public function generateFromPayslip(array $payslip, ?array $office = null): string
    {
        return $this->render($this->buildModel(
            $payslip,
            $office,
            (int) ($payslip['period_year'] ?? date('Y')),
            (int) ($payslip['period_month'] ?? date('n'))
        ));
    }

    public function generateFromRecord(array $record, array $batch, ?array $office = null): string
    {
        $payload = array_merge($record, [
            'period_year' => (int) ($batch['period_year'] ?? date('Y')),
            'period_month' => (int) ($batch['period_month'] ?? date('n')),
            'status' => 'published',
        ]);

        return $this->render($this->buildModel(
            $payload,
            $office,
            (int) ($batch['period_year'] ?? date('Y')),
            (int) ($batch['period_month'] ?? date('n'))
        ));
    }

    public function resolveLayoutKey(?string $layoutKey): string
    {
        $normalized = strtolower(trim((string) $layoutKey));

        return match ($normalized) {
            '', 'simple', 'clean_classic' => self::LAYOUT_SIMPLE,
            self::LAYOUT_MINT_MODERN => self::LAYOUT_MINT_MODERN,
            self::LAYOUT_STATEMENT_GRID => self::LAYOUT_STATEMENT_GRID,
            default => self::LAYOUT_SIMPLE,
        };
    }

    private function buildModel(array $payload, ?array $office, int $periodYear, int $periodMonth): array
    {
        $settings = $this->decodeJson($office['settings_json'] ?? null);
        $layout = $this->resolveLayoutKey(is_string($settings['payslip_template_key'] ?? null) ? $settings['payslip_template_key'] : null);
        $earnings = $this->decodeJson($payload['earnings_json'] ?? ($payload['earnings'] ?? []));
        $deductions = $this->decodeJson($payload['deductions_json'] ?? ($payload['deductions'] ?? []));
        $basicAmount = $this->firstAmount($payload, ['basic_rate'])
            ?? $this->firstAmount($earnings, ['basic', 'basic_rate', 'basic_salary', 'wages_earned']);
        $otHours = $this->firstString($payload, ['ot_hours', 'overtime_hours']);
        $otAmount = $this->firstAmount($earnings, ['ot_amount', 'overtime_amount']);

        $earningRows = $this->buildEarningRows($earnings, (float) ($payload['gross_pay'] ?? 0), $otAmount);
        $deductionRows = $this->buildDeductionRows($deductions);

        return [
            'layout' => $layout,
            'company_name' => trim((string) ($office['company_name'] ?? $office['tenant_name'] ?? 'Worknest')),
            'payslip_header_image_path' => is_array($settings['payslip_header_image'] ?? null) && is_string(($settings['payslip_header_image']['path'] ?? null))
                ? $settings['payslip_header_image']['path']
                : null,
            'month_label' => $this->formatPeriod($periodYear, $periodMonth),
            'employee_name' => trim((string) ($payload['employee_name_snapshot'] ?? 'Payslip')),
            'father_name' => $this->firstString($payload, ['father_name', 'fathers_name', 'father', 'guardian_name', 'guardian', 'parent_name']),
            'designation' => $this->firstString($payload, ['designation_snapshot', 'designation']),
            'employee_id' => trim((string) ($payload['employee_id'] ?? '')),
            'office_name' => trim((string) ($office['name'] ?? 'Worknest')),
            'office_code' => trim((string) ($office['office_code'] ?? '')),
            'basic_rate' => $basicAmount,
            'days_paid' => $this->firstString($payload, ['days_paid']),
            'ot_hours' => $otHours,
            'doj' => $this->formatDisplayDate($this->firstString($payload, ['date_of_joining', 'doj'])),
            'uan' => $this->firstString($payload, ['uan']),
            'bank' => $this->firstString($payload, ['bank']),
            'account_number' => $this->firstString($payload, ['account_number', 'bank_account_number']),
            'ifsc' => $this->firstString($payload, ['ifsc']),
            'gross_pay' => (float) ($payload['gross_pay'] ?? 0),
            'total_deductions' => (float) ($payload['total_deductions'] ?? 0),
            'net_pay' => (float) ($payload['net_pay'] ?? 0),
            'currency' => trim((string) ($payload['currency'] ?? 'INR')) ?: 'INR',
            'status' => trim((string) ($payload['status'] ?? 'published')),
            'earning_rows' => $earningRows,
            'deduction_rows' => $deductionRows,
            'note' => 'Note: This is system generated payslip and does not require signature',
        ];
    }

    private function buildEarningRows(array $earnings, float $grossPay, ?float $otAmount): array
    {
        $rows = [];
        foreach ($earnings as $key => $amount) {
            if (!is_string($key) || !is_numeric($amount)) {
                continue;
            }

            $rows[] = [
                'label' => $this->displayLabelForPayrollHead($key, true),
                'amount' => round((float) $amount, 2),
            ];
        }

        if ($rows === []) {
            $rows[] = ['label' => 'Wages Earned', 'amount' => $grossPay];
            if ($otAmount !== null) {
                $rows[] = ['label' => 'OT Amount', 'amount' => $otAmount];
            }
        }

        return $rows;
    }

    private function buildDeductionRows(array $deductions): array
    {
        $rows = [];
        foreach ($deductions as $key => $amount) {
            if (!is_string($key) || !is_numeric($amount)) {
                continue;
            }

            $rows[] = [
                'label' => $this->displayLabelForPayrollHead($key, false),
                'amount' => round((float) $amount, 2),
            ];
        }

        return $rows;
    }

    private function render(array $model): string
    {
        $layoutStyles = $this->layoutStyles($model['layout']);
        $commands = [];
        $headerAsset = $this->loadHeaderImageAsset($model['payslip_header_image_path'] ?? null);
        $y = self::MARGIN_Y;
        $x = self::MARGIN_X;
        $colWidths = [108.0, 180.0, 112.0, 147.28];

        if ($headerAsset !== null) {
            $placement = $this->fitImageBox((float) $headerAsset['width'], (float) $headerAsset['height'], self::CONTENT_WIDTH, 72.0);
            $headerHeight = max(44.0, $placement['height']);
            $headerTop = $y + (($headerHeight - $placement['height']) / 2);
            $this->drawImage($commands, 'Im1', $x, $headerTop, $placement['width'], $placement['height']);
            $this->drawBorder($commands, $x, $y, self::CONTENT_WIDTH, $headerHeight, 0.8, $layoutStyles['border']);
            $y += $headerHeight;
        } else {
            $this->drawFilledRect($commands, $x, $y, self::CONTENT_WIDTH, 44, $layoutStyles['banner_fill']);
            $this->drawBorder($commands, $x, $y, self::CONTENT_WIDTH, 44, 1.2, $layoutStyles['border']);
            $brandTextX = $x + 16;
            $this->drawText(
                $commands,
                $brandTextX,
                $y + 13,
                trim((string) ($model['company_name'] !== '' ? $model['company_name'] : 'Worknest')),
                18,
                true,
                $layoutStyles['banner_text']
            );
            $this->drawText(
                $commands,
                $x + self::CONTENT_WIDTH - 16,
                $y + 14,
                trim(($model['office_name'] !== '' ? $model['office_name'] : 'Employee Payslip') . ($model['office_code'] !== '' ? ' | ' . $model['office_code'] : '')),
                10,
                false,
                $layoutStyles['banner_text'],
                'right'
            );
            $y += 44;
        }

        $legalHeaderRow = [
            ['text' => $model['layout'] === self::LAYOUT_SIMPLE ? 'FORM XVI Rule 72(2)' : strtoupper(str_replace('_', ' ', $model['layout'])), 'align' => 'center', 'colspan' => 4],
        ];
        $legalHeaderHeight = $this->measureRowHeight($colWidths, $legalHeaderRow, 22.0);
        $this->drawSimpleRow($commands, $x, $y, $colWidths, $legalHeaderRow, $legalHeaderHeight, $layoutStyles, true);
        $y += $legalHeaderHeight;

        $identityRows = [
            [
                ['text' => 'WAGE SLIP - ' . $model['month_label'], 'bold' => true, 'align' => 'center', 'colspan' => 4],
            ],
            [
                ['text' => 'NAME'],
                ['text' => $model['employee_name'], 'bold' => true],
                ['text' => "FATHER'S NAME"],
                ['text' => $model['father_name'], 'bold' => true],
            ],
            [
                ['text' => 'ID'],
                ['text' => $model['employee_id'], 'bold' => true],
                ['text' => 'Basic Rate'],
                ['text' => $this->formatMoney($model['basic_rate'], $model['currency']), 'bold' => true, 'align' => 'right'],
            ],
            [
                ['text' => 'Days Paid'],
                ['text' => $model['days_paid'], 'bold' => true],
                ['text' => 'OT Hours'],
                ['text' => $model['ot_hours'], 'bold' => true],
            ],
            [
                ['text' => 'D.O.J'],
                ['text' => $model['doj'], 'bold' => true],
                ['text' => 'UAN'],
                ['text' => $model['uan'], 'bold' => true],
            ],
            [
                ['text' => 'Bank'],
                ['text' => $model['bank'], 'bold' => true],
                ['text' => 'A/c No'],
                ['text' => $model['account_number'], 'bold' => true],
            ],
            [
                ['text' => 'IFSC'],
                ['text' => $model['ifsc'], 'bold' => true],
                ['text' => 'Designation'],
                ['text' => $model['designation'], 'bold' => true],
            ],
        ];

        foreach ($identityRows as $row) {
            $rowHeight = $this->measureRowHeight($colWidths, $row, 22.0);
            $this->drawSimpleRow($commands, $x, $y, $colWidths, $row, $rowHeight, $layoutStyles);
            $y += $rowHeight;
        }

        $earningDeductionHeaderRow = [
            ['text' => 'EARNING', 'colspan' => 2, 'bold' => true, 'align' => 'center'],
            ['text' => 'DEDUCTION', 'colspan' => 2, 'bold' => true, 'align' => 'center'],
        ];
        $earningDeductionHeaderHeight = $this->measureRowHeight($colWidths, $earningDeductionHeaderRow, 24.0);
        $this->drawSimpleRow($commands, $x, $y, $colWidths, $earningDeductionHeaderRow, $earningDeductionHeaderHeight, $layoutStyles, true);
        $y += $earningDeductionHeaderHeight;

        $pairedRows = max(count($model['earning_rows']), count($model['deduction_rows']), 4);
        for ($index = 0; $index < $pairedRows; $index++) {
            $earning = $model['earning_rows'][$index] ?? ['label' => '', 'amount' => null];
            $deduction = $model['deduction_rows'][$index] ?? ['label' => '', 'amount' => null];

            $earningDeductionRow = [
                ['text' => $earning['label']],
                ['text' => $this->formatMoney($earning['amount'], $model['currency'], false), 'align' => 'right'],
                ['text' => $deduction['label']],
                ['text' => $this->formatMoney($deduction['amount'], $model['currency'], false), 'align' => 'right'],
            ];
            $earningDeductionRowHeight = $this->measureRowHeight($colWidths, $earningDeductionRow, 22.0);
            $this->drawSimpleRow($commands, $x, $y, $colWidths, $earningDeductionRow, $earningDeductionRowHeight, $layoutStyles);
            $y += $earningDeductionRowHeight;
        }

        $grossTotalsRow = [
            ['text' => 'GROSS AMT', 'bold' => true],
            ['text' => $this->formatMoney($model['gross_pay'], $model['currency'], false), 'bold' => true, 'align' => 'right'],
            ['text' => 'Total Deduction', 'bold' => true],
            ['text' => $this->formatMoney($model['total_deductions'], $model['currency'], false), 'bold' => true, 'align' => 'right'],
        ];
        $grossTotalsHeight = $this->measureRowHeight($colWidths, $grossTotalsRow, 24.0);
        $this->drawSimpleRow($commands, $x, $y, $colWidths, $grossTotalsRow, $grossTotalsHeight, $layoutStyles, true);
        $y += $grossTotalsHeight;

        $netPayRow = [
            ['text' => 'Net Pay Credited to Bank A/c', 'bold' => true, 'colspan' => 2],
            ['text' => $this->formatMoney($model['net_pay'], $model['currency']), 'bold' => true, 'colspan' => 2, 'align' => 'center'],
        ];
        $netPayHeight = $this->measureRowHeight($colWidths, $netPayRow, 28.0);
        $this->drawSimpleRow($commands, $x, $y, $colWidths, $netPayRow, $netPayHeight, $layoutStyles, true);
        $y += $netPayHeight + 12;

        $noteTop = min($y, self::PAGE_HEIGHT - 64);
        $this->drawText($commands, $x, $noteTop, $model['note'], 10, false, [0.2, 0.2, 0.2]);

        return $this->buildPdf(implode("\n", $commands), $headerAsset);
    }

    private function drawSimpleRow(
        array &$commands,
        float $x,
        float $top,
        array $colWidths,
        array $cells,
        float $height,
        array $styles,
        bool $fill = false
    ): void {
        $cursorX = $x;
        if ($fill) {
            $this->drawFilledRect($commands, $x, $top, array_sum($colWidths), $height, $styles['header_fill']);
        }
        $this->drawBorder($commands, $x, $top, array_sum($colWidths), $height, 0.8, $styles['border']);

        $colIndex = 0;
        foreach ($cells as $cell) {
            $colspan = max(1, (int) ($cell['colspan'] ?? 1));
            $width = array_sum(array_slice($colWidths, $colIndex, $colspan));
            if ($colIndex > 0) {
                $this->drawLine($commands, $cursorX, $top, $cursorX, $top + $height, 0.8, $styles['border']);
            }

            $text = trim((string) ($cell['text'] ?? ''));
            $align = (string) ($cell['align'] ?? 'left');
            $isBold = (bool) ($cell['bold'] ?? false);
            $this->drawCellText($commands, $cursorX, $top, $width, $height, $text, $align, $isBold, $styles['text']);

            $cursorX += $width;
            $colIndex += $colspan;
        }
    }

    private function drawCellText(
        array &$commands,
        float $x,
        float $top,
        float $width,
        float $height,
        string $text,
        string $align,
        bool $bold,
        array $color
    ): void {
        $fontSize = 10.0;
        $lines = $this->wrapText($text, $width - 10, $fontSize);
        if ($lines === []) {
            $lines = [''];
        }

        $lineHeight = 11.0;
        $startTop = $top + max(6.0, ($height - (count($lines) * $lineHeight)) / 2 + 2);

        foreach ($lines as $lineIndex => $line) {
            $lineX = match ($align) {
                'right' => $x + $width - 6,
                'center' => $x + ($width / 2),
                default => $x + 6,
            };

            $this->drawText(
                $commands,
                $lineX,
                $startTop + ($lineIndex * $lineHeight),
                $line,
                $fontSize,
                $bold,
                $color,
                $align
            );
        }
    }

    private function measureRowHeight(array $colWidths, array $cells, float $minimumHeight): float
    {
        $fontSize = 10.0;
        $lineHeight = 11.0;
        $colIndex = 0;
        $maxLines = 1;

        foreach ($cells as $cell) {
            $colspan = max(1, (int) ($cell['colspan'] ?? 1));
            $width = array_sum(array_slice($colWidths, $colIndex, $colspan));
            $text = trim((string) ($cell['text'] ?? ''));
            $lines = $this->wrapText($text, $width - 10, $fontSize);
            $maxLines = max($maxLines, max(1, count($lines)));
            $colIndex += $colspan;
        }

        return max($minimumHeight, 12.0 + ($maxLines * $lineHeight));
    }

    private function drawText(
        array &$commands,
        float $x,
        float $top,
        string $text,
        float $fontSize,
        bool $bold,
        array $color,
        string $align = 'left'
    ): void {
        $escaped = $this->escapeText($text);
        $adjustedX = $x;
        if ($align === 'center') {
            $adjustedX = $x - ($this->estimateTextWidth($text, $fontSize) / 2);
        } elseif ($align === 'right') {
            $adjustedX = $x - $this->estimateTextWidth($text, $fontSize);
        }

        $commands[] = sprintf(
            'BT /%s %.2F Tf %.3F %.3F %.3F rg 1 0 0 1 %.2F %.2F Tm (%s) Tj ET',
            $bold ? 'F2' : 'F1',
            $fontSize,
            $color[0],
            $color[1],
            $color[2],
            $adjustedX,
            $this->pdfY($top + ($fontSize * 0.82)),
            $escaped
        );
    }

    private function drawImage(
        array &$commands,
        string $resourceName,
        float $x,
        float $top,
        float $width,
        float $height
    ): void {
        $commands[] = sprintf(
            'q %.2F 0 0 %.2F %.2F %.2F cm /%s Do Q',
            $width,
            $height,
            $x,
            $this->pdfY($top + $height),
            $resourceName
        );
    }

    private function drawFilledRect(array &$commands, float $x, float $top, float $width, float $height, array $fillColor): void
    {
        $commands[] = sprintf(
            'q %.3F %.3F %.3F rg %.2F %.2F %.2F %.2F re f Q',
            $fillColor[0],
            $fillColor[1],
            $fillColor[2],
            $x,
            $this->pdfY($top + $height),
            $width,
            $height
        );
    }

    private function drawBorder(array &$commands, float $x, float $top, float $width, float $height, float $lineWidth, array $strokeColor): void
    {
        $commands[] = sprintf(
            'q %.2F w %.3F %.3F %.3F RG %.2F %.2F %.2F %.2F re S Q',
            $lineWidth,
            $strokeColor[0],
            $strokeColor[1],
            $strokeColor[2],
            $x,
            $this->pdfY($top + $height),
            $width,
            $height
        );
    }

    private function drawLine(array &$commands, float $x1, float $top1, float $x2, float $top2, float $lineWidth, array $strokeColor): void
    {
        $commands[] = sprintf(
            'q %.2F w %.3F %.3F %.3F RG %.2F %.2F m %.2F %.2F l S Q',
            $lineWidth,
            $strokeColor[0],
            $strokeColor[1],
            $strokeColor[2],
            $x1,
            $this->pdfY($top1),
            $x2,
            $this->pdfY($top2)
        );
    }

    private function buildPdf(string $stream, ?array $imageAsset = null): string
    {
        $logoObjectId = $imageAsset !== null ? 6 : null;
        $contentObjectId = $imageAsset !== null ? 7 : 6;
        $resourceDictionary = '/Font << /F1 4 0 R /F2 5 0 R >>';
        if ($logoObjectId !== null) {
            $resourceDictionary .= ' /XObject << /Im1 ' . $logoObjectId . ' 0 R >>';
        }

        $objects = [
            '1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj',
            '2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj',
            '3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 ' . self::PAGE_WIDTH . ' ' . self::PAGE_HEIGHT . '] /Resources << ' . $resourceDictionary . ' >> /Contents ' . $contentObjectId . ' 0 R >> endobj',
            '4 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> endobj',
            '5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >> endobj',
        ];
        if ($imageAsset !== null) {
            $objects[] = sprintf(
                '6 0 obj << /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length %d >> stream' . "\n%s\nendstream endobj",
                (int) $imageAsset['width'],
                (int) $imageAsset['height'],
                strlen((string) $imageAsset['data']),
                (string) $imageAsset['data']
            );
        }
        $objects[] = $contentObjectId . ' 0 obj << /Length ' . strlen($stream) . " >> stream\n" . $stream . "\nendstream endobj";

        $pdf = "%PDF-1.4\n";
        $offsets = [0];
        foreach ($objects as $object) {
            $offsets[] = strlen($pdf);
            $pdf .= $object . "\n";
        }

        $xref = strlen($pdf);
        $pdf .= "xref\n0 " . (count($objects) + 1) . "\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) {
            $pdf .= sprintf("%010d 00000 n \n", $offset);
        }
        $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\nstartxref\n{$xref}\n%%EOF";

        return $pdf;
    }

    private function loadLogoAsset(?string $relativePath): ?array
    {
        if ($relativePath === null || trim($relativePath) === '') {
            return null;
        }

        $absolutePath = $this->fileStorage->absolutePath($relativePath);
        return $this->loadImageAsset($absolutePath);
    }

    private function loadHeaderImageAsset(?string $relativePath): ?array
    {
        return $this->loadLogoAsset($relativePath);
    }

    private function loadImageAsset(string $absolutePath): ?array
    {
        if (!is_file($absolutePath) || !is_readable($absolutePath)) {
            return null;
        }

        $contents = @file_get_contents($absolutePath);
        if ($contents === false || $contents === '') {
            return null;
        }

        if (!function_exists('imagecreatefromstring') || !function_exists('imagejpeg')) {
            return null;
        }

        $image = @imagecreatefromstring($contents);
        if ($image === false) {
            return null;
        }

        $width = imagesx($image);
        $height = imagesy($image);
        if ($width <= 0 || $height <= 0) {
            imagedestroy($image);
            return null;
        }

        $canvas = imagecreatetruecolor($width, $height);
        if ($canvas === false) {
            imagedestroy($image);
            return null;
        }

        $background = imagecolorallocate($canvas, 255, 255, 255);
        imagefill($canvas, 0, 0, $background);
        imagecopy($canvas, $image, 0, 0, 0, 0, $width, $height);

        ob_start();
        imagejpeg($canvas, null, 90);
        $jpegData = ob_get_clean();

        imagedestroy($canvas);
        imagedestroy($image);

        if (!is_string($jpegData) || $jpegData === '') {
            return null;
        }

        return [
            'width' => $width,
            'height' => $height,
            'data' => $jpegData,
        ];
    }

    private function fitImageBox(float $imageWidth, float $imageHeight, float $maxWidth, float $maxHeight): array
    {
        if ($imageWidth <= 0 || $imageHeight <= 0) {
            return ['width' => 0.0, 'height' => 0.0];
        }

        $scale = min($maxWidth / $imageWidth, $maxHeight / $imageHeight, 1.0);

        return [
            'width' => round($imageWidth * $scale, 2),
            'height' => round($imageHeight * $scale, 2),
        ];
    }

    private function layoutStyles(string $layout): array
    {
        return match ($layout) {
            self::LAYOUT_MINT_MODERN => [
                'banner_fill' => [0.79, 0.92, 0.88],
                'header_fill' => [0.90, 0.97, 0.95],
                'banner_text' => [0.07, 0.28, 0.24],
                'border' => [0.19, 0.46, 0.41],
                'text' => [0.08, 0.18, 0.16],
            ],
            self::LAYOUT_STATEMENT_GRID => [
                'banner_fill' => [0.88, 0.89, 0.92],
                'header_fill' => [0.94, 0.95, 0.96],
                'banner_text' => [0.15, 0.18, 0.24],
                'border' => [0.28, 0.31, 0.36],
                'text' => [0.15, 0.16, 0.18],
            ],
            default => [
                'banner_fill' => [0.95, 0.95, 0.95],
                'header_fill' => [0.94, 0.94, 0.94],
                'banner_text' => [0.0, 0.0, 0.0],
                'border' => [0.0, 0.0, 0.0],
                'text' => [0.0, 0.0, 0.0],
            ],
        };
    }

    private function wrapText(string $text, float $maxWidth, float $fontSize): array
    {
        $trimmed = trim($text);
        if ($trimmed === '') {
            return [];
        }

        $words = preg_split('/\s+/', $trimmed) ?: [];
        $lines = [];
        $line = '';

        foreach ($words as $word) {
            $candidate = $line === '' ? $word : $line . ' ' . $word;
            if ($this->estimateTextWidth($candidate, $fontSize) <= $maxWidth) {
                $line = $candidate;
                continue;
            }

            if ($line !== '') {
                $lines[] = $line;
            }
            $line = $word;
        }

        if ($line !== '') {
            $lines[] = $line;
        }

        return $lines;
    }

    private function estimateTextWidth(string $text, float $fontSize): float
    {
        return strlen($text) * ($fontSize * 0.56);
    }

    private function pdfY(float $top): float
    {
        return self::PAGE_HEIGHT - $top;
    }

    private function escapeText(string $text): string
    {
        return str_replace(
            ['\\', '(', ')'],
            ['\\\\', '\\(', '\\)'],
            preg_replace('/[[:^print:]]/', ' ', $text) ?? ''
        );
    }

    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }

        if (!is_string($value) || trim($value) === '') {
            return [];
        }

        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function amountForKey(array $values, string $key): ?float
    {
        foreach ($values as $candidateKey => $candidateValue) {
            if (!is_string($candidateKey) || $this->normalizeKey($candidateKey) !== $this->normalizeKey($key)) {
                continue;
            }

            if (!is_numeric($candidateValue)) {
                return null;
            }

            return round((float) $candidateValue, 2);
        }

        return null;
    }

    private function firstAmount(array $values, array $keys): ?float
    {
        foreach ($keys as $key) {
            $amount = $this->amountForKey($values, $key);
            if ($amount !== null) {
                return $amount;
            }
        }

        return null;
    }

    private function firstString(array $values, array $keys): string
    {
        foreach ($keys as $key) {
            if (!isset($values[$key])) {
                continue;
            }

            $string = trim((string) $values[$key]);
            if ($string !== '') {
                return $string;
            }
        }

        return '';
    }

    private function formatPeriod(int $year, int $month): string
    {
        $month = max(1, min(12, $month));
        $date = \DateTimeImmutable::createFromFormat('!Y-n', $year . '-' . $month);

        return $date instanceof \DateTimeImmutable
            ? $date->format('F Y')
            : sprintf('%02d/%04d', $month, $year);
    }

    private function formatMoney(?float $amount, string $currency, bool $withSymbol = true): string
    {
        if ($amount === null) {
            return '';
        }

        $prefix = $withSymbol ? strtoupper($currency) . ' ' : '';

        return $prefix . number_format($amount, 2, '.', ',');
    }

    private function formatDisplayDate(string $value): string
    {
        $trimmed = trim($value);
        if ($trimmed === '') {
            return '';
        }

        $timestamp = strtotime($trimmed);

        return $timestamp === false ? $trimmed : date('d-M-y', $timestamp);
    }

    private function displayLabelForPayrollHead(string $value, bool $isEarning): string
    {
        $normalized = $this->normalizeKey($value);
        $legacyMap = $isEarning
            ? [
                'basic' => 'Wages Earned',
                'basicrate' => 'Wages Earned',
                'basicsalary' => 'Wages Earned',
                'wagesearned' => 'Wages Earned',
                'hra' => 'HRA',
                'allowances' => 'Allowances',
                'specialallowance' => 'Allowances',
                'projallowance' => 'Proj Allowance',
                'projectallowance' => 'Proj Allowance',
                'vallowance' => 'V Allowance',
                'otamount' => 'OT Amount',
                'overtimeamount' => 'OT Amount',
                'hallowance' => 'H Allowance',
                'housingallowance' => 'H Allowance',
                'sallowance' => 'S Allowance',
                'scada' => 'SCA / DA',
                'messallow' => 'Mess Allow',
                'messallowance' => 'Mess Allow',
                'bonus833' => 'Bonus @ 8.33%',
                'bonus' => 'Bonus @ 8.33%',
                'areaallowance' => 'Area Allowance',
                'washingallowance' => 'Washing Allowance',
                'performanceallowance' => 'Performance Allowance',
            ]
            : [
                'pf' => 'EPF',
                'epf' => 'EPF',
                'esi' => 'ESI',
                'mess' => 'Mess',
                'advance' => 'Advance',
                'professionaltax' => 'Professional Tax',
                'pt' => 'Professional Tax',
                'tds' => 'TDS',
            ];

        if (isset($legacyMap[$normalized])) {
            return $legacyMap[$normalized];
        }

        $trimmed = trim($value);

        return $trimmed !== '' ? $trimmed : $this->humanizeKey($value);
    }

    private function humanizeKey(string $value): string
    {
        $normalized = str_replace(['/', '_', '-'], ' ', strtolower(trim($value)));
        $normalized = preg_replace('/\s+/', ' ', $normalized) ?? $normalized;

        return ucwords($normalized);
    }

    private function normalizeKey(string $value): string
    {
        return preg_replace('/[^a-z0-9]+/', '', strtolower($value)) ?? '';
    }
}
