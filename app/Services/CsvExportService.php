<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
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
            'Applicant Name',
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
                : 'N/A';

            $rows[] = [
                $batch->batch_number,
                $ipo->company_name,
                $ipo->symbol ?? '',
                $batch->user->name ?? 'N/A',
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
     * Export User Rates CSV.
     * Columns: Serial No, Name of PAN Holder, PAN Number, Rate Applied
     */
    public static function exportUserCsv(?Ipo $ipo = null, ?int $userId = null): StreamedResponse
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

        $headers = [
            'Serial No',
            'Name of PAN Holder',
            'PAN Number',
            'Rate Applied',
        ];

        $rows = [];
        $serialNo = 1;

        foreach ($batches as $batch) {
            $userRate = $batch->profit_sharing_type === 'fix'
                ? $batch->profit_sharing_value
                : ($batch->published_rate_snapshot ?: $batch->profit_sharing_value);

            $formattedRate = (float) $userRate == (int) $userRate
                ? (string) (int) $userRate
                : number_format((float) $userRate, 2, '.', '');

            $pans = $batch->batchPans;

            if ($pans->count() > 0) {
                foreach ($pans as $pan) {
                    $holderName = $pan->userPan?->account_holder_name
                        ?: ($batch->applicant_name ?: ($batch->user?->name ?: 'Applicant'));
                    $panNumber = $pan->pan_number_snapshot
                        ?: ($pan->userPan?->pan_number ?: ($batch->pan_number ?: 'N/A'));

                    $rows[] = [
                        $serialNo++,
                        $holderName,
                        strtoupper($panNumber),
                        $formattedRate,
                    ];
                }
            } else {
                $count = max(1, (int) $batch->application_count);
                $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                $panNumber = $batch->pan_number ?: 'N/A';

                for ($i = 0; $i < $count; $i++) {
                    $rows[] = [
                        $serialNo++,
                        $holderName,
                        strtoupper($panNumber),
                        $formattedRate,
                    ];
                }
            }
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
     * Export Trader Rates CSV.
     * Columns: Serial No, Name of PAN Holder, PAN Number, Trader Rate
     */
    public static function exportTraderCsv(?Ipo $ipo = null, ?int $userId = null): StreamedResponse
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

        $headers = [
            'Serial No',
            'Name of PAN Holder',
            'PAN Number',
            'Trader Rate',
        ];

        $rows = [];
        $serialNo = 1;

        foreach ($batches as $batch) {
            $traderRate = (float) $batch->trader_rate_snapshot > 0
                ? $batch->trader_rate_snapshot
                : ($batch->published_rate_snapshot ?: $batch->profit_sharing_value);

            $formattedRate = (float) $traderRate == (int) $traderRate
                ? (string) (int) $traderRate
                : number_format((float) $traderRate, 2, '.', '');

            $pans = $batch->batchPans;

            if ($pans->count() > 0) {
                foreach ($pans as $pan) {
                    $holderName = $pan->userPan?->account_holder_name
                        ?: ($batch->applicant_name ?: ($batch->user?->name ?: 'Applicant'));
                    $panNumber = $pan->pan_number_snapshot
                        ?: ($pan->userPan?->pan_number ?: ($batch->pan_number ?: 'N/A'));

                    $rows[] = [
                        $serialNo++,
                        $holderName,
                        strtoupper($panNumber),
                        $formattedRate,
                    ];
                }
            } else {
                $count = max(1, (int) $batch->application_count);
                $holderName = $batch->applicant_name ?: ($batch->user?->name ?: 'Applicant');
                $panNumber = $batch->pan_number ?: 'N/A';

                for ($i = 0; $i < $count; $i++) {
                    $rows[] = [
                        $serialNo++,
                        $holderName,
                        strtoupper($panNumber),
                        $formattedRate,
                    ];
                }
            }
        }

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

