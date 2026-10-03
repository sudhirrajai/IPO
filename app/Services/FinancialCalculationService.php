<?php

namespace App\Services;

class FinancialCalculationService
{
    /**
     * Calculate rate margin per application.
     */
    public static function calculateMargin(float|int $traderRate, float|int $publishedRate): float
    {
        return round((float) $traderRate - (float) $publishedRate, 2);
    }

    /**
     * Calculate configured total batch margin.
     */
    public static function calculateBatchMargin(float|int $traderRate, float|int $publishedRate, int $count): float
    {
        $marginPerApp = self::calculateMargin($traderRate, $publishedRate);

        return round($marginPerApp * $count, 2);
    }

    /**
     * Calculate financial summary for an application batch based on funding source and inputs.
     *
     * @param  string  $fundingSource  'my_money' or 'user_money'
     * @param  int  $count  Number of applications
     * @param  float  $traderRate  Trader rate per application
     * @param  float  $publishedRate  Published user rate per application
     * @param  float  $capitalPerApp  Capital required per application (e.g. lot_size * issue_price)
     * @param  float|null  $expectedGrossProfit  Estimated gross profit (if explicitly set)
     * @param  float|null  $fixedUserPayout  User payout (if explicitly set; defaults to published_rate * count)
     */
    public static function computeBatchEstimates(
        string $fundingSource,
        int $count,
        float $traderRate,
        float $publishedRate,
        float $capitalPerApp = 0.0,
        ?float $expectedGrossProfit = null,
        ?float $fixedUserPayout = null
    ): array {
        $count = max(1, $count);
        $marginPerApp = self::calculateMargin($traderRate, $publishedRate);
        $totalMargin = round($marginPerApp * $count, 2);
        $totalCapital = round($capitalPerApp * $count, 2);

        // User payout default is published_rate * application_count
        $userPayout = $fixedUserPayout ?? round($publishedRate * $count, 2);

        if ($fundingSource === 'my_money') {
            // Funded by Admin
            // Gross proceeds from trader = trader_rate * count
            $grossProfit = $expectedGrossProfit ?? round($traderRate * $count, 2);
            // Net admin earnings = gross profit - user payout
            $netEarnings = round($grossProfit - $userPayout, 2);

            return [
                'funding_source' => 'my_money',
                'application_count' => $count,
                'trader_rate' => $traderRate,
                'published_rate' => $publishedRate,
                'margin_per_app' => $marginPerApp,
                'margin_total' => $totalMargin,
                'capital_per_app' => $capitalPerApp,
                'capital_amount' => $totalCapital, // Capital deployed by admin
                'expected_gross_profit' => $grossProfit,
                'expected_user_payout' => $userPayout,
                'expected_net_earnings' => $netEarnings,
            ];
        }

        // Funded by User ('user_money')
        // Capital is provided by the user
        $grossProfit = $expectedGrossProfit ?? round($traderRate * $count, 2);
        // Admin's net earnings is the margin between trader rate and published payout
        $netEarnings = $totalMargin;

        return [
            'funding_source' => 'user_money',
            'application_count' => $count,
            'trader_rate' => $traderRate,
            'published_rate' => $publishedRate,
            'margin_per_app' => $marginPerApp,
            'margin_total' => $totalMargin,
            'capital_per_app' => $capitalPerApp,
            'capital_amount' => $totalCapital, // Capital provided by user
            'expected_gross_profit' => $grossProfit,
            'expected_user_payout' => $userPayout,
            'expected_net_earnings' => $netEarnings,
        ];
    }
}
