<?php

namespace App\Services\Providers;

use App\Contracts\IpoProviderInterface;
use App\Models\AppSetting;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class IpoAlertsProvider implements IpoProviderInterface
{
    protected ?string $apiKey;

    protected string $baseUrl;

    public function __construct(?string $apiKey = null)
    {
        $this->apiKey = $apiKey ?: (AppSetting::get('ipoalerts_api_key') ?: config('services.ipoalerts.api_key', env('IPO_ALERTS_API_KEY')));
        $this->baseUrl = config('services.ipoalerts.base_url', 'https://api.ipoalerts.in/v1');
    }

    public function getName(): string
    {
        return 'ipoalerts';
    }

    public function fetchIpos(): array
    {
        if (empty($this->apiKey)) {
            throw new RuntimeException('IPO Alerts API key is not configured. Set IPO_ALERTS_API_KEY in your .env file or application settings.');
        }

        $response = Http::timeout(15)
            ->withHeaders([
                'X-API-KEY' => $this->apiKey,
                'Accept' => 'application/json',
            ])
            ->get("{$this->baseUrl}/ipos");

        if (! $response->successful()) {
            throw new RuntimeException("IPO Alerts API responded with status {$response->status()}: ".$response->body());
        }

        $data = $response->json();
        $rawList = $data['data'] ?? (is_array($data) ? $data : []);

        $normalized = [];
        foreach ($rawList as $item) {
            $normalized[] = [
                'provider_id' => (string) ($item['id'] ?? $item['symbol'] ?? uniqid('ipoalerts_')),
                'company_name' => $item['name'] ?? $item['company_name'] ?? 'Unknown Company',
                'symbol' => $item['symbol'] ?? null,
                'exchange' => $item['exchange'] ?? 'NSE/BSE',
                'ipo_type' => strtolower($item['type'] ?? 'mainboard') === 'sme' ? 'sme' : 'mainboard',
                'category' => $item['category'] ?? null,
                'open_date' => $item['open_date'] ?? $item['bidding_start_date'] ?? null,
                'close_date' => $item['close_date'] ?? $item['bidding_end_date'] ?? null,
                'allotment_date' => $item['allotment_date'] ?? null,
                'listing_date' => $item['listing_date'] ?? null,
                'price_band_min' => isset($item['min_price']) ? (float) $item['min_price'] : null,
                'price_band_max' => isset($item['max_price']) ? (float) $item['max_price'] : null,
                'issue_price' => isset($item['issue_price']) ? (float) $item['issue_price'] : null,
                'lot_size' => (int) ($item['lot_size'] ?? 1),
                'min_retail_qty' => isset($item['min_retail_qty']) ? (int) $item['min_retail_qty'] : null,
                'issue_size' => isset($item['issue_size']) ? (float) $item['issue_size'] : null,
                'gmp' => isset($item['gmp']) ? (float) $item['gmp'] : null,
                'status' => $this->normalizeStatus($item['status'] ?? null, $item['open_date'] ?? null, $item['close_date'] ?? null),
            ];
        }

        return $normalized;
    }

    protected function normalizeStatus(?string $status, ?string $openDate, ?string $closeDate): string
    {
        if ($status) {
            $status = strtolower($status);
            if (in_array($status, ['upcoming', 'open', 'closed', 'allotted', 'listed'])) {
                return $status;
            }
        }

        $now = now()->format('Y-m-d');
        if ($closeDate && $closeDate < $now) {
            return 'closed';
        }
        if ($openDate && $openDate <= $now && (! $closeDate || $closeDate >= $now)) {
            return 'open';
        }

        return 'upcoming';
    }
}
