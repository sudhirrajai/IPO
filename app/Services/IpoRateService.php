<?php

namespace App\Services;

use App\Models\Ipo;
use App\Models\IpoRate;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class IpoRateService
{
    /**
     * Set a new active rate configuration for an IPO.
     */
    public static function setRate(
        Ipo $ipo,
        float $traderRate,
        float $publishedRate,
        ?string $note = null,
        bool $allowNegativeMargin = false
    ): IpoRate {
        $margin = FinancialCalculationService::calculateMargin($traderRate, $publishedRate);

        if ($margin < 0 && ! $allowNegativeMargin) {
            throw new InvalidArgumentException(
                "Published rate (₹{$publishedRate}) cannot exceed Trader rate (₹{$traderRate}) without explicit confirmation."
            );
        }

        return DB::transaction(function () use ($ipo, $traderRate, $publishedRate, $margin, $note) {
            $previousActiveRate = $ipo->activeRate;

            // Deactivate previous rates
            IpoRate::where('ipo_id', $ipo->id)
                ->where('is_active', true)
                ->update(['is_active' => false]);

            $newRate = IpoRate::create([
                'ipo_id' => $ipo->id,
                'trader_rate' => $traderRate,
                'published_rate' => $publishedRate,
                'margin' => $margin,
                'effective_from' => now(),
                'is_active' => true,
                'note' => $note,
                'created_by_user_id' => Auth::id(),
            ]);

            AuditService::log(
                'rate_changed',
                $newRate,
                $previousActiveRate ? [
                    'trader_rate' => $previousActiveRate->trader_rate,
                    'published_rate' => $previousActiveRate->published_rate,
                    'margin' => $previousActiveRate->margin,
                ] : null,
                [
                    'trader_rate' => $traderRate,
                    'published_rate' => $publishedRate,
                    'margin' => $margin,
                    'note' => $note,
                ],
                "Updated rate for IPO {$ipo->company_name}: Trader ₹{$traderRate}, User ₹{$publishedRate}, Margin ₹{$margin}"
            );

            return $newRate;
        });
    }
}
