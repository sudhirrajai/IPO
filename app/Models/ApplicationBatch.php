<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class ApplicationBatch extends Model
{
    use HasFactory;

    protected $fillable = [
        'batch_number',
        'ipo_id',
        'user_id',
        'applicant_name',
        'bank_name',
        'pan_number',
        'upi_id',
        'upi_app',
        'rate_id',
        'application_count',
        'funding_source',
        'profit_sharing_type',
        'profit_sharing_value',
        'trader_rate_snapshot',
        'published_rate_snapshot',
        'margin_snapshot',
        'gmp_snapshot',
        'ipo_amount',
        'capital_per_application',
        'capital_amount',
        'expected_gross_profit',
        'expected_user_payout',
        'expected_net_earnings',
        'settled_gross_profit',
        'settled_user_payout',
        'settled_net_earnings',
        'capital_returned',
        'application_status',
        'settlement_status',
        'trader_reference',
        'submission_date',
        'notes',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'application_count' => 'integer',
            'trader_rate_snapshot' => 'decimal:2',
            'published_rate_snapshot' => 'decimal:2',
            'margin_snapshot' => 'decimal:2',
            'gmp_snapshot' => 'decimal:2',
            'ipo_amount' => 'decimal:2',
            'profit_sharing_value' => 'decimal:2',
            'capital_per_application' => 'decimal:2',
            'capital_amount' => 'decimal:2',
            'expected_gross_profit' => 'decimal:2',
            'expected_user_payout' => 'decimal:2',
            'expected_net_earnings' => 'decimal:2',
            'settled_gross_profit' => 'decimal:2',
            'settled_user_payout' => 'decimal:2',
            'settled_net_earnings' => 'decimal:2',
            'capital_returned' => 'decimal:2',
            'submission_date' => 'date:Y-m-d',
        ];
    }

    public function ipo(): BelongsTo
    {
        return $this->belongsTo(Ipo::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function rate(): BelongsTo
    {
        return $this->belongsTo(IpoRate::class, 'rate_id');
    }

    public function batchPans(): HasMany
    {
        return $this->hasMany(ApplicationBatchPan::class);
    }

    public function settlement(): HasOne
    {
        return $this->hasOne(Settlement::class)->latestOfMany();
    }

    public function settlements(): HasMany
    {
        return $this->hasMany(Settlement::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function isMyMoney(): bool
    {
        return $this->funding_source === 'my_money';
    }

    public function isUserMoney(): bool
    {
        return $this->funding_source === 'user_money';
    }

    public function isSettled(): bool
    {
        return $this->settlement_status === 'settled';
    }
}
