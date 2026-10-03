<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class IpoRate extends Model
{
    use HasFactory;

    protected $fillable = [
        'ipo_id',
        'trader_rate',
        'published_rate',
        'margin',
        'effective_from',
        'is_active',
        'note',
        'created_by_user_id',
    ];

    protected function casts(): array
    {
        return [
            'trader_rate' => 'decimal:2',
            'published_rate' => 'decimal:2',
            'margin' => 'decimal:2',
            'effective_from' => 'datetime',
            'is_active' => 'boolean',
        ];
    }

    public function ipo(): BelongsTo
    {
        return $this->belongsTo(Ipo::class);
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by_user_id');
    }

    public function applicationBatches(): HasMany
    {
        return $this->hasMany(ApplicationBatch::class, 'rate_id');
    }
}
