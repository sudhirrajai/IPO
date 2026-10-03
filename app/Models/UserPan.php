<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class UserPan extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'pan_number',
        'account_holder_name',
        'broker_name',
        'notes',
        'verification_status',
        'status',
    ];

    protected $appends = [
        'masked_pan',
    ];

    /**
     * Normalize PAN number to uppercase and clean whitespace.
     */
    protected function panNumber(): Attribute
    {
        return Attribute::make(
            get: fn ($value) => strtoupper((string) $value),
            set: fn ($value) => strtoupper(trim((string) $value)),
        );
    }

    /**
     * Masked PAN showing only the last 4 characters by default.
     */
    protected function maskedPan(): Attribute
    {
        return Attribute::make(
            get: function () {
                $pan = $this->pan_number ?? '';
                if (strlen($pan) < 4) {
                    return '******';
                }

                return 'XXXXXX'.substr($pan, -4);
            }
        );
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function batchPans(): HasMany
    {
        return $this->hasMany(ApplicationBatchPan::class);
    }

    public function scopeActive($query)
    {
        return $query->where('status', 'active');
    }
}
