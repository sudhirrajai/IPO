<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\UserPan;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;

class NseAllotmentService
{
    private const MASTER_URL = 'https://www.nseindia.com/api/ipo-bid-master';
    private const CACHE_KEY_SYMBOLS = 'nse_active_ipo_symbols_list';

    /**
     * Fetch active list of IPO symbols currently on NSE bid verification portal.
     * Cached for 30 minutes.
     *
     * @return array<int, string>
     */
    public static function getActiveSymbols(bool $forceRefresh = false): array
    {
        if (! $forceRefresh && Cache::has(self::CACHE_KEY_SYMBOLS)) {
            return (array) Cache::get(self::CACHE_KEY_SYMBOLS);
        }

        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept' => 'application/json, text/javascript, */*; q=0.01',
                'Referer' => 'https://www.nseindia.com/invest/check-trades-bids-verify-ipo-bids',
                'X-Requested-With' => 'XMLHttpRequest',
            ])->timeout(10)->get(self::MASTER_URL);

            if ($response->successful()) {
                $symbols = $response->json();
                if (is_array($symbols) && count($symbols) > 0) {
                    Cache::put(self::CACHE_KEY_SYMBOLS, $symbols, now()->addMinutes(30));
                    return $symbols;
                }
            }
        } catch (Exception $e) {
            Log::warning('Failed to fetch NSE active IPO symbols: ' . $e->getMessage());
        }

        return [];
    }

    /**
     * Query NSE allotment API automatically using headless Chrome runner.
     *
     * @return array{
     *     success: bool,
     *     status: string,
     *     found: bool,
     *     message: string,
     *     allotted: bool,
     *     all_shares: int,
     *     app_shares: int,
     *     application_number: string|null,
     *     order_number: string|null,
     *     upi_amount: string|null,
     *     upi_status: string|null,
     *     allotment_price: string|null,
     *     symbol: string,
     *     pan: string
     * }
     */
    public static function queryAllotment(string $symbol, string $pan): array
    {
        $symbol = strtoupper(trim($symbol));
        $pan = strtoupper(trim($pan));

        if (empty($symbol) || empty($pan)) {
            return [
                'success' => false,
                'status' => 'missing_params',
                'found' => false,
                'message' => 'Symbol and PAN are required for NSE allotment check.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'order_number' => null,
                'upi_amount' => null,
                'upi_status' => null,
                'allotment_price' => null,
                'symbol' => $symbol,
                'pan' => $pan,
            ];
        }

        try {
            $scriptPath = base_path('scripts/nse_scraper.mjs');
            if (! file_exists($scriptPath)) {
                return [
                    'success' => false,
                    'status' => 'scraper_missing',
                    'found' => false,
                    'message' => 'NSE automated scraper runner script is missing.',
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'order_number' => null,
                    'upi_amount' => null,
                    'upi_status' => null,
                    'allotment_price' => null,
                    'symbol' => $symbol,
                    'pan' => $pan,
                ];
            }

            // Run headless node script with fallbacks for restricted PHP environments
            $output = self::executeScraper($symbol, $pan);

            if ($output === null) {
                return [
                    'success' => false,
                    'status' => 'exec_disabled',
                    'found' => false,
                    'message' => 'Command execution (proc_open/exec) is disabled in your PHP configuration. Enable proc_open in php.ini disable_functions, or use BSE India / KFintech for instant check.',
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'order_number' => null,
                    'upi_amount' => null,
                    'upi_status' => null,
                    'allotment_price' => null,
                    'symbol' => $symbol,
                    'pan' => $pan,
                ];
            }

            if (preg_match('/RESULT_START\s*([\s\S]*?)\s*RESULT_END/', $output, $matches)) {
                $rawJson = trim($matches[1]);
                $data = json_decode($rawJson, true);

                if (! is_array($data)) {
                    return [
                        'success' => false,
                        'status' => 'invalid_response',
                        'found' => false,
                        'message' => 'Received non-JSON response from NSE scraper.',
                        'allotted' => false,
                        'all_shares' => 0,
                        'app_shares' => 0,
                        'application_number' => null,
                        'order_number' => null,
                        'upi_amount' => null,
                        'upi_status' => null,
                        'allotment_price' => null,
                        'symbol' => $symbol,
                        'pan' => $pan,
                    ];
                }

                // Check for errors returned by scraper
                if (isset($data['success']) && $data['success'] === false) {
                    return [
                        'success' => false,
                        'status' => 'scraper_error',
                        'found' => false,
                        'message' => $data['message'] ?? 'Failed to scrape NSE.',
                        'allotted' => false,
                        'all_shares' => 0,
                        'app_shares' => 0,
                        'application_number' => null,
                        'order_number' => null,
                        'upi_amount' => null,
                        'upi_status' => null,
                        'allotment_price' => null,
                        'symbol' => $symbol,
                        'pan' => $pan,
                    ];
                }

                // Parse records from NSE response
                $records = $data['data'] ?? [];
                if (empty($records)) {
                    return [
                        'success' => true,
                        'status' => 'not_found',
                        'found' => false,
                        'message' => "No bid or allotment record found on NSE for PAN {$pan} in {$symbol}.",
                        'allotted' => false,
                        'all_shares' => 0,
                        'app_shares' => 0,
                        'application_number' => null,
                        'order_number' => null,
                        'upi_amount' => null,
                        'upi_status' => null,
                        'allotment_price' => null,
                        'symbol' => $symbol,
                        'pan' => $pan,
                    ];
                }

                $record = $records[0];
                $allotmentQty = (int) ($record['allotmentQty'] ?? 0);
                $isAllotted = $allotmentQty > 0;

                return [
                    'success' => true,
                    'status' => 'found',
                    'found' => true,
                    'message' => $isAllotted
                        ? "Allotment confirmed on NSE: {$allotmentQty} shares allotted!"
                        : 'Application verified on NSE: No shares allotted.',
                    'allotted' => $isAllotted,
                    'all_shares' => $allotmentQty,
                    'app_shares' => (int) ($record['quatity'] ?? 0),
                    'application_number' => $record['appNumber'] ?? null,
                    'order_number' => $record['orderNo'] ?? null,
                    'upi_amount' => $record['UPIAmtBlocked'] ?? null,
                    'upi_status' => $record['UPIStatus'] ?? null,
                    'allotment_price' => $record['allotmentPrice'] ?? null,
                    'symbol' => $symbol,
                    'pan' => $pan,
                ];
            }

            return [
                'success' => false,
                'status' => 'scraper_output_error',
                'found' => false,
                'message' => 'Scraper failed to produce a valid verification payload: ' . substr($output, 0, 200),
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'order_number' => null,
                'upi_amount' => null,
                'upi_status' => null,
                'allotment_price' => null,
                'symbol' => $symbol,
                'pan' => $pan,
            ];
        } catch (Exception $e) {
            Log::error('NSE allotment scraper exception: ' . $e->getMessage());
            return [
                'success' => false,
                'status' => 'exception',
                'found' => false,
                'message' => 'NSE check error: ' . $e->getMessage(),
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'order_number' => null,
                'upi_amount' => null,
                'upi_status' => null,
                'allotment_price' => null,
                'symbol' => $symbol,
                'pan' => $pan,
            ];
        }
    }

    /**
     * Check allotment on NSE for a specific ApplicationBatch and update database.
     */
    public static function checkBatchAllotment(ApplicationBatch $batch): array
    {
        $ipo = $batch->ipo;
        if (! $ipo) {
            return [
                'success' => false,
                'status' => 'error',
                'message' => 'Associated IPO not found.',
            ];
        }

        $symbol = $ipo->symbol;
        if (empty($symbol)) {
            return [
                'success' => false,
                'status' => 'no_symbol',
                'message' => "IPO {$ipo->company_name} does not have an NSE symbol defined.",
            ];
        }

        // Get PAN
        $pan = $batch->pan_number;
        if (empty($pan)) {
            $batchPan = $batch->batchPans()->with('userPan')->first();
            $pan = $batchPan?->userPan?->pan_number;
        }

        if (empty($pan)) {
            return [
                'success' => false,
                'status' => 'no_pan',
                'message' => 'No PAN number linked with this application.',
            ];
        }

        $result = self::queryAllotment($symbol, $pan);

        if ($result['success'] && $result['found']) {
            $updateData = [
                'allotment_details' => [
                    'source' => 'nse',
                    'symbol' => $symbol,
                    'order_number' => $result['order_number'],
                    'application_number' => $result['application_number'],
                    'applied_shares' => $result['app_shares'],
                    'allotted_shares' => $result['all_shares'],
                    'upi_amount' => $result['upi_amount'],
                    'upi_status' => $result['upi_status'],
                    'allotment_price' => $result['allotment_price'],
                    'allotted' => $result['allotted'],
                    'checked_at' => now()->toIso8601String(),
                ],
                'allotment_checked_at' => now(),
            ];

            if (! empty($result['application_number']) && empty($batch->application_number)) {
                $updateData['application_number'] = $result['application_number'];
            }

            $batch->update($updateData);

            // Update status and trigger settlements
            $targetStatus = $result['allotted'] ? 'allotted' : 'not_allotted';
            \App\Services\ApplicationBatchService::updateStatus(
                $batch,
                $targetStatus,
                "Auto-checked via NSE India Allotment Scraper (Applied: {$result['app_shares']}, Allotted: {$result['all_shares']})"
            );

            // Update IPO allotment_scraped_at
            $ipo->updateQuietly(['allotment_scraped_at' => now()]);

            AuditService::log('check_allotment', $batch, null, [
                'source' => 'nse',
                'status' => $result['status'],
                'allotted_shares' => $result['all_shares'],
                'applied_shares' => $result['app_shares'],
                'symbol' => $symbol,
                'order_no' => $result['order_number'],
            ]);
        } else {
            $batch->updateQuietly([
                'allotment_checked_at' => now(),
            ]);
        }

        $result['provider'] = 'nse';
        $result['ipo_name'] = $ipo->company_name;
        return $result;
    }

    /**
     * Execute scraper process using available PHP command execution mechanisms.
     */
    private static function executeScraper(string $symbol, string $pan): ?string
    {
        $base = base_path();
        $script = base_path('scripts/nse_scraper.mjs');
        $symbolArg = escapeshellarg($symbol);
        $panArg = escapeshellarg($pan);

        $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));

