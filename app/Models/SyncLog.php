<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SyncLog extends Model
{
    use HasFactory;

    public $timestamps = false;

    protected $fillable = [
        'provider',
        'status',
        'ipos_created',
        'ipos_updated',
        'error_message',
        'execution_time_ms',
        'triggered_by_user_id',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'ipos_created' => 'integer',
            'ipos_updated' => 'integer',
            'execution_time_ms' => 'integer',
            'created_at' => 'datetime',
        ];
    }

    public function triggeredBy(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by_user_id');
    }
}
