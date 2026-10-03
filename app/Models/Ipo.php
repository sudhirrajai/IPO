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
        'status',
        'provider',
        'provider_id',
        'raw_provider_data',
        'last_synced_at',
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
    ];

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
            'lot_size' => 'integer',
            'min_retail_qty' => 'integer',
            'raw_provider_data' => 'array',
            'last_synced_at' => 'datetime',
        ];
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
