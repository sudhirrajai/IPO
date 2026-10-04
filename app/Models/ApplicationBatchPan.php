<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ApplicationBatchPan extends Model
{
    use HasFactory;

    protected $fillable = [
        'application_batch_id',
        'user_pan_id',
        'sequence_number',
        'pan_number_snapshot',
        'allotment_status',
        'allotted_shares',
        'notes',
    ];

    protected $casts = [
        'sequence_number' => 'integer',
        'allotted_shares' => 'integer',
    ];

    public function batch(): BelongsTo
    {
        return $this->belongsTo(ApplicationBatch::class, 'application_batch_id');
    }

    public function userPan(): BelongsTo
    {
        return $this->belongsTo(UserPan::class, 'user_pan_id')->withTrashed();
    }
}