        // 1. Try Laravel Process (requires proc_open)
        if (function_exists('proc_open') && ! in_array('proc_open', $disabled, true)) {
            try {
                $res = Process::path($base)->timeout(45)->run(['node', 'scripts/nse_scraper.mjs', $symbol, $pan]);
                return $res->output();
            } catch (\Throwable $e) {
                Log::warning('proc_open runner failed, attempting exec fallback: ' . $e->getMessage());
            }
        }

        // 2. Try exec()
        if (function_exists('exec') && ! in_array('exec', $disabled, true)) {
            try {
                $cmd = "node " . escapeshellarg($script) . " {$symbolArg} {$panArg} 2>&1";
                $lines = [];
                @exec($cmd, $lines);
                if (! empty($lines)) {
                    return implode("\n", $lines);
                }
            } catch (\Throwable $e) {
                Log::warning('exec runner failed: ' . $e->getMessage());
            }
        }

        // 3. Try shell_exec()
        if (function_exists('shell_exec') && ! in_array('shell_exec', $disabled, true)) {
            try {
                $cmd = "node " . escapeshellarg($script) . " {$symbolArg} {$panArg} 2>&1";
                $out = @shell_exec($cmd);
                if ($out !== null && $out !== false) {
                    return (string) $out;
                }
            } catch (\Throwable $e) {
                Log::warning('shell_exec runner failed: ' . $e->getMessage());
            }
        }

        return null;
    }
}

