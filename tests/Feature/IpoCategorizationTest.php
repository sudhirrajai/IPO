<?php

use App\Models\Ipo;
use App\Models\User;

test('ipos are dynamically categorized into open, upcoming, and closed based on dates', function () {
    $admin = User::factory()->create([
        'role' => 'admin',
        'status' => 'active',
    ]);

    // Create 3 IPOs with specific dates
    $openIpo = Ipo::create([
        'company_name' => 'Currently Open Corp',
        'symbol' => 'OPENCORP',
        'open_date' => now()->subDay()->toDateString(),
        'close_date' => now()->addDays(2)->toDateString(),
        'price_band_min' => 100,
        'price_band_max' => 120,
        'lot_size' => 100,
        'status' => 'open',
        'provider' => 'test',
    ]);

    $upcomingIpo = Ipo::create([
        'company_name' => 'Upcoming Tech Ltd',
        'symbol' => 'UPCOMING',
        'open_date' => now()->addDays(3)->toDateString(),
        'close_date' => now()->addDays(5)->toDateString(),
        'price_band_min' => 200,
        'price_band_max' => 220,
        'lot_size' => 50,
        'status' => 'open', // purposely set open to test recalculation
        'provider' => 'test',
    ]);

    $closedIpo = Ipo::create([
        'company_name' => 'Past Listing Ltd',
        'symbol' => 'PASTLIST',
        'open_date' => now()->subDays(10)->toDateString(),
        'close_date' => now()->subDays(4)->toDateString(),
        'price_band_min' => 50,
        'price_band_max' => 60,
        'lot_size' => 200,
        'status' => 'open', // purposely set open to test recalculation
        'provider' => 'test',
    ]);

    // Run dynamic recalculation
    Ipo::recalculateStatuses();

    expect($openIpo->fresh()->status)->toBe('open');
    expect($upcomingIpo->fresh()->status)->toBe('upcoming');
    expect($closedIpo->fresh()->status)->toBe('closed');

    // Access computed status attribute
    expect($openIpo->computed_status)->toBe('open');
    expect($upcomingIpo->computed_status)->toBe('upcoming');
    expect($closedIpo->computed_status)->toBe('closed');

    // Test API/web endpoint returns counts and scopes
    $response = $this->actingAs($admin)->get(route('ipos.index', ['status' => 'open']));
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->component('ipos/index')
        ->has('counts')
        ->has('ipos.data')
    );
});
