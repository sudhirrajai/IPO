<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use Shuchkin\SimpleXLSXGen;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CsvExportService
{
    /**
     * Sanitize cell content against CSV injection attacks.
     */
    public static function sanitizeCell(mixed $value): string
    {
        if ($value === null) {
            return '';
        }

        $str = (string) $value;

        // If cell starts with formula trigger characters, prepend single quote
        if (preg_match('/^[\=\+\-\@\t\r]/', $str)) {
            $str = "'".$str;
        }

        return $str;
    }

    /**
     * Build streamed CSV response.
     */
    public static function buildStreamResponse(string $filename, array $headers, iterable $rows): StreamedResponse
    {
        return response()->streamDownload(function () use ($headers, $rows) {
            $handle = fopen('php://output', 'w');

            // Write UTF-8 BOM for Microsoft Excel compatibility
            fwrite($handle, "\xEF\xBB\xBF");

            // Write header row
            fputcsv($handle, $headers);

            // Write data rows
            foreach ($rows as $row) {
                $sanitized = array_map([self::class, 'sanitizeCell'], $row);
                fputcsv($handle, $sanitized);
            }

            fclose($handle);
        }, $filename, [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Sanitize and limit Excel sheet name to 31 characters without prohibited characters, ensuring uniqueness.
     */
    public static function sanitizeSheetName(string $name, array &$existingNames): string
    {
        $clean = str_replace(['\\', '/', '?', '*', ':', '[', ']'], '', $name);
        $clean = trim($clean);
        if ($clean === '') {
            $clean = 'Sheet';
        }
        $clean = mb_substr($clean, 0, 31);

        $final = $clean;
        $idx = 2;
        while (in_array(strtolower($final), array_map('strtolower', $existingNames), true)) {
            $suffix = " ({$idx})";
            $prefix = mb_substr($clean, 0, 31 - mb_strlen($suffix));
            $final = $prefix . $suffix;
            $idx++;
        }

        $existingNames[] = $final;
        return $final;
    }

    /**
     * Build streamed XLSX response with cell styling and background colors.
     */
    public static function buildExcelStreamResponse(string $filename, array $sheetData): StreamedResponse
    {
        return response()->streamDownload(function () use ($sheetData) {
            $xlsx = SimpleXLSXGen::fromArray($sheetData);
            $xlsx->saveAs('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Build streamed multi-sheet XLSX response with cell styling and background colors.
     * @param array<int, array{name: string, rows: array}> $sheets
     */
    public static function buildMultiSheetExcelStreamResponse(string $filename, array $sheets): StreamedResponse
    {
        return response()->streamDownload(function () use ($sheets) {
            $xlsx = new SimpleXLSXGen();
            foreach ($sheets as $sheet) {
                $xlsx->addSheet($sheet['rows'], $sheet['name']);
            }
            $xlsx->saveAs('php://output');
        }, $filename, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0',
        ]);
    }

    /**
     * Export PAN Submission Sheet for Trader.
     * Note: Trader rates and admin margins are STRICTLY excluded to protect commercial privacy.
     */
    public static function exportTraderPanSubmission(Ipo $ipo, ?int $userId = null): StreamedResponse
    {
        $query = ApplicationBatch::with(['user', 'batchPans.userPan'])
            ->where('ipo_id', $ipo->id);

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $batches = $query->orderBy('id')->get();

        $headers = [
            'Batch ID',
            'IPO Name',
            'Symbol',
            'Name of PAN Holder',
            'PAN Number',
            'Application Count',
            'Funding Source',
            'Submission Date',
            'Application Status',
            'Trader Ref',
            'Notes',
        ];

        $rows = [];
        foreach ($batches as $batch) {
            $pans = $batch->batchPans;
            $panDisplay = $pans->count() > 0
                ? $pans->pluck('pan_number_snapshot')->join(', ')
                : ($batch->pan_number ?: 'N/A');

            $holderName = $batch->getPanHolderName();

            $rows[] = [
                $batch->batch_number,
                $ipo->company_name,
                $ipo->symbol ?? '',
                $holderName,
                $panDisplay,
                $batch->application_count,
                $batch->funding_source === 'my_money' ? 'My Money' : 'User Money',
                $batch->submission_date ?? '',
                strtoupper($batch->application_status),
                $batch->trader_reference ?? '',
                $batch->notes ?? '',
            ];
        }

        $slug = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name);
        $filename = "{$slug}_trader_pan_submission_".date('Y-m-d_His').'.csv';

        AuditService::log('csv_exported', $ipo, null, [
            'type' => 'trader_pan_submission',
            'records_count' => count($rows),
        ], "Exported trader PAN submission CSV for {$ipo->company_name}");

        return self::buildStreamResponse($filename, $headers, $rows);
    }

    /**
     * Export Complete Financial and Application Batch Report (Admin Only).
     */
    public static function exportFinancialReport(Ipo $ipo): StreamedResponse
    {
        $batches = ApplicationBatch::with(['user', 'batchPans.userPan'])
            ->where('ipo_id', $ipo->id)
            ->orderBy('id')
            ->get();

        $headers = [
            'Batch ID',
            'IPO Name',
            'User Name',
            'Applications',
            'Funding Source',
            'Trader Rate (₹)',
            'Published Rate (₹)',
            'Margin per App (₹)',
            'Total Capital (₹)',
            'Expected Gross Profit (₹)',
            'Expected User Payout (₹)',
            'Expected Net Earnings (₹)',
            'Settled Gross Profit (₹)',
            'Settled User Payout (₹)',
            'Settled Net Earnings (₹)',
            'Capital Returned (₹)',
            'Application Status',
            'Settlement Status',
            'Created Date',
        ];

        $rows = [];
        foreach ($batches as $batch) {
            $rows[] = [
                $batch->batch_number,
                $ipo->company_name,
                $batch->user->name ?? '',
                $batch->application_count,
                $batch->funding_source === 'my_money' ? 'My Money' : 'User Money',
                number_format((float) $batch->trader_rate_snapshot, 2, '.', ''),
                number_format((float) $batch->published_rate_snapshot, 2, '.', ''),
                number_format((float) $batch->margin_snapshot, 2, '.', ''),
                number_format((float) $batch->capital_amount, 2, '.', ''),
                number_format((float) $batch->expected_gross_profit, 2, '.', ''),
                number_format((float) $batch->expected_user_payout, 2, '.', ''),
                number_format((float) $batch->expected_net_earnings, 2, '.', ''),
                $batch->settled_gross_profit !== null ? number_format((float) $batch->settled_gross_profit, 2, '.', '') : 'Pending',
                $batch->settled_user_payout !== null ? number_format((float) $batch->settled_user_payout, 2, '.', '') : 'Pending',
                $batch->settled_net_earnings !== null ? number_format((float) $batch->settled_net_earnings, 2, '.', '') : 'Pending',
                $batch->capital_returned !== null ? number_format((float) $batch->capital_returned, 2, '.', '') : 'Pending',
                strtoupper($batch->application_status),
                strtoupper($batch->settlement_status),
                $batch->created_at->format('Y-m-d H:i:s'),
            ];
        }

        $slug = preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name);
        $filename = "{$slug}_financial_report_".date('Y-m-d_His').'.csv';

        AuditService::log('csv_exported', $ipo, null, [
            'type' => 'financial_report',
            'records_count' => count($rows),
        ], "Exported financial report CSV for {$ipo->company_name}");

        return self::buildStreamResponse($filename, $headers, $rows);
    }

    /**
     * Extract flattened rows for User Rates with Allotment Status, Trader Rates, and Diff Amount.
     */
    public static function getUserRatesData(?Ipo $ipo = null, ?int $userId = null): array
    {
        $query = ApplicationBatch::with(['user', 'batchPans.userPan', 'ipo'])
            ->where('application_status', '!=', 'cancelled');

        if ($ipo) {
            $query->where('ipo_id', $ipo->id);
        }

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $batches = $query->orderBy('id')->get();
        $items = [];
        $serialNo = 1;

        $formatRate = static function (float $num): string {
            return (float) $num == (int) $num ? (string) (int) $num : number_format($num, 2, '.', '');
        };

        foreach ($batches as $batch) {
            $userRate = (float) ($batch->profit_sharing_type === 'fix'
                ? $batch->profit_sharing_value
                : ($batch->published_rate_snapshot ?: $batch->profit_sharing_value));

            $traderRate = (float) ((float) $batch->trader_rate_snapshot > 0
                ? $batch->trader_rate_snapshot
                : ($batch->published_rate_snapshot ?: $batch->profit_sharing_value));

            $diffAmount = $traderRate - $userRate;

            $formattedUserRate = (float) $userRate == (int) $userRate
                ? (string) (int) $userRate
                : number_format((float) $userRate, 2, '.', '');

            $formattedTraderRate = (float) $traderRate == (int) $traderRate
                ? (string) (int) $traderRate
                : number_format((float) $traderRate, 2, '.', '');

            $formattedDiff = (float) $diffAmount == (int) $diffAmount
                ? (string) (int) $diffAmount
                : number_format((float) $diffAmount, 2, '.', '');

            $isAllotted = $batch->application_status === 'allotted' || (bool) ($batch->allotment_details['allotted'] ?? false);
            $isNotAllotted = $batch->application_status === 'not_allotted' || (
                isset($batch->allotment_details['allotted']) && ! $batch->allotment_details['allotted']
            );
            $allottedShares = $batch->allotment_details['allotted_shares'] ?? null;
            $statusText = $isAllotted
                ? 'ALLOTTED' . ($allottedShares ? " ({$allottedShares} sh)" : '')
                : ($isNotAllotted ? 'NOT ALLOTTED' : 'PENDING');

            $targetIpo = $ipo ?: $batch->ipo;
            $listingProfitPerLot = $targetIpo ? (float) ($targetIpo->calculated_listing_profit_per_lot ?? 0) : 0.0;

            if ($isAllotted && $listingProfitPerLot > 0) {
                $itemListingProfit = $listingProfitPerLot;
                $itemCollectFromUser = max(0.0, round($itemListingProfit - $userRate, 2));
                $itemAdminMargin = max(0.0, round($traderRate - $userRate, 2));
                $itemPayToTrader = max(0.0, round($itemListingProfit - $traderRate, 2));
            } else {
                $itemListingProfit = 0.0;
                $itemCollectFromUser = 0.0;
                $itemAdminMargin = 0.0;
                $itemPayToTrader = 0.0;
            }

            $uName = $batch->user?->name ?: ($batch->applicant_name ?: 'User #' . $batch->user_id);
            $pans = $batch->batchPans;

            if ($pans->count() > 0) {
                foreach ($pans as $pan) {
                    $panNumber = $pan->pan_number_snapshot
                        ?: ($pan->userPan?->pan_number ?: ($batch->pan_number ?: 'N/A'));

                    $holderName = $pan->userPan?->account_holder_name;
                    if (empty($holderName) && $panNumber !== 'N/A') {
                        $holderName = \App\Models\UserPan::where('pan_number', strtoupper(trim($panNumber)))->value('account_holder_name');
                    }
                    if (empty($holderName)) {
                        $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                    }

                    $items[] = [
                        'serial' => $serialNo++,
                        'user_id' => $batch->user_id,
                        'user_name' => $uName,
                        'holder_name' => $holderName,
                        'pan_number' => strtoupper($panNumber),
                        'rate' => $formattedUserRate,
                        'user_rate' => $userRate,
                        'trader_rate' => $traderRate,
                        'diff_amount' => $diffAmount,
                        'listing_profit' => $itemListingProfit,
                        'collect_from_user' => $itemCollectFromUser,
                        'admin_margin' => $itemAdminMargin,
                        'pay_to_trader' => $itemPayToTrader,
                        'formatted_user_rate' => $formattedUserRate,
                        'formatted_trader_rate' => $formattedTraderRate,
                        'formatted_diff' => $formattedDiff,
                        'formatted_listing_profit' => $formatRate($itemListingProfit),
                        'formatted_collect_from_user' => $formatRate($itemCollectFromUser),
                        'formatted_admin_margin' => $formatRate($itemAdminMargin),
                        'formatted_pay_to_trader' => $formatRate($itemPayToTrader),
                        'is_allotted' => $isAllotted,
                        'status' => $statusText,
                    ];
                }
            } else {
                $count = max(1, (int) $batch->application_count);
                $panNumber = $batch->pan_number ?: 'N/A';
                $holderName = null;
                if ($panNumber !== 'N/A') {
                    $holderName = \App\Models\UserPan::where('pan_number', strtoupper(trim($panNumber)))->value('account_holder_name');
                }
                if (empty($holderName)) {
                    $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                }

                for ($i = 0; $i < $count; $i++) {
                    $items[] = [
                        'serial' => $serialNo++,
                        'user_id' => $batch->user_id,
                        'user_name' => $uName,
                        'holder_name' => $holderName,
                        'pan_number' => strtoupper($panNumber),
                        'rate' => $formattedUserRate,
                        'user_rate' => $userRate,
                        'trader_rate' => $traderRate,
                        'diff_amount' => $diffAmount,
                        'listing_profit' => $itemListingProfit,
                        'collect_from_user' => $itemCollectFromUser,
                        'admin_margin' => $itemAdminMargin,
                        'pay_to_trader' => $itemPayToTrader,
                        'formatted_user_rate' => $formattedUserRate,
                        'formatted_trader_rate' => $formattedTraderRate,
                        'formatted_diff' => $formattedDiff,
                        'formatted_listing_profit' => $formatRate($itemListingProfit),
                        'formatted_collect_from_user' => $formatRate($itemCollectFromUser),
                        'formatted_admin_margin' => $formatRate($itemAdminMargin),
                        'formatted_pay_to_trader' => $formatRate($itemPayToTrader),
                        'is_allotted' => $isAllotted,
                        'status' => $statusText,
                    ];
                }
            }
        }

        return $items;
    }

    /**
     * Export User Rates Multi-Sheet Excel (.xlsx) with User-Wise Tabs, Yellow Highlight, Trader Rate, Diff, and Totals.
     */
    public static function exportUserExcel(?Ipo $ipo = null, ?int $userId = null, bool $isAdmin = true): StreamedResponse
    {
        $items = self::getUserRatesData($ipo, $userId);

        $formatRate = static function (float $num): string {
            return (float) $num == (int) $num ? (string) (int) $num : number_format($num, 2, '.', '');
        };

        $existingSheetNames = [];
        $sheets = [];

        $hasListing = false;
        foreach ($items as $item) {
            if ($item['listing_profit'] > 0) {
                $hasListing = true;
                break;
            }
        }

        if ($isAdmin) {
            // Group applications by User
            $userGroups = [];
            foreach ($items as $item) {
                $userGroups[$item['user_name']][] = $item;
            }

            // Sheet 1: All Applications
            if ($hasListing) {
                $allRows = [[
                    '<b>Serial No</b>',
                    '<b>User / Applicant</b>',
                    '<b>Name of PAN Holder</b>',
                    '<b>PAN Number</b>',
                    '<b>Allotment Status</b>',
                    '<b>Listing Profit</b>',
                    '<b>User Rate</b>',
                    '<b>Collect from User</b>',
                    '<b>Trader Rate</b>',
                    '<b>Admin Margin</b>',
                    '<b>Pay to Trader</b>',
                ]];

                $totUser = 0; $totTrader = 0; $totListing = 0; $totCollect = 0; $totMargin = 0; $totPayTrader = 0; $totAllotted = 0;
                foreach ($items as $item) {
                    $totUser += $item['user_rate'];
                    $totTrader += $item['trader_rate'];
                    $totListing += $item['listing_profit'];
                    $totCollect += $item['collect_from_user'];
                    $totMargin += $item['admin_margin'];
                    $totPayTrader += $item['pay_to_trader'];
                    if ($item['is_allotted']) {
                        $totAllotted++;
                        $allRows[] = [
                            '<style bgcolor="#FFFF00">' . $item['serial'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['user_name'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['holder_name'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['pan_number'] . '</style>',
                            '<b><style bgcolor="#FFFF00">' . $item['status'] . '</style></b>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['listing_profit']) . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['user_rate']) . '</style>',
                            '<b><style bgcolor="#FFFF00">' . $formatRate($item['collect_from_user']) . '</style></b>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['trader_rate']) . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['admin_margin']) . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['pay_to_trader']) . '</style>',
                        ];
                    } else {
                        $allRows[] = [
                            $item['serial'],
                            $item['user_name'],
                            $item['holder_name'],
                            $item['pan_number'],
                            $item['status'],
                            '-',
                            $formatRate($item['user_rate']),
                            '-',
                            $formatRate($item['trader_rate']),
                            '-',
                            '-',
                        ];
                    }
                }

                $allRows[] = [
                    '<b>TOTAL</b>',
                    '',
                    '',
                    '',
                    '<b>Total: ' . count($items) . ' | Allotted: ' . $totAllotted . '</b>',
                    '<b>' . $formatRate($totListing) . '</b>',
                    '<b>' . $formatRate($totUser) . '</b>',
                    '<b>' . $formatRate($totCollect) . '</b>',
                    '<b>' . $formatRate($totTrader) . '</b>',
                    '<b>' . $formatRate($totMargin) . '</b>',
                    '<b>' . $formatRate($totPayTrader) . '</b>',
                ];
            } else {
                $allRows = [[
                    '<b>Serial No</b>',
                    '<b>User / Applicant</b>',
                    '<b>Name of PAN Holder</b>',
                    '<b>PAN Number</b>',
                    '<b>User Rate</b>',
                    '<b>Trader Rate</b>',
                    '<b>Diff Amount</b>',
                    '<b>Allotment Status</b>',
                ]];

                $totUser = 0; $totTrader = 0; $totDiff = 0; $totAllotted = 0;
                foreach ($items as $item) {
                    $totUser += $item['user_rate'];
                    $totTrader += $item['trader_rate'];
                    $totDiff += $item['diff_amount'];
                    if ($item['is_allotted']) {
                        $totAllotted++;
                        $allRows[] = [
                            '<style bgcolor="#FFFF00">' . $item['serial'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['user_name'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['holder_name'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $item['pan_number'] . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['user_rate']) . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['trader_rate']) . '</style>',
                            '<style bgcolor="#FFFF00">' . $formatRate($item['diff_amount']) . '</style>',
                            '<b><style bgcolor="#FFFF00">' . $item['status'] . '</style></b>',
                        ];
                    } else {
                        $allRows[] = [
                            $item['serial'],
                            $item['user_name'],
                            $item['holder_name'],
                            $item['pan_number'],
                            $formatRate($item['user_rate']),
                            $formatRate($item['trader_rate']),
                            $formatRate($item['diff_amount']),
                            $item['status'],
                        ];
                    }
                }

                $allRows[] = [
                    '<b>TOTAL</b>',
                    '',
                    '',
                    '',
                    '<b>' . $formatRate($totUser) . '</b>',
                    '<b>' . $formatRate($totTrader) . '</b>',
                    '<b>' . $formatRate($totDiff) . '</b>',
                    '<b>Total: ' . count($items) . ' | Allotted: ' . $totAllotted . '</b>',
                ];
            }

            $sheets[] = [
                'name' => self::sanitizeSheetName('All Applications', $existingSheetNames),
                'rows' => $allRows,
            ];

            // Sheet 2: Payout & Settlement Summary (when multiple users are present)
            if (count($userGroups) > 1) {
                if ($hasListing) {
                    $summaryRows = [[
                        '<b>Serial No</b>',
                        '<b>User / Applicant</b>',
                        '<b>Applications</b>',
                        '<b>Allotted</b>',
                        '<b>Listing Profit Total</b>',
                        '<b>User Rate Total</b>',
                        '<b>Collect from User Total</b>',
                        '<b>Trader Rate Total</b>',
                        '<b>Admin Margin Total</b>',
                        '<b>Pay to Trader Total</b>',
                    ]];
                    $sumIdx = 1;
                    $sumListing = 0; $sumUser = 0; $sumCollect = 0; $sumTrader = 0; $sumMargin = 0; $sumPayTrader = 0;
                    foreach ($userGroups as $uName => $uItems) {
                        $uApps = count($uItems);
                        $uAllotted = 0; $uUserTot = 0; $uTraderTot = 0; $uListTot = 0; $uCollectTot = 0; $uMarginTot = 0; $uPayTraderTot = 0;
                        foreach ($uItems as $ui) {
                            if ($ui['is_allotted']) $uAllotted++;
                            $uUserTot += $ui['user_rate'];
                            $uTraderTot += $ui['trader_rate'];
                            $uListTot += $ui['listing_profit'];
                            $uCollectTot += $ui['collect_from_user'];
                            $uMarginTot += $ui['admin_margin'];
                            $uPayTraderTot += $ui['pay_to_trader'];
                        }
                        $sumListing += $uListTot;
                        $sumUser += $uUserTot;
                        $sumCollect += $uCollectTot;
                        $sumTrader += $uTraderTot;
                        $sumMargin += $uMarginTot;
                        $sumPayTrader += $uPayTraderTot;

                        $allottedCell = $uAllotted > 0
                            ? '<b><style bgcolor="#FFFF00">' . $uAllotted . '</style></b>'
                            : (string) $uAllotted;

                        $summaryRows[] = [
                            $sumIdx++,
                            $uName,
                            $uApps,
                            $allottedCell,
                            $formatRate($uListTot),
                            $formatRate($uUserTot),
                            '<b>' . $formatRate($uCollectTot) . '</b>',
                            $formatRate($uTraderTot),
                            $formatRate($uMarginTot),
                            $formatRate($uPayTraderTot),
                        ];
                    }
                    $summaryRows[] = [
                        '<b>TOTAL</b>',
                        '<b>' . count($userGroups) . ' Users</b>',
                        '<b>' . count($items) . '</b>',
                        '<b>' . $totAllotted . '</b>',
                        '<b>' . $formatRate($sumListing) . '</b>',
                        '<b>' . $formatRate($sumUser) . '</b>',
                        '<b>' . $formatRate($sumCollect) . '</b>',
                        '<b>' . $formatRate($sumTrader) . '</b>',
                        '<b>' . $formatRate($sumMargin) . '</b>',
                        '<b>' . $formatRate($sumPayTrader) . '</b>',
                    ];
                } else {
                    $summaryRows = [[
                        '<b>Serial No</b>',
                        '<b>User / Applicant</b>',
                        '<b>Applications</b>',
                        '<b>Allotted</b>',
                        '<b>User Rate Total (Payout)</b>',
                        '<b>Trader Rate Total</b>',
                        '<b>Diff Amount Total (Profit)</b>',
                    ]];
                    $sumIdx = 1;
                    foreach ($userGroups as $uName => $uItems) {
                        $uApps = count($uItems);
                        $uAllotted = 0; $uUserTot = 0; $uTraderTot = 0; $uDiffTot = 0;
                        foreach ($uItems as $ui) {
                            if ($ui['is_allotted']) $uAllotted++;
                            $uUserTot += $ui['user_rate'];
                            $uTraderTot += $ui['trader_rate'];
                            $uDiffTot += $ui['diff_amount'];
                        }
                        $allottedCell = $uAllotted > 0
                            ? '<b><style bgcolor="#FFFF00">' . $uAllotted . '</style></b>'
                            : (string) $uAllotted;

                        $summaryRows[] = [
                            $sumIdx++,
                            $uName,
                            $uApps,
                            $allottedCell,
                            $formatRate($uUserTot),
                            $formatRate($uTraderTot),
                            $formatRate($uDiffTot),
                        ];
                    }
                    $summaryRows[] = [
                        '<b>TOTAL</b>',
                        '<b>' . count($userGroups) . ' Users</b>',
                        '<b>' . count($items) . '</b>',
                        '<b>' . $totAllotted . '</b>',
                        '<b>' . $formatRate($totUser) . '</b>',
                        '<b>' . $formatRate($totTrader) . '</b>',
                        '<b>' . $formatRate($totDiff) . '</b>',
                    ];
                }

                $sheets[] = [
                    'name' => self::sanitizeSheetName('Payout Summary', $existingSheetNames),
                    'rows' => $summaryRows,
                ];
            }

            // Sheets 3+: Individual User-Wise Sheets
            foreach ($userGroups as $uName => $uItems) {
                $userSheetName = self::sanitizeSheetName($uName, $existingSheetNames);

                if ($hasListing) {
                    $userRows = [[
                        '<b>Serial No</b>',
                        '<b>Name of PAN Holder</b>',
                        '<b>PAN Number</b>',
                        '<b>Allotment Status</b>',
                        '<b>Listing Profit</b>',
                        '<b>User Rate</b>',
                        '<b>Collect from User</b>',
                        '<b>Trader Rate</b>',
                        '<b>Admin Margin</b>',
                        '<b>Pay to Trader</b>',
                    ]];

                    $uTotUser = 0; $uTotTrader = 0; $uTotList = 0; $uTotCollect = 0; $uTotMargin = 0; $uTotPayTrader = 0; $uTotAllotted = 0;
                    $uSerial = 1;
                    foreach ($uItems as $ui) {
                        $uTotUser += $ui['user_rate'];
                        $uTotTrader += $ui['trader_rate'];
                        $uTotList += $ui['listing_profit'];
                        $uTotCollect += $ui['collect_from_user'];
                        $uTotMargin += $ui['admin_margin'];
                        $uTotPayTrader += $ui['pay_to_trader'];

                        if ($ui['is_allotted']) {
                            $uTotAllotted++;
                            $userRows[] = [
                                '<style bgcolor="#FFFF00">' . $uSerial++ . '</style>',
                                '<style bgcolor="#FFFF00">' . $ui['holder_name'] . '</style>',
                                '<style bgcolor="#FFFF00">' . $ui['pan_number'] . '</style>',
                                '<b><style bgcolor="#FFFF00">' . $ui['status'] . '</style></b>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['listing_profit']) . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['user_rate']) . '</style>',
                                '<b><style bgcolor="#FFFF00">' . $formatRate($ui['collect_from_user']) . '</style></b>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['trader_rate']) . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['admin_margin']) . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['pay_to_trader']) . '</style>',
                            ];
                        } else {
                            $userRows[] = [
                                $uSerial++,
                                $ui['holder_name'],
                                $ui['pan_number'],
                                $ui['status'],
                                '-',
                                $formatRate($ui['user_rate']),
                                '-',
                                $formatRate($ui['trader_rate']),
                                '-',
                                '-',
                            ];
                        }
                    }

                    $userRows[] = [
                        '<b>TOTAL</b>',
                        '',
                        '',
                        '<b>Total: ' . count($uItems) . ' | Allotted: ' . $uTotAllotted . '</b>',
                        '<b>' . $formatRate($uTotList) . '</b>',
                        '<b>' . $formatRate($uTotUser) . '</b>',
                        '<b>' . $formatRate($uTotCollect) . '</b>',
                        '<b>' . $formatRate($uTotTrader) . '</b>',
                        '<b>' . $formatRate($uTotMargin) . '</b>',
                        '<b>' . $formatRate($uTotPayTrader) . '</b>',
                    ];
                } else {
                    $userRows = [[
                        '<b>Serial No</b>',
                        '<b>Name of PAN Holder</b>',
                        '<b>PAN Number</b>',
                        '<b>User Rate</b>',
                        '<b>Trader Rate</b>',
                        '<b>Diff Amount</b>',
                        '<b>Allotment Status</b>',
                    ]];

                    $uTotUser = 0; $uTotTrader = 0; $uTotDiff = 0; $uTotAllotted = 0;
                    $uSerial = 1;
                    foreach ($uItems as $ui) {
                        $uTotUser += $ui['user_rate'];
                        $uTotTrader += $ui['trader_rate'];
                        $uTotDiff += $ui['diff_amount'];
                        if ($ui['is_allotted']) {
                            $uTotAllotted++;
                            $userRows[] = [
                                '<style bgcolor="#FFFF00">' . $uSerial++ . '</style>',
                                '<style bgcolor="#FFFF00">' . $ui['holder_name'] . '</style>',
                                '<style bgcolor="#FFFF00">' . $ui['pan_number'] . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['user_rate']) . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['trader_rate']) . '</style>',
                                '<style bgcolor="#FFFF00">' . $formatRate($ui['diff_amount']) . '</style>',
                                '<b><style bgcolor="#FFFF00">' . $ui['status'] . '</style></b>',
                            ];
                        } else {
                            $userRows[] = [
                                $uSerial++,
                                $ui['holder_name'],
                                $ui['pan_number'],
                                $formatRate($ui['user_rate']),
                                $formatRate($ui['trader_rate']),
                                $formatRate($ui['diff_amount']),
                                $ui['status'],
                            ];
                        }
                    }

                    $userRows[] = [
                        '<b>TOTAL</b>',
                        '',
                        '',
                        '<b>' . $formatRate($uTotUser) . '</b>',
                        '<b>' . $formatRate($uTotTrader) . '</b>',
                        '<b>' . $formatRate($uTotDiff) . '</b>',
                        '<b>Total: ' . count($uItems) . ' | Allotted: ' . $uTotAllotted . '</b>',
                    ];
                }

                $sheets[] = [
                    'name' => $userSheetName,
                    'rows' => $userRows,
                ];
            }
        } else {
            // Non-admin user: single sheet of their own applications
            $userRows = [[
                '<b>Serial No</b>',
                '<b>Name of PAN Holder</b>',
                '<b>PAN Number</b>',
                '<b>Rate Applied</b>',
                '<b>Allotment Status</b>',
            ]];

            $uTotUser = 0; $uTotAllotted = 0;
            $uSerial = 1;
            foreach ($items as $item) {
                $uTotUser += $item['user_rate'];
                if ($item['is_allotted']) {
                    $uTotAllotted++;
                    $userRows[] = [
                        '<style bgcolor="#FFFF00">' . $uSerial++ . '</style>',
                        '<style bgcolor="#FFFF00">' . $item['holder_name'] . '</style>',
                        '<style bgcolor="#FFFF00">' . $item['pan_number'] . '</style>',
                        '<style bgcolor="#FFFF00">' . $formatRate($item['user_rate']) . '</style>',
                        '<b><style bgcolor="#FFFF00">' . $item['status'] . '</style></b>',
                    ];
                } else {
                    $userRows[] = [
                        $uSerial++,
                        $item['holder_name'],
                        $item['pan_number'],
                        $formatRate($item['user_rate']),
                        $item['status'],
                    ];
                }
            }

            $userRows[] = [
                '<b>TOTAL</b>',
                '',
                '',
                '<b>' . $formatRate($uTotUser) . '</b>',
                '<b>Total: ' . count($items) . ' | Allotted: ' . $uTotAllotted . '</b>',
            ];

            $sheets[] = [
                'name' => self::sanitizeSheetName('My Rates', $existingSheetNames),
                'rows' => $userRows,
            ];
        }

        $name = $ipo ? preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name) : 'All_IPOs';
        $filename = "{$name}_user_rates_".date('Y-m-d_His').'.xlsx';

        if ($ipo) {
            AuditService::log('excel_exported', $ipo, null, [
                'type' => 'user_rates_excel',
                'records_count' => count($items),
                'sheets_count' => count($sheets),
            ], "Exported user rates multi-sheet Excel for {$ipo->company_name}");
        }

        return self::buildMultiSheetExcelStreamResponse($filename, $sheets);
    }

    /**
     * Export User Rates CSV with Allotment Status, Trader Rate, Diff Amount, and Totals.
     */
    public static function exportUserCsv(?Ipo $ipo = null, ?int $userId = null, bool $isAdmin = true): StreamedResponse
    {
        $items = self::getUserRatesData($ipo, $userId);

        $formatRate = static function (float $num): string {
            return (float) $num == (int) $num ? (string) (int) $num : number_format($num, 2, '.', '');
        };

        $hasListing = false;
        foreach ($items as $item) {
            if ($item['listing_profit'] > 0) {
                $hasListing = true;
                break;
            }
        }

        if ($isAdmin) {
            if ($hasListing) {
                $headers = [
                    'Serial No',
                    'User / Applicant',
                    'Name of PAN Holder',
                    'PAN Number',
                    'Allotment Status',
                    'Listing Profit',
                    'User Rate',
                    'Collect from User',
                    'Trader Rate',
                    'Admin Margin',
                    'Pay to Trader',
                ];

                $rows = [];
                $totUser = 0; $totTrader = 0; $totListing = 0; $totCollect = 0; $totMargin = 0; $totPayTrader = 0; $totAllotted = 0;
                foreach ($items as $item) {
                    $totUser += $item['user_rate'];
                    $totTrader += $item['trader_rate'];
                    $totListing += $item['listing_profit'];
                    $totCollect += $item['collect_from_user'];
                    $totMargin += $item['admin_margin'];
                    $totPayTrader += $item['pay_to_trader'];
                    if ($item['is_allotted']) $totAllotted++;

                    $rows[] = [
                        $item['serial'],
                        $item['user_name'],
                        $item['holder_name'],
                        $item['pan_number'],
                        $item['status'],
                        $item['is_allotted'] ? $formatRate($item['listing_profit']) : '-',
                        $formatRate($item['user_rate']),
                        $item['is_allotted'] ? $formatRate($item['collect_from_user']) : '-',
                        $formatRate($item['trader_rate']),
                        $item['is_allotted'] ? $formatRate($item['admin_margin']) : '-',
                        $item['is_allotted'] ? $formatRate($item['pay_to_trader']) : '-',
                    ];
                }

                $rows[] = [
                    'TOTAL',
                    '',
                    '',
                    '',
                    'Total: ' . count($items) . ' | Allotted: ' . $totAllotted,
                    $formatRate($totListing),
                    $formatRate($totUser),
                    $formatRate($totCollect),
                    $formatRate($totTrader),
                    $formatRate($totMargin),
                    $formatRate($totPayTrader),
                ];
            } else {
                $headers = [
                    'Serial No',
                    'User / Applicant',
                    'Name of PAN Holder',
                    'PAN Number',
                    'User Rate',
                    'Trader Rate',
                    'Diff Amount',
                    'Allotment Status',
                ];

                $rows = [];
                $totUser = 0; $totTrader = 0; $totDiff = 0; $totAllotted = 0;
                foreach ($items as $item) {
                    $totUser += $item['user_rate'];
                    $totTrader += $item['trader_rate'];
                    $totDiff += $item['diff_amount'];
                    if ($item['is_allotted']) $totAllotted++;

                    $rows[] = [
                        $item['serial'],
                        $item['user_name'],
                        $item['holder_name'],
                        $item['pan_number'],
                        $formatRate($item['user_rate']),
                        $formatRate($item['trader_rate']),
                        $formatRate($item['diff_amount']),
                        $item['status'],
                    ];
                }

                $rows[] = [
                    'TOTAL',
                    '',
                    '',
                    '',
                    $formatRate($totUser),
                    $formatRate($totTrader),
                    $formatRate($totDiff),
                    'Total: ' . count($items) . ' | Allotted: ' . $totAllotted,
                ];
            }
        } else {
            $headers = [
                'Serial No',
                'Name of PAN Holder',
                'PAN Number',
                'Rate Applied',
                'Allotment Status',
            ];

            $rows = [];
            $totUser = 0; $totAllotted = 0;
            foreach ($items as $item) {
                $totUser += $item['user_rate'];
                if ($item['is_allotted']) $totAllotted++;

                $rows[] = [
                    $item['serial'],
                    $item['holder_name'],
                    $item['pan_number'],
                    $formatRate($item['user_rate']),
                    $item['status'],
                ];
            }

            $rows[] = [
                'TOTAL',
                '',
                '',
                $formatRate($totUser),
                'Total: ' . count($items) . ' | Allotted: ' . $totAllotted,
            ];
        }

        $name = $ipo ? preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name) : 'All_IPOs';
        $filename = "{$name}_user_rates_".date('Y-m-d_His').'.csv';

        if ($ipo) {
            AuditService::log('csv_exported', $ipo, null, [
                'type' => 'user_rates_csv',
                'records_count' => count($rows),
            ], "Exported user rates CSV for {$ipo->company_name}");
        }

        return self::buildStreamResponse($filename, $headers, $rows);
    }

    /**
     * Extract flattened rows for Trader Rates with Allotment Status.
     */
    public static function getTraderRatesData(?Ipo $ipo = null, ?int $userId = null): array
    {
        $query = ApplicationBatch::with(['user', 'batchPans.userPan'])
            ->where('application_status', '!=', 'cancelled');

        if ($ipo) {
            $query->where('ipo_id', $ipo->id);
        }

        if ($userId) {
            $query->where('user_id', $userId);
        }

        $batches = $query->orderBy('id')->get();
        $items = [];
        $serialNo = 1;

        foreach ($batches as $batch) {
            $traderRate = (float) $batch->trader_rate_snapshot > 0
                ? $batch->trader_rate_snapshot
                : ($batch->published_rate_snapshot ?: $batch->profit_sharing_value);

            $formattedRate = (float) $traderRate == (int) $traderRate
                ? (string) (int) $traderRate
                : number_format((float) $traderRate, 2, '.', '');

            $isAllotted = $batch->application_status === 'allotted' || (bool) ($batch->allotment_details['allotted'] ?? false);
            $isNotAllotted = $batch->application_status === 'not_allotted' || (
                isset($batch->allotment_details['allotted']) && ! $batch->allotment_details['allotted']
            );
            $allottedShares = $batch->allotment_details['allotted_shares'] ?? null;
            $statusText = $isAllotted
                ? 'ALLOTTED' . ($allottedShares ? " ({$allottedShares} sh)" : '')
                : ($isNotAllotted ? 'NOT ALLOTTED' : 'PENDING');

            $pans = $batch->batchPans;

            if ($pans->count() > 0) {
                foreach ($pans as $pan) {
                    $panNumber = $pan->pan_number_snapshot
                        ?: ($pan->userPan?->pan_number ?: ($batch->pan_number ?: 'N/A'));

                    $holderName = $pan->userPan?->account_holder_name;
                    if (empty($holderName) && $panNumber !== 'N/A') {
                        $holderName = \App\Models\UserPan::where('pan_number', strtoupper(trim($panNumber)))->value('account_holder_name');
                    }
                    if (empty($holderName)) {
                        $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                    }

                    $items[] = [
                        'serial' => $serialNo++,
                        'holder_name' => $holderName,
                        'pan_number' => strtoupper($panNumber),
                        'rate' => $formattedRate,
                        'is_allotted' => $isAllotted,
                        'status' => $statusText,
                    ];
                }
            } else {
                $count = max(1, (int) $batch->application_count);
                $panNumber = $batch->pan_number ?: 'N/A';
                $holderName = null;
                if ($panNumber !== 'N/A') {
                    $holderName = \App\Models\UserPan::where('pan_number', strtoupper(trim($panNumber)))->value('account_holder_name');
                }
                if (empty($holderName)) {
                    $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                }

                for ($i = 0; $i < $count; $i++) {
                    $items[] = [
                        'serial' => $serialNo++,
                        'holder_name' => $holderName,
                        'pan_number' => strtoupper($panNumber),
                        'rate' => $formattedRate,
                        'is_allotted' => $isAllotted,
                        'status' => $statusText,
                    ];
                }
            }
        }

        return $items;
    }

    /**
     * Export Trader Rates Excel (.xlsx) with Yellow Highlight for Allotted.
     */
    public static function exportTraderExcel(?Ipo $ipo = null, ?int $userId = null): StreamedResponse
    {
        $items = self::getTraderRatesData($ipo, $userId);

        $headers = [
            '<b>Serial No</b>',
            '<b>Name of PAN Holder</b>',
            '<b>PAN Number</b>',
            '<b>Trader Rate</b>',
            '<b>Allotment Status</b>',
        ];

        $formatRate = static function (float $num): string {
            return (float) $num == (int) $num ? (string) (int) $num : number_format($num, 2, '.', '');
        };

        $rows = [$headers];
        $totTrader = 0; $totAllotted = 0;
        foreach ($items as $item) {
            $numericRate = (float) $item['rate'];
            $totTrader += $numericRate;
            if ($item['is_allotted']) {
                $totAllotted++;
                $rows[] = [
                    '<style bgcolor="#FFFF00">' . $item['serial'] . '</style>',
                    '<style bgcolor="#FFFF00">' . $item['holder_name'] . '</style>',
                    '<style bgcolor="#FFFF00">' . $item['pan_number'] . '</style>',
                    '<style bgcolor="#FFFF00">' . $item['rate'] . '</style>',
                    '<b><style bgcolor="#FFFF00">' . $item['status'] . '</style></b>',
                ];
            } else {
                $rows[] = [
                    $item['serial'],
                    $item['holder_name'],
                    $item['pan_number'],
                    $item['rate'],
                    $item['status'],
                ];
            }
        }

        $rows[] = [
            '<b>TOTAL</b>',
            '',
            '',
            '<b>' . $formatRate($totTrader) . '</b>',
            '<b>Total: ' . count($items) . ' | Allotted: ' . $totAllotted . '</b>',
        ];

        $name = $ipo ? preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name) : 'All_IPOs';
        $filename = "{$name}_trader_rates_".date('Y-m-d_His').'.xlsx';

        if ($ipo) {
            AuditService::log('excel_exported', $ipo, null, [
                'type' => 'trader_rates_excel',
                'records_count' => count($items),
            ], "Exported trader rates Excel for {$ipo->company_name}");
        }

        return self::buildExcelStreamResponse($filename, $rows);
    }

    /**
     * Export Trader Rates CSV with Allotment Status column.
     */
    public static function exportTraderCsv(?Ipo $ipo = null, ?int $userId = null): StreamedResponse
    {
        $items = self::getTraderRatesData($ipo, $userId);

        $formatRate = static function (float $num): string {
            return (float) $num == (int) $num ? (string) (int) $num : number_format($num, 2, '.', '');
        };

        $headers = [
            'Serial No',
            'Name of PAN Holder',
            'PAN Number',
            'Trader Rate',
            'Allotment Status',
        ];

        $rows = [];
        $totTrader = 0; $totAllotted = 0;
        foreach ($items as $item) {
            $numericRate = (float) $item['rate'];
            $totTrader += $numericRate;
            if ($item['is_allotted']) $totAllotted++;

            $rows[] = [
                $item['serial'],
                $item['holder_name'],
                $item['pan_number'],
                $item['rate'],
                $item['status'],
            ];
        }

        $rows[] = [
            'TOTAL',
            '',
            '',
            $formatRate($totTrader),
            'Total: ' . count($items) . ' | Allotted: ' . $totAllotted,
        ];

        $name = $ipo ? preg_replace('/[^a-zA-Z0-9_\-]/', '_', $ipo->company_name) : 'All_IPOs';
        $filename = "{$name}_trader_rates_".date('Y-m-d_His').'.csv';

        if ($ipo) {
            AuditService::log('csv_exported', $ipo, null, [
                'type' => 'trader_rates_csv',
                'records_count' => count($rows),
            ], "Exported trader rates CSV for {$ipo->company_name}");
        }

        return self::buildStreamResponse($filename, $headers, $rows);
    }
}

