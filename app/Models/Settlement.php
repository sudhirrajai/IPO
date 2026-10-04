<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Settlement extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_batch_id',
        'settlement_date',
        'actual_gross_profit',
        'actual_user_payout',
        'actual_net_earnings',
        'capital_returned',
        'settlement_method',
        'notes',
        'settled_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'settlement_date' => 'date:Y-m-d',
            'actual_gross_profit' => 'decimal:2',
            'actual_user_payout' => 'decimal:2',
            'actual_net_earnings' => 'decimal:2',
            'capital_returned' => 'decimal:2',
        ];
    }

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ApplicationBatch::class, 'application_batch_id');
    }

    public function settledBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'settled_by_user_id')->withTrashed();
    }
}
