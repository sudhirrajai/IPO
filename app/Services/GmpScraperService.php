<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\AuditLog;
use App\Models\Ipo;
use App\Models\SyncLog;
use DOMDocument;
use DOMXPath;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class GmpScraperService
{
    public const INVESTORGAIN_URL = 'https://www.investorgain.com/report/ipo-gmp-live/331/';

    /**
     * Scrape live GMP report table from InvestorGain.
     *
     * @return array<int, array<string, mixed>>
     */
    public function scrapeInvestorGain(): array
    {
        try {
            $response = Http::withHeaders([
                'User-Agent' => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                'Accept' => 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
                'Accept-Language' => 'en-US,en;q=0.9',
                'Cache-Control' => 'no-cache',
            ])->timeout(25)->get(self::INVESTORGAIN_URL);

            if (! $response->successful()) {
                Log::warning('InvestorGain GMP scrape failed with status: ' . $response->status());
                return [];
            }

            return $this->parseHtml($response->body());
        } catch (\Throwable $e) {
            Log::error('Error scraping InvestorGain GMP: ' . $e->getMessage(), [
                'exception' => $e,
            ]);
            return [];
        }
    }

    /**
     * Parse HTML and extract IPO records.
     *
     * @return array<int, array<string, mixed>>
     */
    public function parseHtml(string $html): array
    {
        $dom = new DOMDocument();
        libxml_use_internal_errors(true);
        if (! str_contains($html, 'charset') && ! str_contains($html, '<?xml')) {
            $html = '<meta http-equiv="Content-Type" content="text/html; charset=utf-8">' . $html;
        }
        $dom->loadHTML($html);
        libxml_clear_errors();

        $xpath = new DOMXPath($dom);
        $rows = $xpath->query('//table//tr');

        $results = [];

        foreach ($rows as $row) {
            $tds = $xpath->query('.//td', $row);
            if ($tds->length < 5) {
                continue;
            }

            // 1. Company Name & Type
            $nameCell = $tds->item(0);
            $aTag = $xpath->query('.//a', $nameCell)->item(0);
            $companyName = $aTag ? trim($aTag->textContent) : trim($nameCell->textContent);

            if (empty($companyName)) {
                continue;
            }

            $cellHtml = $dom->saveHTML($nameCell);
            // Mainboard has no SME tag, SME explicitly has 'SME' in the tag/badge
            $isSme = (stripos($cellHtml, 'SME') !== false);
            $ipoType = $isSme ? 'sme' : 'mainboard';

            // 2. GMP
            $gmpCell = $tds->item(1);
            $gmpText = trim($gmpCell->textContent);
            $gmp = null;
            $gmpPercent = null;

            if (preg_match('/(?:₹|&#8377;|â‚¹|\x{20B9}|Rs\.?)?\s*([0-9\.\-]+)\s*\(([\-0-9\.]+)%\)/u', $gmpText, $m)) {
                if ($m[1] !== '--' && is_numeric($m[1])) {
                    $gmp = (float) $m[1];
                }
                if (is_numeric($m[2])) {
                    $gmpPercent = (float) $m[2];
                }
            }

            // 3. Subscription
            $subCell = $tds->item(3);
            $subText = trim($subCell->textContent);
            $subscription = null;
            if (preg_match('/([0-9\.]+)x/i', $subText, $sm)) {
                $subscription = (float) $sm[1];
            }

            // 4. Price & Lot Size
            $priceText = trim($tds->item(4)->textContent);
            $price = is_numeric($priceText) ? (float) $priceText : null;

            $lotText = $tds->length > 6 ? str_replace(',', '', trim($tds->item(6)->textContent)) : null;
            $lot = is_numeric($lotText) ? (int) $lotText : null;

            // 5. Updated On
            $updatedOn = $tds->length > 11 ? trim($tds->item(11)->textContent) : null;

            $results[] = [
                'name' => $companyName,
                'clean_name' => $this->normalizeName($companyName),
                'ipo_type' => $ipoType,
                'gmp' => $gmp,
                'gmp_percent' => $gmpPercent,
                'subscription' => $subscription,
                'price' => $price,
                'lot' => $lot,
                'raw_gmp' => $gmpText,
                'updated_on' => $updatedOn,
            ];
        }

        return $results;
    }

    /**
     * Sync scraped GMP data into local database IPOs.
     *
     * @return array<string, mixed>
     */
    public function syncGmpData(): array
    {
        $startTime = microtime(true);
        $scrapedItems = $this->scrapeInvestorGain();

        if (empty($scrapedItems)) {
            return [
                'success' => false,
                'message' => 'No GMP records could be scraped from InvestorGain.',
                'total_scraped' => 0,
                'matched_count' => 0,
                'updated_count' => 0,
                'duration_ms' => 0,
                'matches' => [],
            ];
        }

        $ipos = Ipo::all();
        $matchedCount = 0;
        $updatedCount = 0;
        $matches = [];

        foreach ($ipos as $ipo) {
            $match = $this->findBestMatch($ipo, $scrapedItems);

            if ($match) {
                $matchedCount++;
                $hasChanged = false;
                $previousGmp = $ipo->gmp;
                $previousSub = $ipo->total_subscription;

                // Update GMP if scraped value is provided
                if ($match['gmp'] !== null) {
                    $newGmp = (float) $match['gmp'];
                    if ((float) $ipo->gmp !== $newGmp) {
                        $ipo->gmp = $newGmp;
                        $hasChanged = true;
                    }
                }

                // Update total subscription if available from scraper
                if ($match['subscription'] !== null && $match['subscription'] > 0) {
                    $subStr = (string) $match['subscription'];
                    if ($ipo->total_subscription !== $subStr) {
                        $hasChanged = true;
                    }
                }

                // Update raw_provider_data payload
                $raw = is_array($ipo->raw_provider_data) ? $ipo->raw_provider_data : [];
                if ($match['subscription'] !== null && $match['subscription'] > 0) {
                    $raw['total_subscription'] = (string) $match['subscription'];
                }
                $raw['gmp_source'] = 'investorgain';
                $raw['gmp_scraped_at'] = now()->toIso8601String();
                if ($match['gmp_percent'] !== null) {
                    $raw['gmp_percent'] = $match['gmp_percent'];
                }
                $raw['gmp_raw'] = $match['raw_gmp'];
                $ipo->raw_provider_data = $raw;

                if ($hasChanged || ! isset($ipo->getOriginal()['raw_provider_data']['gmp_scraped_at'])) {
                    $ipo->save();
                    $updatedCount++;

                    AuditLog::create([
                        'user_id' => auth()->id(),
                        'action' => 'gmp_auto_synced',
                        'entity_type' => Ipo::class,
                        'entity_id' => $ipo->id,
                        'details' => [
                            'source' => 'investorgain',
                            'previous_gmp' => $previousGmp,
                            'new_gmp' => $ipo->gmp,
                            'subscription' => $ipo->total_subscription,
                            'matched_name' => $match['name'],
                        ],
                    ]);
                }

                $matches[] = [
                    'ipo_id' => $ipo->id,
                    'company_name' => $ipo->company_name,
                    'matched_with' => $match['name'],
                    'gmp' => $ipo->gmp,
                    'subscription' => $ipo->total_subscription,
                    'changed' => $hasChanged,
                ];
            }
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        // Record SyncLog
        SyncLog::create([
            'provider' => 'investorgain_gmp',
            'status' => 'success',
            'ipos_created' => 0,
            'ipos_updated' => $updatedCount,
            'execution_time_ms' => $durationMs,
            'triggered_by' => auth()->id(),
            'payload_summary' => [
                'total_scraped' => count($scrapedItems),
                'matched' => $matchedCount,
                'updated' => $updatedCount,
            ],
        ]);

        AppSetting::set('last_gmp_scrape_at', now()->toIso8601String());
        AppSetting::set('last_gmp_scrape_stats', json_encode([
            'total_scraped' => count($scrapedItems),
            'matched' => $matchedCount,
            'updated' => $updatedCount,
            'duration_ms' => $durationMs,
        ]));

        return [
            'success' => true,
            'message' => "InvestorGain GMP scrape complete: {$matchedCount} matched, {$updatedCount} updated.",
            'total_scraped' => count($scrapedItems),
            'matched_count' => $matchedCount,
            'updated_count' => $updatedCount,
            'duration_ms' => $durationMs,
            'matches' => $matches,
        ];
    }

    /**
     * Find best match for a given IPO from scraped items.
     *
     * @param array<int, array<string, mixed>> $scrapedItems
     * @return array<string, mixed>|null
     */
    public function findBestMatch(Ipo $ipo, array $scrapedItems): ?array
    {
        $cleanDbName = $this->normalizeName($ipo->company_name);
        $cleanSymbol = $this->normalizeName($ipo->symbol ?? '');

        // Pass 1: Exact match on normalized company name
        foreach ($scrapedItems as $item) {
            if ($item['clean_name'] === $cleanDbName) {
                return $item;
            }
        }

        // Pass 2: Substring containment (if long enough)
        foreach ($scrapedItems as $item) {
            $len = min(strlen($item['clean_name']), strlen($cleanDbName));
            if ($len >= 6) {
                if (str_contains($cleanDbName, $item['clean_name']) || str_contains($item['clean_name'], $cleanDbName)) {
                    return $item;
                }
            }
        }

        // Pass 3: Fuzzy similarity score (over 80%)
        $bestMatch = null;
        $highestPercent = 0;

        foreach ($scrapedItems as $item) {
            similar_text($cleanDbName, $item['clean_name'], $percent);
            if ($percent > 80 && $percent > $highestPercent) {
                $highestPercent = $percent;
                $bestMatch = $item;
            }
        }

        return $bestMatch;
    }

    /**
     * Normalize company name for resilient string matching.
     */
    public function normalizeName(string $name): string
    {
        $name = preg_replace('/\b(ipo|limited|ltd|pvt|private|technologies|solutions|industries|india)\b/i', '', $name);
        $name = preg_replace('/[^a-z0-9]/i', '', strtolower($name));
        return trim($name);
    }
}
