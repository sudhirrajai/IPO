<?php

namespace App\Services\Providers;

use App\Contracts\IpoProviderInterface;

class MockIpoProvider implements IpoProviderInterface
{
    public function getName(): string
    {
        return 'mock';
    }

    public function fetchIpos(): array
    {
        return [
            [
                'provider_id' => 'MOCK-SWIGGY',
                'company_name' => 'Swiggy Limited',
                'symbol' => 'SWIGGY',
                'exchange' => 'NSE/BSE',
                'ipo_type' => 'mainboard',
                'category' => 'Technology',
                'open_date' => now()->subDays(2)->format('Y-m-d'),
                'close_date' => now()->addDays(1)->format('Y-m-d'),
                'allotment_date' => now()->addDays(3)->format('Y-m-d'),
                'listing_date' => now()->addDays(6)->format('Y-m-d'),
                'price_band_min' => 371.00,
                'price_band_max' => 390.00,
                'issue_price' => 390.00,
                'lot_size' => 38,
                'min_retail_qty' => 38,
                'issue_size' => 11327.00,
                'gmp' => 25.00,
                'status' => 'open',
            ],
            [
                'provider_id' => 'MOCK-NTPCGREEN',
                'company_name' => 'NTPC Green Energy Limited',
                'symbol' => 'NTPCGREEN',
                'exchange' => 'NSE/BSE',
                'ipo_type' => 'mainboard',
                'category' => 'Renewable Energy',
                'open_date' => now()->addDays(4)->format('Y-m-d'),
                'close_date' => now()->addDays(7)->format('Y-m-d'),
                'allotment_date' => now()->addDays(9)->format('Y-m-d'),
                'listing_date' => now()->addDays(12)->format('Y-m-d'),
                'price_band_min' => 102.00,
                'price_band_max' => 108.00,
                'issue_price' => 108.00,
                'lot_size' => 138,
                'min_retail_qty' => 138,
                'issue_size' => 10000.00,
                'gmp' => 18.00,
                'status' => 'upcoming',
            ],
            [
                'provider_id' => 'MOCK-WAAREE',
                'company_name' => 'Waaree Energies Limited',
                'symbol' => 'WAAREE',
                'exchange' => 'NSE/BSE',
                'ipo_type' => 'mainboard',
                'category' => 'Solar Manufacturing',
                'open_date' => now()->subDays(10)->format('Y-m-d'),
                'close_date' => now()->subDays(7)->format('Y-m-d'),
                'allotment_date' => now()->subDays(5)->format('Y-m-d'),
                'listing_date' => now()->subDays(2)->format('Y-m-d'),
                'price_band_min' => 1427.00,
                'price_band_max' => 1503.00,
                'issue_price' => 1503.00,
                'lot_size' => 9,
                'min_retail_qty' => 9,
                'issue_size' => 4321.00,
                'gmp' => 1350.00,
                'status' => 'closed',
            ],
            [
                'provider_id' => 'MOCK-ENVIRO',
                'company_name' => 'Enviro Infra Engineers Limited',
                'symbol' => 'EIEL',
                'exchange' => 'NSE/BSE',
                'ipo_type' => 'mainboard',
                'category' => 'Infrastructure',
                'open_date' => now()->subDays(1)->format('Y-m-d'),
                'close_date' => now()->addDays(2)->format('Y-m-d'),
                'allotment_date' => now()->addDays(4)->format('Y-m-d'),
                'listing_date' => now()->addDays(7)->format('Y-m-d'),
                'price_band_min' => 140.00,
                'price_band_max' => 148.00,
                'issue_price' => 148.00,
                'lot_size' => 101,
                'min_retail_qty' => 101,
                'issue_size' => 650.43,
                'gmp' => 42.00,
                'status' => 'open',
            ],
            [
                'provider_id' => 'MOCK-TECHSME',
                'company_name' => 'Apex Tech Solutions SME',
                'symbol' => 'APEXTECH',
                'exchange' => 'NSE SME',
                'ipo_type' => 'sme',
                'category' => 'IT Services',
                'open_date' => now()->addDays(2)->format('Y-m-d'),
                'close_date' => now()->addDays(5)->format('Y-m-d'),
                'allotment_date' => now()->addDays(7)->format('Y-m-d'),
                'listing_date' => now()->addDays(10)->format('Y-m-d'),
                'price_band_min' => 85.00,
                'price_band_max' => 90.00,
                'issue_price' => 90.00,
                'lot_size' => 1600,
                'min_retail_qty' => 1600,
                'issue_size' => 38.50,
                'gmp' => 35.00,
                'status' => 'upcoming',
            ],
        ];
    }
}
