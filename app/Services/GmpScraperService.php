<?php

namespace App\Services;

use App\Models\AppSetting;
use App\Models\ApplicationBatch;
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
            if ($tds->length < 8) {
                continue;
            }

            // 1. Company Name & Type
            $nameCell = $tds->item(0);
            $aTag = $xpath->query('.//a', $nameCell)->item(0);
            $companyName = $aTag ? trim($aTag->textContent) : trim($nameCell->textContent);

            if (empty($companyName)) {
                continue;
            }

            // Clean common suffix tags from scraped name
            $cleanName = preg_replace('/\s+IPOU\s*$/i', '', $companyName);
            $cleanName = preg_replace('/\s+IPO\s+U\s*$/i', '', $cleanName);
            $cleanName = preg_replace('/\s*\(SME\)\s*$/i', '', $cleanName);
            $cleanName = trim($cleanName);

            $cellHtml = $dom->saveHTML($nameCell);
            $isSme = (stripos($cellHtml, 'SME') !== false || stripos($companyName, 'SME') !== false);
            $ipoType = $isSme ? 'sme' : 'mainboard';

            // 2. GMP & Range
            $gmpCell = $tds->item(1);
            $gmpText = trim($gmpCell->textContent);
            $gmp = null;
            $gmpPercent = null;
            $minGmp = null;
            $maxGmp = null;

            if (preg_match('/(?:₹|&#8377;|â‚¹|\x{20B9}|Rs\.?)?\s*([0-9\.\-]+)\s*\(([\-0-9\.]*)%\)/u', $gmpText, $m)) {
                if ($m[1] !== '--' && is_numeric($m[1])) {
                    $gmp = (float) $m[1];
                }
                if (is_numeric($m[2])) {
                    $gmpPercent = (float) $m[2];
                }
            }

            if (preg_match('/([0-9\.]+)\s*(?:↓|&darr;)\s*\/\s*([0-9\.]+)\s*(?:↑|&uarr;)/u', $gmpText, $rm)) {
                $minGmp = (float) $rm[1];
                $maxGmp = (float) $rm[2];
            }

            // 3. Rating (Count of fire emojis)
            $ratingCell = $tds->item(2);
            $fireCount = substr_count($ratingCell->textContent, '🔥');

            // 4. Subscription
            $subCell = $tds->item(3);
            $subText = trim($subCell->textContent);
            $subscription = null;
            if (preg_match('/([0-9\.]+)x/i', $subText, $sm)) {
                $subscription = (float) $sm[1];
            }

            // 5. Price & Lot Size
            $priceText = trim($tds->item(4)->textContent);
            $price = is_numeric($priceText) ? (float) $priceText : 0.0;

            $sizeText = trim($tds->item(5)->textContent);
            $issueSize = ($sizeText !== '-' && ! empty($sizeText)) ? $sizeText : null;

            $lotText = $tds->length > 6 ? str_replace(',', '', trim($tds->item(6)->textContent)) : null;
            $lot = (is_numeric($lotText) && (int) $lotText > 0) ? (int) $lotText : 1;

            // 6. Dates (Open, Close, BoA/Allotment, Listing)
            $openDate = $tds->length > 7 ? $this->parseInvestorGainDate($tds->item(7)->textContent) : null;
            $closeDate = $tds->length > 8 ? $this->parseInvestorGainDate($tds->item(8)->textContent) : null;
            $boaDate = $tds->length > 9 ? $this->parseInvestorGainDate($tds->item(9)->textContent) : null;
            $listingDate = $tds->length > 10 ? $this->parseInvestorGainDate($tds->item(10)->textContent) : null;
            $updatedOn = $tds->length > 11 ? trim($tds->item(11)->textContent) : null;

            // 7. Status determination
            $today = now()->toDateString();
            $status = 'upcoming';
            if ($closeDate && $closeDate < $today) {
                $status = 'closed';
            } elseif ($openDate && $openDate <= $today && (! $closeDate || $closeDate >= $today)) {
                $status = 'open';
            }

            $retailGain = ($gmp !== null && $lot > 0) ? round($gmp * $lot, 2) : 0.0;
            $hniGain = round($retailGain * 14, 2);

            $results[] = [
                'name' => $cleanName,
                'raw_name' => $companyName,
                'clean_name' => $this->normalizeName($cleanName),
                'ipo_type' => $ipoType,
                'gmp' => $gmp,
                'gmp_percent' => $gmpPercent,
                'min_gmp' => $minGmp,
                'max_gmp' => $maxGmp,
                'rating' => $fireCount,
                'subscription' => $subscription,
                'price' => $price,
                'issue_size' => $issueSize,
                'lot' => $lot,
                'open_date' => $openDate,
                'close_date' => $closeDate,
                'boa_date' => $boaDate,
                'listing_date' => $listingDate,
                'status' => $status,
                'retail_gain' => $retailGain,
                'hni_gain' => $hniGain,
                'raw_gmp' => $gmpText,
                'updated_on' => $updatedOn,
            ];
        }

        return $results;
    }

    /**
     * Parse date string formatted like "13-Oct" or "13-Oct-2026"
     */
    public function parseInvestorGainDate(?string $str): ?string
    {
        if (empty($str) || $str === '-' || trim($str) === '') {
            return null;
        }

        $str = trim($str);
        if (preg_match('/^(\d{1,2})-([A-Za-z]{3})(?:-(\d{2,4}))?$/', $str, $m)) {
            $day = str_pad($m[1], 2, '0', STR_PAD_LEFT);
            $month = date('m', strtotime($m[2].' 1 2026'));
            $year = ! empty($m[3]) ? (strlen($m[3]) === 2 ? '20'.$m[3] : $m[3]) : '2026';

            return "{$year}-{$month}-{$day}";
        }

        return null;
    }

    /**
     * Sync scraped GMP data into local database IPOs and ingest missing IPOs.
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
                'created_count' => 0,
                'updated_count' => 0,
                'duration_ms' => 0,
                'matches' => [],
            ];
        }

        $ipos = Ipo::all();
        $matchedCount = 0;
        $updatedCount = 0;
        $createdCount = 0;
        $matches = [];
        $matchedScrapedNames = [];

        foreach ($ipos as $ipo) {
            $match = $this->findBestMatch($ipo, $scrapedItems);

            if ($match) {
                $matchedCount++;
                $matchedScrapedNames[] = $match['name'];
                $hasChanged = false;
                $previousGmp = $ipo->gmp;

                // Update GMP if scraped value is provided
                if ($match['gmp'] !== null) {
                    $newGmp = (float) $match['gmp'];
                    if ((float) $ipo->gmp !== $newGmp) {
                        $ipo->gmp = $newGmp;
                        $hasChanged = true;
                        self::recalculatePercentageBatchesForIpo($ipo, $newGmp);
                    }
                }

                // Update lot_size if not set or 1
                if (($ipo->lot_size <= 1 || empty($ipo->lot_size)) && ! empty($match['lot']) && $match['lot'] > 1) {
                    $ipo->lot_size = (int) $match['lot'];
                    $hasChanged = true;
                }

                // Update price / issue_price if empty
                if ((empty($ipo->issue_price) || (float) $ipo->issue_price == 0) && ! empty($match['price']) && $match['price'] > 0) {
                    $ipo->issue_price = (float) $match['price'];
                    $ipo->price_band_max = (float) $match['price'];
                    $hasChanged = true;
                }

                // Update dates if missing
                if (empty($ipo->open_date) && ! empty($match['open_date'])) {
                    $ipo->open_date = $match['open_date'];
                    $hasChanged = true;
                }
                if (empty($ipo->close_date) && ! empty($match['close_date'])) {
                    $ipo->close_date = $match['close_date'];
                    $hasChanged = true;
                }
                if (empty($ipo->allotment_date) && ! empty($match['boa_date'])) {
                    $ipo->allotment_date = $match['boa_date'];
                    $hasChanged = true;
                }
                if (empty($ipo->listing_date) && ! empty($match['listing_date'])) {
                    $ipo->listing_date = $match['listing_date'];
                    $hasChanged = true;
                }
                if (empty($ipo->issue_size) && ! empty($match['issue_size'])) {
                    if (preg_match('/([0-9\.]+)/', str_replace(',', '', $match['issue_size']), $sm)) {
                        $ipo->issue_size = (float) $sm[1];
                        $hasChanged = true;
                    }
                }

                // Update status if date-based status is clearer and not manually closed
                if (! empty($match['status']) && $ipo->status !== $match['status'] && ! in_array($ipo->status, ['closed', 'allotted', 'listed'])) {
                    $ipo->status = $match['status'];
                    $hasChanged = true;
                }

                // Update raw_provider_data payload
                $raw = is_array($ipo->raw_provider_data) ? $ipo->raw_provider_data : [];
                if ($match['subscription'] !== null && $match['subscription'] > 0) {
                    $raw['total_subscription'] = (string) $match['subscription'];
                }
                $raw['gmp_source'] = 'investorgain';
                $raw['gmp_scraped_at'] = now()->toIso8601String();
                $raw['gmp_percent'] = $match['gmp_percent'];
                $raw['gmp_rating'] = $match['rating'] ?? 0;
                $raw['gmp_updated_on'] = $match['updated_on'];
                $raw['gmp_raw'] = $match['raw_gmp'];
                $raw['min_gmp'] = $match['min_gmp'];
                $raw['max_gmp'] = $match['max_gmp'];
                $raw['retail_gain'] = $match['retail_gain'];
                $raw['hni_gain'] = $match['hni_gain'];
                $ipo->raw_provider_data = $raw;

                $ipo->save();
                $updatedCount++;

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

        // Ingest missing IPOs directly from InvestorGain
        foreach ($scrapedItems as $item) {
            if (in_array($item['name'], $matchedScrapedNames, true)) {
                continue;
            }

            $cleanItemName = $this->normalizeName($item['name']);
            $symbol = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $item['name']), 0, 10));

            // Prevent duplicate creation if company name or symbol is already present
            $alreadyExists = Ipo::whereRaw('LOWER(company_name) = ?', [strtolower(trim($item['name']))])
                ->orWhere('symbol', $symbol)
                ->first();

            if (! $alreadyExists) {
                foreach (Ipo::all() as $existingIpo) {
                    if ($this->normalizeName($existingIpo->company_name) === $cleanItemName) {
                        $alreadyExists = $existingIpo;
                        break;
                    }
                }
            }

            if ($alreadyExists) {
                if ($item['gmp'] !== null && (float) $alreadyExists->gmp !== (float) $item['gmp']) {
                    $alreadyExists->gmp = (float) $item['gmp'];
                    $alreadyExists->save();
                    self::recalculatePercentageBatchesForIpo($alreadyExists, (float) $item['gmp']);
                }
                continue;
            }

            $numericIssueSize = null;
            if (! empty($item['issue_size'])) {
                if (preg_match('/([0-9\.]+)/', str_replace(',', '', $item['issue_size']), $sm)) {
                    $numericIssueSize = (float) $sm[1];
                }
            }

            $createdIpo = Ipo::create([
                'company_name' => $item['name'],
                'symbol' => $symbol,
                'exchange' => 'NSE/BSE',
                'ipo_type' => $item['ipo_type'],
                'category' => $item['ipo_type'] === 'sme' ? 'SME' : 'Mainboard',
                'open_date' => $item['open_date'],
                'close_date' => $item['close_date'],
                'allotment_date' => $item['boa_date'],
                'listing_date' => $item['listing_date'],
                'price_band_min' => $item['price'] > 0 ? $item['price'] : null,
                'price_band_max' => $item['price'] > 0 ? $item['price'] : null,
                'issue_price' => $item['price'] > 0 ? $item['price'] : null,
                'lot_size' => $item['lot'] ?: 1,
                'issue_size' => $numericIssueSize,
                'gmp' => $item['gmp'],
                'status' => $item['status'],
                'provider' => 'investorgain',
                'provider_id' => strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $item['name'])),
                'raw_provider_data' => [
                    'total_subscription' => $item['subscription'] ? (string) $item['subscription'] : null,
                    'issue_size_text' => $item['issue_size'],
                    'gmp_percent' => $item['gmp_percent'],
                    'gmp_rating' => $item['rating'] ?? 0,
                    'gmp_updated_on' => $item['updated_on'],
                    'gmp_raw' => $item['raw_gmp'],
                    'min_gmp' => $item['min_gmp'],
                    'max_gmp' => $item['max_gmp'],
                    'retail_gain' => $item['retail_gain'],
                    'hni_gain' => $item['hni_gain'],
                    'gmp_source' => 'investorgain',
                    'gmp_scraped_at' => now()->toIso8601String(),
                ],
                'accept_fix_applications' => true,
                'auto_approve_fix' => true,
                'last_synced_at' => now(),
            ]);

            $createdCount++;
            $matches[] = [
                'ipo_id' => $createdIpo->id,
                'company_name' => $createdIpo->company_name,
                'matched_with' => $item['name'],
                'gmp' => $createdIpo->gmp,
                'subscription' => null,
                'changed' => true,
            ];
        }

        $durationMs = (int) round((microtime(true) - $startTime) * 1000);

        // Record SyncLog
        SyncLog::create([
            'provider' => 'investorgain_gmp',
            'status' => 'success',
            'ipos_created' => $createdCount,
            'ipos_updated' => $updatedCount,
            'execution_time_ms' => $durationMs,
            'triggered_by_user_id' => auth()->id(),
            'payload_summary' => [
                'total_scraped' => count($scrapedItems),
                'matched' => $matchedCount,
                'created' => $createdCount,
                'updated' => $updatedCount,
            ],
        ]);

        AppSetting::set('last_gmp_scrape_at', now()->toIso8601String());
        AppSetting::set('last_gmp_scrape_stats', json_encode([
            'total_scraped' => count($scrapedItems),
            'matched' => $matchedCount,
            'created' => $createdCount,
            'updated' => $updatedCount,
            'duration_ms' => $durationMs,
        ]));

        return [
            'success' => true,
            'message' => "InvestorGain Live Scrape complete: {$createdCount} new created, {$updatedCount} updated ({$matchedCount} matched).",
            'total_scraped' => count($scrapedItems),
            'matched_count' => $matchedCount,
            'created_count' => $createdCount,
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

        // Pass 0: Known market aliases
        $knownAliases = [
            'reliance jio' => ['jioplatforms', 'jio', 'reliancejio'],
            'jio' => ['jioplatforms', 'reliancejio'],
            'jioplatforms' => ['reliancejio', 'jio'],
            'acevector' => ['snapdeal', 'acevectorsnapdeal'],
            'snapdeal' => ['acevector', 'acevectorsnapdeal'],
            'boat' => ['boatlifestyle', 'imaginemarketing'],
        ];

        foreach ($knownAliases as $root => $variants) {
            $isDbMatched = str_contains($cleanDbName, $root) || in_array($cleanDbName, $variants);
            if ($isDbMatched) {
                foreach ($scrapedItems as $item) {
                    if (str_contains($item['clean_name'], $root) || in_array($item['clean_name'], $variants)) {
                        return $item;
                    }
                }
            }
        }

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
     * Recalculate all open percentage profit-sharing application batches for an IPO when GMP changes.
     */
    public static function recalculatePercentageBatchesForIpo(Ipo $ipo, float $newGmp): int
    {
        $batches = ApplicationBatch::where('ipo_id', $ipo->id)
            ->where('profit_sharing_type', 'percentage')
            ->where('settlement_status', '!=', 'settled')
            ->get();

        $updatedCount = 0;
        foreach ($batches as $batch) {
            $lotSize = (int) ($ipo->lot_size ?? 1);
            $count = (int) ($batch->application_count ?? 1);
            $expectedListingGain = round($lotSize * $newGmp * $count, 2);
            $userPayout = round(((float) $batch->profit_sharing_value / 100) * $expectedListingGain, 2);
            $netEarnings = round($expectedListingGain - $userPayout, 2);

            $batch->update([
                'gmp_snapshot' => $newGmp,
                'expected_gross_profit' => $expectedListingGain,
                'expected_user_payout' => $userPayout,
                'expected_net_earnings' => $netEarnings,
            ]);
            $updatedCount++;
        }

        return $updatedCount;
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
