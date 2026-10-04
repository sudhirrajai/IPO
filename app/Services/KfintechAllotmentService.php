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
    private const API_ENDPOINT = 'https://0uz601ms56.execute-api.ap-south-1.amazonaws.com/prod/api/query?type=pan';
    private const CACHE_KEY_IPOS = 'kfintech_active_ipos_list';

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
            $context = stream_context_create([
                'ssl' => ['verify_peer' => false, 'verify_peer_name' => false],
                'http' => [
                    'header' => "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36\r\nAccept: */*\r\n",
                    'timeout' => 12,
                ],
            ]);

            $html = @file_get_contents(self::BASE_PORTAL_URL, false, $context);
            if (! $html) {
                return [];
            }

            // Extract the bundle js url
            $jsUrl = null;
            if (preg_match('/src="(\.\/static\/js\/main\.[a-z0-9]+\.js)"/', $html, $m)) {
                $jsUrl = self::BASE_PORTAL_URL . ltrim($m[1], './');
            } else {
                $jsUrl = self::BASE_PORTAL_URL . 'static/js/main.30273529.js';
            }

            $js = @file_get_contents($jsUrl, false, $context);
            if (! $js) {
                return [];
            }

            // Extract the JSON.parse array
            if (preg_match('/JSON\.parse\(\'(\[\{"clientId"[^\]]+\}\])\'\)/', $js, $m)) {
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
     * Find matching KFintech clientId for a given IPO.
     */
    public static function findMatchingKfinIpo(Ipo $ipo): ?array
    {
        if (! empty($ipo->kfin_client_id)) {
            return [
                'clientId' => $ipo->kfin_client_id,
                'name' => $ipo->company_name,
            ];
        }

        $kfinIpos = self::getActiveIpos();
        if (empty($kfinIpos)) {
            return null;
        }

        $cleanLocalName = self::normalizeName($ipo->company_name);
        $cleanSymbol = strtoupper(trim((string) $ipo->symbol));

        $bestMatch = null;
        $highestSimilarity = 0.0;

        foreach ($kfinIpos as $kfin) {
            $cleanKfinName = self::normalizeName($kfin['name']);

            // Exact substring check
            if (! empty($cleanLocalName) && (str_contains($cleanKfinName, $cleanLocalName) || str_contains($cleanLocalName, $cleanKfinName))) {
                $bestMatch = $kfin;
                $highestSimilarity = 100.0;
                break;
            }

            // Check if symbol matches words
            if (! empty($cleanSymbol) && str_contains(strtoupper($kfin['name']), $cleanSymbol)) {
                $bestMatch = $kfin;
                $highestSimilarity = 90.0;
                break;
            }

            // Levenshtein similarity
            similar_text($cleanLocalName, $cleanKfinName, $percent);
            if ($percent > $highestSimilarity && $percent >= 60.0) {
                $highestSimilarity = $percent;
                $bestMatch = $kfin;
            }
        }

        if ($bestMatch) {
            // Save client id for future checks
            $ipo->updateQuietly(['kfin_client_id' => $bestMatch['clientId']]);
            return $bestMatch;
        }

        return null;
    }

    /**
     * Normalize company name for reliable comparison.
     */
    private static function normalizeName(string $name): string
    {
        $name = strtoupper($name);
        $name = preg_replace('/\b(IPO|LIMITED|LTD|INDIA|SERVICES|PRIVATE|PVT|SME)\b/', '', $name);
        $name = preg_replace('/[^A-Z0-9]/', '', $name);
        return trim((string) $name);
    }

    /**
     * Query KFintech allotment API for a specific PAN and Client ID.
     */
    public static function queryAllotment(string $pan, string $clientId): array
    {
        $pan = strtoupper(trim($pan));
        if (strlen($pan) !== 10) {
            return [
                'success' => false,
                'status' => 'invalid_pan',
                'message' => 'PAN number must be exactly 10 characters.',
            ];
        }

        try {
            $headers = [
                'reqparam' => $pan,
                'client_id' => $clientId,
                'Origin' => 'https://ipostatus.kfintech.com',
                'Referer' => 'https://ipostatus.kfintech.com/',
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept' => 'application/json, text/plain, */*',
            ];

            $response = Http::timeout(15)
                ->withHeaders($headers)
                ->withoutVerifying()
                ->get(self::API_ENDPOINT);

            $status = $response->status();
            $body = $response->body();

            if ($status === 404 || str_contains($body, 'Record Not Found')) {
                return [
                    'success' => true,
                    'found' => false,
                    'status' => 'not_found',
                    'message' => 'No allotment record found for this PAN in KFintech registry.',
                ];
            }

            if (! $response->successful()) {
                return [
                    'success' => false,
                    'status' => 'api_error',
                    'message' => "KFintech server responded with status: {$status}",
                ];
            }

            $json = $response->json();
            $record = is_array($json) && isset($json[0]) ? $json[0] : (is_array($json) ? $json : null);

            if (! $record || ! isset($record['All_Shares'])) {
                return [
                    'success' => true,
                    'found' => false,
                    'status' => 'not_found',
                    'message' => 'Record not found or allotment not finalized yet.',
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
                'raw' => $record,
            ];
        } catch (Exception $e) {
            Log::error('KFintech allotment query exception: ' . $e->getMessage());
            return [
                'success' => false,
                'status' => 'error',
                'message' => 'Failed to reach KFintech server: ' . $e->getMessage(),
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
                'status' => 'error',
                'message' => 'Associated IPO not found.',
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

        $kfinIpo = self::findMatchingKfinIpo($ipo);
        if (! $kfinIpo) {
            return [
                'success' => false,
                'status' => 'ipo_not_on_kfintech',
                'message' => "IPO {$ipo->company_name} is not currently registered on KFintech allotment registry.",
            ];
        }

        $result = self::queryAllotment($pan, $kfinIpo['clientId']);

        if ($result['success'] && $result['found']) {
            $updateData = [
                'allotment_details' => [
                    'kfin_client_id' => $kfinIpo['clientId'],
                    'kfin_ipo_name' => $kfinIpo['name'],
                    'application_number' => $result['application_number'],
                    'name_from_pan' => $result['name_from_pan'],
                    'applied_shares' => $result['app_shares'],
                    'allotted_shares' => $result['all_shares'],
                    'dp_clid' => $result['dp_clid'],
                    'pan_masked' => $result['pan_masked'],
                    'allotted' => $result['allotted'],
                    'checked_at' => now()->toIso8601String(),
                ],
                'allotment_checked_at' => now(),
            ];

            // Always update applicant_name with verified name from KFintech allotment record
            if (! empty($result['name_from_pan'])) {
                $updateData['applicant_name'] = trim($result['name_from_pan']);
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
                    ->update(['account_holder_name' => trim($result['name_from_pan'])]);
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
            $batch->updateQuietly([
                'allotment_checked_at' => now(),
            ]);
        }

        $result['kfin_ipo_name'] = $kfinIpo['name'];
        $result['pan'] = $pan;
        return $result;
    }
}
