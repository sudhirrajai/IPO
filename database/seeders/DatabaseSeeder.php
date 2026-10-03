<?php

namespace Database\Seeders;

use App\Models\AppSetting;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // 1. Create Admin User
        User::firstOrCreate(
            ['email' => 'sudhir@vmcore.in'],
            [
                'name' => 'Admin Owner',
                'password' => Hash::make('Sudhir@1234'),
                'role' => 'admin',
                'status' => 'active',
                'phone' => '+91 9876543210',
            ]
        );

        // 2. Configure Default Settings
        AppSetting::firstOrCreate(
            ['key' => 'ipo_provider'],
            ['value' => 'upstox', 'group' => 'providers']
        );
    }
}
