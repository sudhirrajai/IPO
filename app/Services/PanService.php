<?php

namespace App\Services;

use App\Models\UserPan;
use InvalidArgumentException;

class PanService
{
    /**
     * Standard Indian PAN format: 5 letters, 4 digits, 1 letter.
     */
    public const PAN_REGEX = '/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/';

    /**
     * Normalize PAN number string.
     */
    public static function normalize(string $pan): string
    {
        return strtoupper(trim($pan));
    }

    /**
     * Check if PAN string is syntactically valid.
     */
    public static function isValidFormat(string $pan): bool
    {
        $normalized = self::normalize($pan);

        return (bool) preg_match(self::PAN_REGEX, $normalized);
    }

    /**
     * Mask PAN for safe display.
     */
    public static function mask(string $pan): string
    {
        $normalized = self::normalize($pan);
        if (strlen($normalized) !== 10) {
            return '******';
        }

        return 'XXXXXX'.substr($normalized, -4);
    }

    /**
     * Validate and create a saved PAN for a user.
     */
    public static function createPanForUser(int $userId, array $data): UserPan
    {
        $panNumber = self::normalize($data['pan_number'] ?? '');

        if (! self::isValidFormat($panNumber)) {
            throw new InvalidArgumentException('Invalid PAN format. PAN must be 10 characters (e.g., ABCDE1234F).');
        }

        $exists = UserPan::where('user_id', $userId)
            ->where('pan_number', $panNumber)
            ->exists();

        if ($exists) {
            throw new InvalidArgumentException('This PAN is already registered in your saved records.');
        }

        $pan = UserPan::create([
            'user_id' => $userId,
            'pan_number' => $panNumber,
            'account_holder_name' => $data['account_holder_name'] ?? null,
            'broker_name' => $data['broker_name'] ?? null,
            'notes' => $data['notes'] ?? null,
            'verification_status' => 'format_valid',
            'status' => 'active',
        ]);

        AuditService::log('pan_created', $pan, null, [
            'pan_masked' => self::mask($panNumber),
            'user_id' => $userId,
        ], 'Saved new PAN record');

        return $pan;
    }
}
