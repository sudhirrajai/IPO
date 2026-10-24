<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Ipo extends Model
{
    use HasFactory;

    protected $fillable = [
        'company_name',
        'symbol',
        'exchange',
        'ipo_type',
        'category',
        'open_date',
        'close_date',
        'allotment_date',
        'listing_date',
        'price_band_min',
        'price_band_max',
        'issue_price',
        'lot_size',
        'min_retail_qty',
        'issue_size',
        'gmp',
        'accept_fix_applications',
        'auto_approve_fix',
        'status',
        'provider',
        'provider_id',
        'kfin_client_id',
        'raw_provider_data',
        'last_synced_at',
        'allotment_scraped_at',
    ];

    protected $appends = [
        'total_subscription',
        'face_value',
        'isin',
        'registrar_info',
        'drhp_url',
        'rhp_url',
        'refund_date',
        'mandate_end_date',
        'bidding_hours',
        'gmp_percent',
        'gmp_rating',
        'gmp_updated_on',
        'retail_gain',
        'hni_gain',
        'min_gmp',
        'max_gmp',
    ];

    public function getGmpPercentAttribute(): ?float
    {
        $raw = $this->raw_provider_data ?? [];
        if (isset($raw['gmp_percent']) && is_numeric($raw['gmp_percent'])) {
            return (float) $raw['gmp_percent'];
        }
        $price = (float) ($this->price_band_max ?? $this->issue_price ?? 0);
        $gmp = (float) ($this->gmp ?? 0);
        if ($gmp > 0 && $price > 0) {
            return round(($gmp / $price) * 100, 1);
        }
        return null;
    }

    public function getGmpRatingAttribute(): int
    {
        $raw = $this->raw_provider_data ?? [];
        return isset($raw['gmp_rating']) ? (int) $raw['gmp_rating'] : 0;
    }

    public function getGmpUpdatedOnAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['gmp_updated_on'] ?? null;
    }

    public function getRetailGainAttribute(): ?float
    {
        $raw = $this->raw_provider_data ?? [];
        if (isset($raw['retail_gain']) && is_numeric($raw['retail_gain'])) {
            return (float) $raw['retail_gain'];
        }
        $gmp = (float) ($this->gmp ?? 0);
        $lot = (int) ($this->lot_size ?? 1);
        if ($gmp > 0 && $lot > 0) {
            return round($gmp * $lot, 2);
        }
        return null;
    }

    public function getHniGainAttribute(): ?float
    {
        $raw = $this->raw_provider_data ?? [];
        if (isset($raw['hni_gain']) && is_numeric($raw['hni_gain'])) {
            return (float) $raw['hni_gain'];
        }
        $retail = $this->retail_gain;
        return $retail ? round($retail * 14, 2) : null;
    }

    public function getMinGmpAttribute(): ?float
    {
        $raw = $this->raw_provider_data ?? [];
        return isset($raw['min_gmp']) && is_numeric($raw['min_gmp']) ? (float) $raw['min_gmp'] : null;
    }

    public function getMaxGmpAttribute(): ?float
    {
        $raw = $this->raw_provider_data ?? [];
        return isset($raw['max_gmp']) && is_numeric($raw['max_gmp']) ? (float) $raw['max_gmp'] : null;
    }

    public function getTotalSubscriptionAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return isset($raw['total_subscription']) ? (string) $raw['total_subscription'] : null;
    }

    public function getFaceValueAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        $val = $raw['face_value'] ?? null;
        return $val !== null ? (string) $val : null;
    }

    public function getIsinAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['isin'] ?? null;
    }

    public function getRegistrarInfoAttribute(): ?array
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['registrar_info'] ?? null;
    }

    public function getDrhpUrlAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['drhp_url'] ?? null;
    }

    public function getRhpUrlAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['rhp_url'] ?? null;
    }

    public function getRefundDateAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['timeline']['refund_initiation_date'] ?? null;
    }

    public function getMandateEndDateAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        return $raw['timeline']['mandate_end_date'] ?? null;
    }

    public function getBiddingHoursAttribute(): ?string
    {
        $raw = $this->raw_provider_data ?? [];
        $start = $raw['daily_start_time'] ?? null;
        $end = $raw['daily_end_time'] ?? null;
        if ($start && $end) {
            return "{$start} - {$end}";
        }
        return null;
    }

    protected function casts(): array
    {
        return [
            'open_date' => 'date:Y-m-d',
            'close_date' => 'date:Y-m-d',
            'allotment_date' => 'date:Y-m-d',
            'listing_date' => 'date:Y-m-d',
            'price_band_min' => 'decimal:2',
            'price_band_max' => 'decimal:2',
            'issue_price' => 'decimal:2',
            'issue_size' => 'decimal:2',
            'gmp' => 'decimal:2',
            'accept_fix_applications' => 'boolean',
            'auto_approve_fix' => 'boolean',
            'lot_size' => 'integer',
            'min_retail_qty' => 'integer',
            'raw_provider_data' => 'array',
            'last_synced_at' => 'datetime',
            'allotment_scraped_at' => 'datetime',
        ];
    }

    public function favoritedByUsers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class, 'user_favorite_ipos', 'ipo_id', 'user_id')->withTimestamps();
    }

    public function rates(): HasMany
    {
        return $this->hasMany(IpoRate::class)->orderByDesc('id');
    }

    public function activeRate(): HasOne
    {
        return $this->hasOne(IpoRate::class)
            ->ofMany(['id' => 'max'], fn (Builder $query) => $query->where('is_active', true));
    }

    public function applicationBatches(): HasMany
    {
        return $this->hasMany(ApplicationBatch::class);
    }

    public function getComputedStatusAttribute(): string
    {
        $today = now()->toDateString();
        $open = $this->open_date ? $this->open_date->format('Y-m-d') : null;
        $close = $this->close_date ? $this->close_date->format('Y-m-d') : null;

        if ($close && $close < $today) {
            return 'closed';
        }
        if ($open && $open > $today) {
            return 'upcoming';
        }
        if ($open && $close && $open <= $today && $close >= $today) {
            return 'open';
        }

        return in_array($this->status, ['closed', 'allotted', 'listed']) ? 'closed' : ($this->status === 'open' ? 'open' : 'upcoming');
    }

    public static function recalculateStatuses(): int
    {
        $today = now()->toDateString();
        $updated = 0;

        // 1. Mark as closed if close_date is in the past
        $updated += self::whereNotNull('close_date')
            ->where('close_date', '<', $today)
            ->whereNotIn('status', ['closed', 'allotted', 'listed'])
            ->update(['status' => 'closed']);

        // 2. Mark as upcoming if open_date is in the future
        $updated += self::whereNotNull('open_date')
            ->where('open_date', '>', $today)
            ->where('status', '!=', 'upcoming')
            ->update(['status' => 'upcoming']);

        // 3. Mark as open if open_date <= today <= close_date
        $updated += self::whereNotNull('open_date')
            ->whereNotNull('close_date')
            ->where('open_date', '<=', $today)
            ->where('close_date', '>=', $today)
            ->where('status', '!=', 'open')
            ->update(['status' => 'open']);

        return $updated;
    }

    public static function normalizeName(string $name): string
    {
        $clean = strtolower(trim($name));

        $aliases = [
            'reliance jio' => 'reliancejio',
            'jio platforms' => 'reliancejio',
            'jioplatforms' => 'reliancejio',
            'reliance' => 'reliancejio',
            'acevector' => 'snapdeal',
            'snapdeal' => 'snapdeal',
            'boat' => 'boatlifestyle',
            'imagine marketing' => 'boatlifestyle',
            'imaginemarketing' => 'boatlifestyle',
        ];

        foreach ($aliases as $needle => $canonical) {
            if (str_contains($clean, $needle)) {
                return $canonical;
            }
        }

        $clean = preg_replace('/\b(ipo|limited|ltd|pvt|private|technologies|technology|tech|solutions|solution|industries|industry|services|service|enterprises|enterprise|corp|corporation|holdings|holding|india)\b/i', '', $clean);
        $clean = preg_replace('/[^a-z0-9]/i', '', $clean);

        return trim($clean);
    }

    /**
     * Consolidate duplicate IPO records in the database, transferring batches, rates, and favorites to canonical records.
     */
    public static function deduplicate(): int
    {
        $ipos = self::with(['applicationBatches', 'rates'])->get();
        if ($ipos->count() <= 1) {
            return 0;
        }

        $groups = [];
        foreach ($ipos as $ipo) {
            $normKey = self::normalizeName($ipo->company_name);
            $symKey = ! empty($ipo->symbol) && strlen(trim($ipo->symbol)) >= 3 ? 'SYM_' . strtoupper(trim($ipo->symbol)) : null;

            // Find existing group by normKey or symKey
            $matchedKey = null;
            foreach ($groups as $gKey => $groupIpos) {
                if ($gKey === $normKey) {
                    $matchedKey = $gKey;
                    break;
                }
                foreach ($groupIpos as $existing) {
                    if (self::normalizeName($existing->company_name) === $normKey) {
                        $matchedKey = $gKey;
                        break 2;
                    }
                    if ($symKey && ! empty($existing->symbol) && strtoupper(trim($existing->symbol)) === strtoupper(trim($ipo->symbol))) {
                        $matchedKey = $gKey;
                        break 2;
                    }
                }
            }

            $keyToUse = $matchedKey ?: $normKey;
            $groups[$keyToUse][] = $ipo;
        }

        $deletedCount = 0;

        foreach ($groups as $group) {
            if (count($group) <= 1) {
                continue;
            }

            // Pick canonical keeper
            usort($group, function ($a, $b) {
                $aBatches = $a->applicationBatches->count();
                $bBatches = $b->applicationBatches->count();
                if ($aBatches !== $bBatches) {
                    return $bBatches <=> $aBatches; // Higher batches first
                }

                $aRates = $a->rates->count();
                $bRates = $b->rates->count();
                if ($aRates !== $bRates) {
                    return $bRates <=> $aRates; // Higher rates first
                }

                $aGmp = (float) ($a->gmp ?? 0);
                $bGmp = (float) ($b->gmp ?? 0);
                if ($aGmp !== $bGmp) {
                    return $bGmp <=> $aGmp;
                }

                $aDates = ($a->open_date ? 1 : 0) + ($a->close_date ? 1 : 0);
                $bDates = ($b->open_date ? 1 : 0) + ($b->close_date ? 1 : 0);
                if ($aDates !== $bDates) {
                    return $bDates <=> $aDates;
                }

                return $a->id <=> $b->id; // Earlier ID first
            });

            $keeper = array_shift($group);

            foreach ($group as $duplicate) {
                // 1. Reassign application batches
                \App\Models\ApplicationBatch::where('ipo_id', $duplicate->id)->update(['ipo_id' => $keeper->id]);

                // 2. Reassign IPO rates (only if keeper doesn't already have identical rates)
                foreach ($duplicate->rates as $dupRate) {
                    $alreadyHasRate = \App\Models\IpoRate::where('ipo_id', $keeper->id)
                        ->where('trader_rate', $dupRate->trader_rate)
                        ->where('published_rate', $dupRate->published_rate)
                        ->exists();

                    if (! $alreadyHasRate) {
                        $dupRate->update(['ipo_id' => $keeper->id]);
                    } else {
                        $dupRate->delete();
                    }
                }

                // 3. Transfer favorites
                $favUserIds = \Illuminate\Support\Facades\DB::table('user_favorite_ipos')
                    ->where('ipo_id', $duplicate->id)
                    ->pluck('user_id');

                foreach ($favUserIds as $uId) {
                    \Illuminate\Support\Facades\DB::table('user_favorite_ipos')->updateOrInsert(
                        ['user_id' => $uId, 'ipo_id' => $keeper->id],
                        ['created_at' => now(), 'updated_at' => now()]
                    );
                }
                \Illuminate\Support\Facades\DB::table('user_favorite_ipos')->where('ipo_id', $duplicate->id)->delete();

                // 4. Fill missing fields on keeper from duplicate
                $fields = [
                    'symbol', 'exchange', 'category', 'open_date', 'close_date',
                    'allotment_date', 'listing_date', 'price_band_min', 'price_band_max',
                    'issue_price', 'lot_size', 'issue_size', 'gmp', 'kfin_client_id',
                    'raw_provider_data',
                ];

                $modified = false;
                foreach ($fields as $field) {
                    if (empty($keeper->{$field}) && ! empty($duplicate->{$field})) {
                        $keeper->{$field} = $duplicate->{$field};
                        $modified = true;
                    }
                }

                if ($modified) {
                    $keeper->save();
                }

                $duplicate->delete();
                $deletedCount++;
            }
        }

        return $deletedCount;
    }

    public function scopeOpen(Builder $query): Builder
    {
        return $query->where('status', 'open');
    }

    public function scopeUpcoming(Builder $query): Builder
    {
        return $query->where('status', 'upcoming');
    }

    public function scopeClosed(Builder $query): Builder
    {
        return $query->whereIn('status', ['closed', 'allotted', 'listed']);
    }
}
