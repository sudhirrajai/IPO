<?php

namespace App\Services;

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\UserPan;
use Exception;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class KfintechAllotmentService
{
    private const BASE_PORTAL_URL = 'https://ipostatus.kfintech.com/';
    private const DEFAULT_API_ENDPOINT = 'https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=';
    private const CACHE_KEY_IPOS = 'kfintech_active_ipos_list';
    private const CACHE_KEY_ENDPOINT = 'kfintech_api_endpoint_url';

    /**
     * Common noise words to strip when matching company names against KFintech listings.
     */
    private const STOP_WORDS = [
        'LIMITED', 'LTD', 'PVT', 'PRIVATE', 'CORP', 'CORPORATION', 'ENTERPRISE', 'ENTERPRISES',
        'HOLDINGS', 'HOLDING', 'SERVICES', 'SERVICE', 'INDIA', 'AND', '&', 'THE', 'OF', 'CO',
        'COMPANY', 'TECH', 'TECHNOLOGIES', 'TECHNOLOGY', 'SOLUTIONS', 'SYSTEMS', 'SME', 'IPO',
    ];

    /**
     * Get the active KFintech API query endpoint base URL.
     */
    public static function getApiEndpoint(): string
    {
        return (string) Cache::get(self::CACHE_KEY_ENDPOINT, self::DEFAULT_API_ENDPOINT);
    }

    /**
     * Fetch active list of IPOs available on KFintech portal.
     * Caches result for 60 minutes for high performance.
     *
     * @return array<int, array{clientId: string, name: string}>
     */
    public static function getActiveIpos(bool $forceRefresh = false): array
    {
        if (! $forceRefresh && Cache::has(self::CACHE_KEY_IPOS)) {
            return (array) Cache::get(self::CACHE_KEY_IPOS);
        }

        try {
            $response = Http::timeout(15)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                    'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                    'Accept-Language' => 'en-US,en;q=0.9',
                ])
                ->get(self::BASE_PORTAL_URL);

            if (! $response->successful()) {
                return [];
            }

            $html = $response->body();

            // Extract the main bundle js url from script tag
            $jsUrl = null;
            if (preg_match('/src="(?:\.\/|\/)?(static\/js\/main\.[a-z0-9]+\.js)"/i', $html, $m)) {
                $jsUrl = self::BASE_PORTAL_URL . $m[1];
            } else {
                $jsUrl = self::BASE_PORTAL_URL . 'static/js/main.bd1f330c.js';
            }

            $jsResponse = Http::timeout(15)
                ->withoutVerifying()
                ->withHeaders([
                    'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                    'Referer' => self::BASE_PORTAL_URL,
                ])
                ->get($jsUrl);

            if (! $jsResponse->successful()) {
                return [];
            }

            $js = $jsResponse->body();

            // Dynamically extract the AWS API Gateway endpoint if present in the bundle
            if (preg_match('/(https:\/\/[a-z0-9]+\.execute-api\.[a-z0-9\-]+\.amazonaws\.com\/[^\/]+\/api\/query\?type=)/i', $js, $epMatch)) {
                Cache::put(self::CACHE_KEY_ENDPOINT, $epMatch[1], now()->addHours(6));
            }

            // Extract the active IPOs list array: JSON.parse('[{"clientId":"...","name":"..."},...]')
            if (preg_match('/JSON\.parse\(\s*[\'"](\[\s*\{.*?clientId.*?\Branch.*?\Branch.*?\}\s*\])[\'"]\s*\)/s', $js, $m) ||
                preg_match('/JSON\.parse\(\s*[\'"](\[\s*\{"clientId".*?\}\s*\])[\'"]\s*\)/s', $js, $m)) {
                $list = json_decode($m[1], true);
                if (is_array($list) && count($list) > 0) {
                    Cache::put(self::CACHE_KEY_IPOS, $list, now()->addMinutes(60));
                    return $list;
                }
            }
        } catch (Exception $e) {
            Log::warning('Failed to scrape KFintech active IPOs: ' . $e->getMessage());
        }

        return [];
    }

    /**
     * Extract significant keywords from a company name for intelligent token-based matching.
     *
     * @return array<int, string>
     */
    public static function extractKeywords(string $name): array
    {
        $name = strtoupper($name);
        // Remove common qualifiers in parentheses like (SME), (Mainboard)
        $name = preg_replace('/\b(SME|MAINBOARD|RETAIL|HNI)\b/i', '', $name);
        // Replace non-alphanumeric chars with whitespace
        $name = preg_replace('/[^A-Z0-9\s]/', ' ', $name);
        $words = preg_split('/\s+/', trim((string) $name)) ?: [];

        $filtered = [];
        foreach ($words as $w) {
            $w = trim($w);
            if (strlen($w) >= 2 && ! in_array($w, self::STOP_WORDS, true)) {
                $filtered[] = $w;
            }
        }

        return array_values(array_unique($filtered));
    }

    /**
     * Find matching KFintech clientId for a given IPO using token intersection & similarity.
     *
     * @return array{clientId: string, name: string}|null
     */
    public static function findMatchingKfinIpo(Ipo $ipo): ?array
    {
        // 1. If IPO already has an explicit kfin_client_id set, honor it immediately
        if (! empty($ipo->kfin_client_id)) {
            return [
                'clientId' => $ipo->kfin_client_id,
                'name' => $ipo->company_name,
            ];
        }

        $kfinIpos = self::getActiveIpos();
        if (empty($kfinIpos)) {
            $kfinIpos = self::getActiveIpos(true);
        }

        if (empty($kfinIpos)) {
            return null;
        }

        $localTokens = self::extractKeywords($ipo->company_name);
        $cleanLocal = implode('', $localTokens);
        $cleanSymbol = strtoupper(trim((string) ($ipo->symbol ?? '')));

        $bestMatch = null;
        $bestScore = 0.0;

        foreach ($kfinIpos as $kfin) {
            $kfinTokens = self::extractKeywords($kfin['name']);
            $cleanKfin = implode('', $kfinTokens);

            $score = 0.0;

            // Exact cleaned token string match (e.g. JIOPLATFORMS === JIOPLATFORMS)
            if (! empty($cleanLocal) && $cleanLocal === $cleanKfin) {
                $score = 100.0;
            } else {
                // Token intersection
                $intersect = array_intersect($localTokens, $kfinTokens);
                $intersectCount = count($intersect);

                if ($intersectCount > 0) {
                    $maxTokens = max(count($localTokens), count($kfinTokens));
                    $minTokens = min(count($localTokens), count($kfinTokens));

                    // If all key tokens of either name are in the other name
                    if ($intersectCount === $minTokens && $minTokens >= 1) {
                        $score = 90.0 + (($intersectCount / $maxTokens) * 10.0);
                    } else {
                        $score = ($intersectCount / $maxTokens) * 80.0;
                    }
                }

                // Symbol match (only if symbol is meaningful, >= 3 chars, and matches a word or starts with it)
                if (! empty($cleanSymbol) && strlen($cleanSymbol) >= 3) {
                    if (in_array($cleanSymbol, $kfinTokens, true) || str_starts_with($cleanKfin, $cleanSymbol) || str_contains($cleanKfin, $cleanSymbol)) {
                        $score = max($score, 85.0);
                    }
                }

                // Fuzzy similarity fallback
                if ($score < 70.0 && ! empty($cleanLocal) && ! empty($cleanKfin)) {
                    similar_text($cleanLocal, $cleanKfin, $sim);
                    if ($sim >= 75.0) {
                        $score = max($score, (float) $sim);
                    }
                }
            }

            if ($score > $bestScore && $score >= 70.0) {
                $bestScore = $score;
                $bestMatch = $kfin;
            }
        }

        if ($bestMatch) {
            // Save verified client ID and registrar on the IPO
            $updates = ['kfin_client_id' => $bestMatch['clientId']];
            if (empty($ipo->registrar) || ! str_contains(strtolower((string) $ipo->registrar), 'kfin')) {
                $updates['registrar_info'] = 'KFin Technologies';
            }
            $ipo->updateQuietly($updates);
            return $bestMatch;
        }

        return null;
    }

    /**
     * Query KFintech allotment API directly for a PAN, Application No, or DPID Client ID.
     *
     * @param string $identifier Value to search for (PAN, Application No, or DP ID)
     * @param string $clientId KFintech assigned company clientId
     * @param string $type Query type: 'pan' | 'appno' | 'dpclid'
     * @return array{
     *     success: bool,
     *     found: bool,
     *     status: string,
     *     message: string,
     *     allotted: bool,
     *     all_shares: int,
     *     app_shares: int,
     *     application_number: string|null,
     *     name_from_pan: string|null,
     *     dp_clid: string|null,
     *     pan_masked: string|null,
     *     provider: string,
     *     raw?: array
     * }
     */
    public static function queryAllotment(string $identifier, string $clientId, string $type = 'pan'): array
    {
        $identifier = strtoupper(trim($identifier));
        $type = strtolower(trim($type));

        if (! in_array($type, ['pan', 'appno', 'dpclid'], true)) {
            $type = 'pan';
        }

        if ($type === 'pan' && strlen($identifier) !== 10) {
            return [
                'success' => false,
                'found' => false,
                'status' => 'invalid_pan',
                'message' => 'PAN number must be exactly 10 characters.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'name_from_pan' => null,
                'dp_clid' => null,
                'pan_masked' => null,
                'provider' => 'kfintech',
            ];
        }

        if (empty($identifier) || empty($clientId)) {
            return [
                'success' => false,
                'found' => false,
                'status' => 'missing_params',
                'message' => 'Client ID and query identifier are required.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'name_from_pan' => null,
                'dp_clid' => null,
                'pan_masked' => null,
                'provider' => 'kfintech',
            ];
        }

        try {
            $endpoint = self::getApiEndpoint() . $type;

            $headers = [
                'reqparam' => $identifier,
                'client_id' => $clientId,
                'Access-Control-Allow-Origin' => '*',
                'Origin' => 'https://ipostatus.kfintech.com',
                'Referer' => 'https://ipostatus.kfintech.com/',
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36',
                'Accept' => 'application/json, text/plain, */*',
            ];

            $response = Http::timeout(15)
                ->withHeaders($headers)
                ->withoutVerifying()
                ->get($endpoint);

            $status = $response->status();
            $body = $response->body();

            // 404 or {"error":"Record Not Found"} indicates not in registrar yet or not allotted
            if ($status === 404 || str_contains($body, 'Record Not Found')) {
                return [
                    'success' => true,
                    'found' => false,
                    'status' => 'not_found',
                    'message' => "No allotment record found for {$identifier} in KFintech registry.",
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'name_from_pan' => null,
                    'dp_clid' => null,
                    'pan_masked' => null,
                    'provider' => 'kfintech',
                ];
            }

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'found' => false,
                    'status' => 'api_error',
                    'message' => "KFintech server responded with status: {$status}",
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'name_from_pan' => null,
                    'dp_clid' => null,
                    'pan_masked' => null,
                    'provider' => 'kfintech',
                ];
            }

            $json = $response->json();
            $record = is_array($json) && isset($json[0]) ? $json[0] : (is_array($json) ? $json : null);

            if (! $record || ! isset($record['All_Shares'])) {
                return [
                    'success' => true,
                    'found' => false,
                    'status' => 'not_found',
                    'message' => 'Record not found or allotment not finalized yet on KFintech.',
                    'allotted' => false,
                    'all_shares' => 0,
                    'app_shares' => 0,
                    'application_number' => null,
                    'name_from_pan' => null,
                    'dp_clid' => null,
                    'pan_masked' => null,
                    'provider' => 'kfintech',
                ];
            }

            $allShares = (int) ($record['All_Shares'] ?? 0);
            $appShares = (int) ($record['App_Shares'] ?? 0);
            $isAllotted = ($allShares > 0);

            return [
                'success' => true,
                'found' => true,
                'status' => $isAllotted ? 'allotted' : 'not_allotted',
                'allotted' => $isAllotted,
                'all_shares' => $allShares,
                'app_shares' => $appShares,
                'application_number' => $record['Appln_No'] ?? null,
                'name_from_pan' => $record['Name'] ?? null,
                'dp_clid' => $record['DP_CLID'] ?? null,
                'pan_masked' => $record['Pan_No'] ?? null,
                'provider' => 'kfintech',
                'raw' => $record,
            ];
        } catch (Exception $e) {
            Log::error('KFintech allotment query exception: ' . $e->getMessage());
            return [
                'success' => false,
                'found' => false,
                'status' => 'error',
                'message' => 'Failed to reach KFintech server: ' . $e->getMessage(),
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'application_number' => null,
                'name_from_pan' => null,
                'dp_clid' => null,
                'pan_masked' => null,
                'provider' => 'kfintech',
            ];
        }
    }

    /**
     * Check allotment for a specific ApplicationBatch and update database.
     */
    public static function checkBatchAllotment(ApplicationBatch $batch): array
    {
        $ipo = $batch->ipo;
        if (! $ipo) {
            return [
                'success' => false,
                'found' => false,
                'status' => 'error',
                'message' => 'Associated IPO not found.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'provider' => 'kfintech',
            ];
        }

        // Resolve PAN: Check batch pan_number, batchPans relation, or pan_number_snapshot
        $pan = strtoupper(trim((string) $batch->pan_number));
        if (empty($pan) || strlen($pan) !== 10) {
            $batchPan = $batch->batchPans()->with('userPan')->first();
            $pan = strtoupper(trim((string) ($batchPan?->userPan?->pan_number ?: $batchPan?->pan_number_snapshot)));
        }

        if (empty($pan) || strlen($pan) !== 10) {
            return [
                'success' => false,
                'found' => false,
                'status' => 'no_pan',
                'message' => 'No valid 10-character PAN number linked with this application.',
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'provider' => 'kfintech',
            ];
        }

        $kfinIpo = self::findMatchingKfinIpo($ipo);
        if (! $kfinIpo) {
            return [
                'success' => false,
                'found' => false,
                'status' => 'ipo_not_on_kfintech',
                'message' => "IPO {$ipo->company_name} is not currently active on KFintech allotment registry.",
                'allotted' => false,
                'all_shares' => 0,
                'app_shares' => 0,
                'provider' => 'kfintech',
            ];
        }

        $result = self::queryAllotment($pan, $kfinIpo['clientId'], 'pan');

        if ($result['success'] && $result['found']) {
            $updateData = [
                'allotment_details' => [
                    'source' => 'kfintech',
                    'status' => $result['status'],
                    'found' => true,
                    'allotted' => $result['allotted'],
                    'allotted_shares' => $result['all_shares'],
                    'applied_shares' => $result['app_shares'],
                    'application_number' => $result['application_number'],
                    'name_from_pan' => $result['name_from_pan'],
                    'dp_clid' => $result['dp_clid'],
                    'pan_masked' => $result['pan_masked'],
                    'kfin_client_id' => $kfinIpo['clientId'],
                    'kfin_ipo_name' => $kfinIpo['name'],
                    'checked_at' => now()->toIso8601String(),
                ],
                'allotment_checked_at' => now(),
            ];

            // Always update applicant_name with verified legal name from KFintech allotment record
            if (! empty($result['name_from_pan'])) {
                $updateData['applicant_name'] = trim((string) $result['name_from_pan']);
            }

            $batch->update($updateData);

            // Trigger settlement logic via ApplicationBatchService
            $targetStatus = $result['allotted'] ? 'allotted' : 'not_allotted';
            \App\Services\ApplicationBatchService::updateStatus(
                $batch,
                $targetStatus,
                "Auto-checked via KFintech Allotment Scraper (Applied: {$result['app_shares']}, Allotted: {$result['all_shares']})"
            );

            // Always update and synchronize verified account_holder_name on UserPan
            if (! empty($result['name_from_pan'])) {
                UserPan::where('pan_number', strtoupper($pan))
                    ->update(['account_holder_name' => trim((string) $result['name_from_pan'])]);
            }

            // Update IPO allotment_scraped_at
            $ipo->updateQuietly(['allotment_scraped_at' => now()]);

            AuditService::log('check_allotment', $batch, null, [
                'source' => 'kfintech',
                'status' => $result['status'],
                'allotted_shares' => $result['all_shares'],
                'applied_shares' => $result['app_shares'],
                'name_from_pan' => $result['name_from_pan'],
            ]);
        } else {
            // Record was checked but not found: update details so UI knows it's pending/not found
            // rather than falsely asserting zero shares were allotted
            $batch->updateQuietly([
                'allotment_checked_at' => now(),
                'allotment_details' => [
                    'source' => 'kfintech',
                    'status' => 'not_found',
                    'found' => false,
                    'allotted' => false,
                    'allotted_shares' => 0,
                    'message' => $result['message'] ?? 'Record not found in KFintech registry.',
                    'checked_at' => now()->toIso8601String(),
                ],
            ]);
        }

        $result['kfin_ipo_name'] = $kfinIpo['name'];
        $result['pan'] = $pan;
        $result['provider'] = 'kfintech';
        return $result;
    }
}

