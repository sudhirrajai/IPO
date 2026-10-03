<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserUpi extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'bank_account_id',
        'upi_id',
        'upi_app',
        'status',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function bankAccount(): BelongsTo
    {
        return $this->belongsTo(BankAccount::class);
    }

    /**
     * Auto-detect UPI app from the VPA handle.
     */
    public static function detectApp(string $upiId): string
    {
        $handle = strtolower(substr($upiId, strpos($upiId, '@') ?: 0));

        if (in_array($handle, ['@okhdfcbank', '@okaxis', '@oksbi', '@okicici'])) {
            return 'Google Pay';
        }

        if (in_array($handle, ['@ybl', '@ibl', '@axl'])) {
            return 'PhonePe';
        }

        if (str_contains($handle, 'paytm') || in_array($handle, ['@ptaxis', '@pthdfc', '@ptsbi'])) {
            return 'Paytm';
        }

        if ($handle === '@upi') {
            return 'BHIM';
        }

        if ($handle === '@cred') {
            return 'Cred';
        }

        if (in_array($handle, ['@apl', '@rapl'])) {
            return 'Amazon Pay';
        }

        return 'Other';
    }
}
