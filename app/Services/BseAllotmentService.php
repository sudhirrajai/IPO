<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class BseAllotmentService
{
    private const BASE_API_URL = 'https://api.bseindia.com/BseIndiaAPI/api';
    private const CACHE_KEY_IPOS = 'bse_active_ipo_list';

    /**
     * Browser headers required to pass BSE Cloudflare / firewall checks.
     *
     * @return array<string, string>
     */
    private static function getHeaders(): array
    {
        return [
            'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
            'Accept' => 'application/json, text/plain, */*',
            'Accept-Language' => 'en-US,en;q=0.9',
            'Referer' => 'https://www.bseindia.com/',
            'Origin' => 'https://www.bseindia.com',
            'Sec-Ch-Ua' => '"Google Chrome";v="129", "Not=A?Brand";v="8", "Chromium";v="129"',
            'Sec-Ch-Ua-Mobile' => '?0',
            'Sec-Ch-Ua-Platform' => '"Windows"',
            'Sec-Fetch-Dest' => 'empty',
            'Sec-Fetch-Mode' => 'cors',
            'Sec-Fetch-Site' => 'same-site',
        ];
    }

    /**
     * Fetch active list of IPOs available on BSE Application Check portal (Book Building).
     * Cached for 30 minutes.
     *
     * @return array<int, array{IM_ID: string, IPOName: string, IPOSymbol: string}>
     */
    public static function getActiveIpos(bool $forceRefresh = false): array
    {
        if (! $forceRefresh && Cache::has(self::CACHE_KEY_IPOS)) {
            return (array) Cache::get(self::CACHE_KEY_IPOS);
        }

        try {
            $response = Http::withHeaders(self::getHeaders())
                ->timeout(12)
                ->get(self::BASE_API_URL . '/appli_check_ng/w', [
                    'itype' => 'BB',
                ]);

            if ($response->successful()) {
                $data = $response->json();
                $table = $data['table'] ?? [];
                if (is_array($table) && count($table) > 0) {
                    Cache::put(self::CACHE_KEY_IPOS, $table, now()->addMinutes(30));
                    return $table;
                }
            }
        } catch (Exception $e) {
            Log::warning('Failed to fetch BSE active IPO list via HTTP: ' . $e->getMessage());
        }

        // Headless Chrome fallback if HTTP request is blocked by BSE Akamai/WAF
        $scraperOutput = self::executeScraper('list');
        if (! empty($scraperOutput) && preg_match('/RESULT_START\s*([\s\S]*?)\s*RESULT_END/', $scraperOutput, $matches)) {
            $data = json_decode(trim($matches[1]), true);
            $table = $data['table'] ?? [];
            if (is_array($table) && count($table) > 0) {
                Cache::put(self::CACHE_KEY_IPOS, $table, now()->addMinutes(30));
                return $table;
            }
        }

        return [];
    }

    /**
     * Resolve the BSE IM_ID for an IPO by Symbol or Name.
     */
    public static function resolveImId(Ipo $ipo): ?string
    {
        $ipos = self::getActiveIpos();
        if (empty($ipos)) {
            $ipos = self::getActiveIpos(true);
        }

        $symbol = strtoupper(trim($ipo->symbol ?? ''));
        $name = strtolower(trim($ipo->company_name ?? ''));

        // 1. Direct symbol match
        if (! empty($symbol)) {
            foreach ($ipos as $item) {
                if (isset($item['IPOSymbol']) && strtoupper(trim($item['IPOSymbol'])) === $symbol) {
                    return (string) $item['IM_ID'];
                }
            }
        }

        // 2. Direct substring match
        if (! empty($name)) {
            foreach ($ipos as $item) {
                $bseName = strtolower(trim($item['IPOName'] ?? ''));
                if (str_contains($bseName, $name) || str_contains($name, $bseName)) {
                    return (string) $item['IM_ID'];
                }
            }
        }

        // 3. Intelligent token-based keyword match
        $localTokens = KfintechAllotmentService::extractKeywords($ipo->company_name ?? '');
        $bestMatchId = null;
        $bestScore = 0.0;

        foreach ($ipos as $item) {
            $bseName = $item['IPOName'] ?? '';
            $bseTokens = KfintechAllotmentService::extractKeywords($bseName);

            $common = array_intersect($localTokens, $bseTokens);
            $countCommon = count($common);

            if ($countCommon > 0) {
                $score = ($countCommon / max(count($localTokens), 1)) * 100;
                if ($score > $bestScore && $score >= 50.0) {
                    $bestScore = $score;
                    $bestMatchId = (string) $item['IM_ID'];
                }
            }
        }

        return $bestMatchId;
    }

    /**
     * Query BSE allotment API directly for a PAN and IM_ID.
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
     *     symbol: string|null,
     *     pan: string,
     *     provider: string
     * }
     */
    public static function queryAllotment(string $imId, string $pan, ?string $appNo = null): array
    {
        $pan = strtoupper(trim($pan));
        $appNo = trim($appNo ?? '');

        if (empty($imId) || empty($pan)) {
            return [
                'success' => false,
                'status' => 'missing_params',
                'found' => false,
                'message' => 'IM_ID and PAN are required for BSE allotment check.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'order_number' => null,
                'upi_amount' => null,
                'upi_status' => null,
                'allotment_price' => null,
                'symbol' => null,
                'pan' => $pan,
                'provider' => 'bse',
            ];
        }

        $data = null;

        try {
            $response = Http::withHeaders(self::getHeaders())
                ->timeout(12)
                ->get(self::BASE_API_URL . '/GETIPOAPPLSTATUS_EQ_Live_ng/w', [
                    'imId' => $imId,
                    'appNo' => $appNo,
                    'panNo' => $pan,
                ]);

            if ($response->successful()) {
                $data = $response->json();
            }
        } catch (Exception $e) {
            Log::warning('BSE allotment check HTTP request failed: ' . $e->getMessage());
        }

        try {
            // Headless Chrome fallback if HTTP request is blocked by BSE Akamai/WAF
            if ($data === null) {
                $scraperOutput = self::executeScraper('query', $imId, $pan, $appNo);
                if (! empty($scraperOutput) && preg_match('/RESULT_START\s*([\s\S]*?)\s*RESULT_END/', $scraperOutput, $matches)) {
                    $data = json_decode(trim($matches[1]), true);
                }
            }

            if ($data === null || ! is_array($data)) {
                return [
                    'success' => false,
                    'status' => 'http_error',
                    'found' => false,
                    'message' => 'Unable to reach BSE allotment verification service (WAF blocked).',
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'order_number' => null,
                    'upi_amount' => null,
                    'upi_status' => null,
                    'allotment_price' => null,
                    'symbol' => null,
                    'pan' => $pan,
                    'provider' => 'bse',
                ];
            }

        $table = $data['Table'] ?? [];

            if (empty($table) || ! is_array($table)) {
                return [
                    'success' => true,
                    'status' => 'not_found',
                    'found' => false,
                    'message' => "No bid or allotment records found on BSE for PAN {$pan}.",
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'order_number' => null,
                    'upi_amount' => null,
                    'upi_status' => null,
                    'allotment_price' => null,
                    'symbol' => null,
                    'pan' => $pan,
                    'provider' => 'bse',
                ];
            }

            $first = $table[0];
            $isData = (int) ($first['IsData'] ?? 0);
            $hasAppNo = ! empty($first['OE_APPLICATIONNO']);
            $hasQty = ! empty($first['OE_QTY']) && (int) $first['OE_QTY'] > 0;

            if ($isData === 0 && ! $hasAppNo && ! $hasQty) {
                return [
                    'success' => true,
                    'status' => 'not_found',
                    'found' => false,
                    'message' => "No application found on BSE for PAN {$pan}.",
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'order_number' => null,
                    'upi_amount' => null,
                    'upi_status' => null,
                    'allotment_price' => null,
                    'symbol' => $first['IM_IPO_SYMBOL'] ?? null,
                    'pan' => $pan,
                    'provider' => 'bse',
                ];
            }

            $allotmentQty = (int) ($first['ARAD_ALLTDQTY'] ?? 0);
            $isAllotted = $allotmentQty > 0;
            $appShares = (int) ($first['OE_QTY'] ?? 0);
            $appNum = $first['OE_APPLICATIONNO'] ?? null;
            $allotmentPrice = isset($first['ARAD_ALLTDPRICE']) ? (string) $first['ARAD_ALLTDPRICE'] : null;

            return [
                'success' => true,
                'status' => 'found',
                'found' => true,
                'message' => $isAllotted
                    ? "Allotment confirmed on BSE: {$allotmentQty} shares allotted!"
                    : 'Application verified on BSE: No shares allotted.',
                'allotted' => $isAllotted,
                'all_shares' => $allotmentQty,
                'app_shares' => $appShares,
                'application_number' => $appNum,
                'order_number' => $first['BIDID'] ?? null,
                'upi_amount' => isset($first['OE_SPONBNKAMTBLOCKED']) ? (string) $first['OE_SPONBNKAMTBLOCKED'] : null,
                'upi_status' => $first['UPI_CONFIRMATION_STATUS'] ?? null,
                'allotment_price' => $allotmentPrice,
                'symbol' => $first['IM_IPO_SYMBOL'] ?? null,
                'pan' => $pan,
                'provider' => 'bse',
            ];
        } catch (Exception $e) {
            Log::error('BSE allotment check exception: ' . $e->getMessage());
            return [
                'success' => false,
                'status' => 'exception',
                'found' => false,
                'message' => 'BSE check error: ' . $e->getMessage(),
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'order_number' => null,
                'upi_amount' => null,
                'upi_status' => null,
                'allotment_price' => null,
                'symbol' => null,
                'pan' => $pan,
                'provider' => 'bse',
            ];
        }
    }

    /**
     * Check allotment on BSE for a specific ApplicationBatch and update database.
     */
    public static function checkBatchAllotment(ApplicationBatch $batch): array
    {
        $ipo = $batch->ipo;
        if (! $ipo) {
            return [
                'success' => false,
                'status' => 'error',
                'message' => 'Associated IPO not found.',
                'provider' => 'bse',
            ];
        }

        $imId = self::resolveImId($ipo);
        if (! $imId) {
            return [
                'success' => false,
                'status' => 'not_listed_on_bse',
                'message' => "IPO {$ipo->company_name} was not found on the BSE application check portal.",
                'provider' => 'bse',
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
                'provider' => 'bse',
            ];
        }

        $result = self::queryAllotment($imId, $pan, $batch->application_number);

        if ($result['success'] && $result['found']) {
            $updateData = [
                'allotment_details' => [
                    'source' => 'bse',
                    'im_id' => $imId,
                    'symbol' => $result['symbol'] ?? $ipo->symbol,
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
                "Auto-checked via BSE India Live API (Applied: {$result['app_shares']}, Allotted: {$result['all_shares']})"
            );

            // Update IPO allotment_scraped_at
            $ipo->updateQuietly(['allotment_scraped_at' => now()]);

            AuditService::log('check_allotment', $batch, null, [
                'source' => 'bse',
                'status' => $result['status'],
                'allotted_shares' => $result['all_shares'],
                'applied_shares' => $result['app_shares'],
                'im_id' => $imId,
            ]);
        } else {
            $batch->updateQuietly([
                'allotment_checked_at' => now(),
            ]);
        }

        $result['ipo_name'] = $ipo->company_name;
        return $result;
    }

    /**
     * Execute headless BSE scraper process with fallbacks for restricted environments.
     */
    private static function executeScraper(string $action, ?string $imId = null, ?string $pan = null, ?string $appNo = null): ?string
    {
        $base = base_path();
        $script = base_path('scripts/bse_scraper.mjs');
        if (! file_exists($script)) {
            return null;
        }

        $args = ['node', 'scripts/bse_scraper.mjs', $action];
        if ($imId !== null) $args[] = $imId;
        if ($pan !== null) $args[] = $pan;
        if ($appNo !== null) $args[] = $appNo;

        $disabled = array_map('trim', explode(',', (string) ini_get('disable_functions')));

        // 1. Try Laravel Process (requires proc_open)
        if (function_exists('proc_open') && ! in_array('proc_open', $disabled, true)) {
            try {
                $res = \Illuminate\Support\Facades\Process::path($base)->timeout(45)->run($args);
                return $res->output();
            } catch (\Throwable $e) {
                Log::warning('proc_open runner failed for BSE scraper, attempting exec fallback: ' . $e->getMessage());
            }
        }

        // 2. Try exec()
        if (function_exists('exec') && ! in_array('exec', $disabled, true)) {
            try {
                $escapedArgs = array_map('escapeshellarg', array_slice($args, 1));
                $cmd = "node " . implode(' ', $escapedArgs) . " 2>&1";
                $lines = [];
                @exec($cmd, $lines);
                if (! empty($lines)) {
                    return implode("\n", $lines);
                }
            } catch (\Throwable $e) {
                Log::warning('exec runner failed for BSE scraper: ' . $e->getMessage());
            }
        }

        // 3. Try shell_exec()
        if (function_exists('shell_exec') && ! in_array('shell_exec', $disabled, true)) {
            try {
                $escapedArgs = array_map('escapeshellarg', array_slice($args, 1));
                $cmd = "node " . implode(' ', $escapedArgs) . " 2>&1";
                $out = @shell_exec($cmd);
                if ($out !== null && $out !== false) {
                    return $out;
                }
            } catch (\Throwable $e) {
                Log::warning('shell_exec runner failed for BSE scraper: ' . $e->getMessage());
            }
        }

        return null;
    }
}
