<?php

namespace App\Services\Providers;

use App\Contracts\IpoProviderInterface;
use App\Services\GmpScraperService;

class InvestorGainProvider implements IpoProviderInterface
{
    protected GmpScraperService $scraper;

    public function __construct(?GmpScraperService $scraper = null)
    {
        $this->scraper = $scraper ?: new GmpScraperService();
    }

    public function getName(): string
    {
        return 'investorgain';
    }

    /**
     * Fetch all IPOs directly from InvestorGain live scraper.
     */
    public function fetchIpos(): array
    {
        $items = $this->scraper->scrapeInvestorGain();

        $normalized = [];
        foreach ($items as $item) {
            $id = strtolower(preg_replace('/[^a-zA-Z0-9]+/', '-', $item['name']));
            $symbol = strtoupper(substr(preg_replace('/[^a-zA-Z0-9]/', '', $item['name']), 0, 10));

            $normalized[] = [
                'provider_id' => $id,
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
                'min_retail_qty' => $item['lot'] ?: 1,
                'issue_size' => $item['issue_size'],
                'gmp' => $item['gmp'],
                'status' => $item['status'],
                'total_subscription' => $item['subscription'] ? (string) $item['subscription'] : null,
                'raw_provider_data' => [
                    'total_subscription' => $item['subscription'] ? (string) $item['subscription'] : null,
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
            ];
        }

        return $normalized;
    }
}
