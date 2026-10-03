<?php

namespace App\Services\Providers;

use App\Contracts\IpoProviderInterface;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class UpstoxProvider implements IpoProviderInterface
{
    protected ?string $apiKey;

    protected ?string $accessToken;

    protected string $baseUrl;

    public function __construct(?string $apiKey = null, ?string $accessToken = null)
    {
        $this->apiKey = $apiKey ?: (AppSetting::get('upstox_api_key') ?: config('services.upstox.api_key', env('UPSTOX_API_KEY')));
        $this->accessToken = $accessToken ?: (AppSetting::get('upstox_access_token') ?: config('services.upstox.access_token', env('UPSTOX_ACCESS_TOKEN')));
        $this->baseUrl = config('services.upstox.base_url', 'https://api.upstox.com/v2');
    }

    public function getName(): string
    {
        return 'upstox';
    }

    public function fetchIpos(): array
    {
        if (empty($this->apiKey) && empty($this->accessToken)) {
            throw new RuntimeException('Upstox API credentials not configured. Set UPSTOX_API_KEY and UPSTOX_ACCESS_TOKEN in your environment or settings.');
        }

        $headers = [
            'Accept' => 'application/json',
        ];

        if ($this->accessToken) {
            $headers['Authorization'] = 'Bearer '.$this->accessToken;
        }

        // Fetch open, upcoming, and closed IPOs in parallel
        $listResponses = Http::pool(fn (\Illuminate\Http\Client\Pool $pool) => [
            $pool->as('open')->withHeaders($headers)->timeout(12)->get("{$this->baseUrl}/ipos", ['status' => 'open']),
            $pool->as('upcoming')->withHeaders($headers)->timeout(12)->get("{$this->baseUrl}/ipos", ['status' => 'upcoming']),
            $pool->as('closed')->withHeaders($headers)->timeout(12)->get("{$this->baseUrl}/ipos", ['status' => 'closed']),
        ]);

        $rawList = [];
        $seenIds = [];
        foreach (['open', 'upcoming', 'closed'] as $cat) {
            $resp = $listResponses[$cat] ?? null;
            if ($resp instanceof \Illuminate\Http\Client\Response && $resp->successful()) {
                $items = $resp->json('data') ?? [];
                foreach ($items as $item) {
                    $id = $item['id'] ?? null;
                    if ($id && ! isset($seenIds[$id])) {
                        $seenIds[$id] = true;
                        $rawList[] = $item;
                    }
                }
            }
        }

        if (empty($rawList)) {
            // Fallback to base endpoint if query params fail
            $response = Http::timeout(15)->withHeaders($headers)->get("{$this->baseUrl}/ipos");
            if ($response->successful()) {
                $rawList = $response->json('data') ?? [];
            }
        }

        if (empty($rawList)) {
            return [];
        }

        // Fetch detailed info for each IPO in parallel using Http::pool for lot_size, timelines, registrar, drhp, etc.
        $detailMap = [];
        try {
            $poolResponses = Http::pool(fn (\Illuminate\Http\Client\Pool $pool) =>
                collect($rawList)->map(function ($item) use ($pool, $headers) {
                    $id = $item['id'] ?? null;
                    if ($id) {
                        return $pool->as($id)
                            ->withHeaders($headers)
                            ->timeout(8)
                            ->get("{$this->baseUrl}/ipos/{$id}");
                    }
                    return null;
                })->filter()
            );

            foreach ($poolResponses as $id => $res) {
                if ($res instanceof \Illuminate\Http\Client\Response && $res->successful()) {
                    $detailMap[$id] = $res->json('data') ?? [];
                }
            }
        } catch (\Throwable $e) {
            // Log or ignore pool exception and fall back to list data
        }

        $normalized = [];
        foreach ($rawList as $item) {
            $id = (string) ($item['id'] ?? $item['symbol'] ?? uniqid('upstox_'));
            $detail = $detailMap[$id] ?? [];

            $timeline = $detail['timeline'] ?? [];
            $lotSize = (int) ($detail['lot_size'] ?? $item['lot_size'] ?? 1);
            if ($lotSize <= 0) {
                $lotSize = 1;
            }

            $minRetailQty = isset($detail['minimum_quantity']) ? (int) $detail['minimum_quantity'] : (isset($item['min_bid_quantity']) ? (int) $item['min_bid_quantity'] : null);
            $exchange = $detail['listing_exchange'] ?? $item['exchange'] ?? 'NSE';
            $openDate = $item['bidding_start_date'] ?? $detail['bidding_start_date'] ?? null;
            $closeDate = $item['bidding_end_date'] ?? $detail['bidding_end_date'] ?? null;
            $allotmentDate = $timeline['allotment_date'] ?? $timeline['allotment_start_date'] ?? $item['allotment_date'] ?? null;
            $listingDate = $timeline['listing_date'] ?? $item['listing_date'] ?? null;

            $priceMin = isset($item['minimum_price']) ? (float) $item['minimum_price'] : (isset($detail['minimum_price']) ? (float) $detail['minimum_price'] : null);
            $priceMax = isset($item['maximum_price']) ? (float) $item['maximum_price'] : (isset($detail['maximum_price']) ? (float) $detail['maximum_price'] : null);
            $cutOffPrice = isset($detail['cut_off_price']) ? (float) $detail['cut_off_price'] : null;

            $issueType = strtolower($item['issue_type'] ?? $detail['issue_type'] ?? 'mainboard') === 'sme' ? 'sme' : 'mainboard';

            $today = now()->toDateString();
            if ($closeDate && $closeDate < $today) {
                $status = 'closed';
            } elseif ($openDate && $openDate > $today) {
                $status = 'upcoming';
            } elseif ($openDate && $closeDate && $openDate <= $today && $closeDate >= $today) {
                $status = 'open';
            } else {
                $rawStatus = strtolower($item['status'] ?? $detail['status'] ?? 'upcoming');
                $status = in_array($rawStatus, ['closed', 'allotted', 'listed']) ? 'closed' : ($rawStatus === 'open' ? 'open' : 'upcoming');
            }

            $normalized[] = [
                'provider_id' => $id,
                'company_name' => $item['name'] ?? $detail['name'] ?? 'Unknown Company',
                'symbol' => $item['symbol'] ?? $detail['symbol'] ?? null,
                'exchange' => $exchange,
                'ipo_type' => $issueType,
                'category' => $item['industry'] ?? $detail['industry'] ?? null,
                'open_date' => $openDate,
                'close_date' => $closeDate,
                'allotment_date' => $allotmentDate,
                'listing_date' => $listingDate,
                'price_band_min' => $priceMin,
                'price_band_max' => $priceMax,
                'issue_price' => $cutOffPrice ?? $priceMax,
                'lot_size' => $lotSize,
                'min_retail_qty' => $minRetailQty,
                'issue_size' => isset($item['issue_size']) ? (float) $item['issue_size'] : (isset($detail['issue_size']) ? (float) $detail['issue_size'] : null),
                'gmp' => isset($item['gmp']) ? (float) $item['gmp'] : null,
                'status' => $status,
                'isin' => $detail['isin'] ?? $item['isin'] ?? null,
                'face_value' => $detail['face_value'] ?? $item['face_value'] ?? null,
                'cut_off_price' => $cutOffPrice,
                'listing_price' => $detail['listing_price'] ?? null,
                'total_subscription' => $detail['total_subscription'] ?? $item['total_subscription'] ?? null,
                'drhp_url' => $detail['drhp_url'] ?? $item['drhp_url'] ?? null,
                'rhp_url' => $detail['rhp_url'] ?? $item['rhp_url'] ?? null,
                'registrar_info' => $detail['registrar_info'] ?? $item['registrar_info'] ?? null,
                'timeline' => $timeline,
                'daily_start_time' => $detail['daily_start_time'] ?? $item['daily_start_time'] ?? null,
                'daily_end_time' => $detail['daily_end_time'] ?? $item['daily_end_time'] ?? null,
                'investors' => $detail['investors'] ?? [],
            ];
        }

        return $normalized;
    }
}
