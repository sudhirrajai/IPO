<?php

use App\Models\ApplicationBatch;
use App\Models\Ipo;
use App\Models\User;
use App\Services\ApplicationBatchService;
use App\Services\IpoRateService;
use App\Services\IpoSyncService;
use App\Services\PanService;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Scenario 1: Rate changes preserve immutable snapshots on application batches', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $userA = User::factory()->create(['role' => 'user', 'name' => 'User A']);

    $ipo = Ipo::create([
        'company_name' => 'Tech IPO Ltd',
        'symbol' => 'TECHIPO',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 10,
        'status' => 'open',
    ]);

    // 1. Set trader rate to 1000 and published rate to 800
    $this->actingAs($admin);
    IpoRateService::setRate($ipo, 1000.00, 800.00, 'Initial rate');

    expect($ipo->refresh()->activeRate->margin)->toBe('200.00');

    // 2. Create batch 1 for User A with 2 applications
    $batch1 = ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $userA->id,
        'application_count' => 2,
        'funding_source' => 'my_money',
    ], true);

    expect((float) $batch1->published_rate_snapshot)->toBe(800.0)
        ->and((float) $batch1->trader_rate_snapshot)->toBe(1000.0)
        ->and((float) $batch1->margin_snapshot)->toBe(200.0)
        ->and((float) $batch1->expected_user_payout)->toBe(1600.0);

    // 3. Later, change published rate to 1000, trader rate to 1200
    IpoRateService::setRate($ipo, 1200.00, 1000.00, 'Increased rate');

    // 4. Create batch 2 for User A with 2 applications
    $batch2 = ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $userA->id,
        'application_count' => 2,
        'funding_source' => 'my_money',
    ], true);

    // 5. Verify batch 1 still uses 800 and batch 2 uses 1000
    $freshBatch1 = ApplicationBatch::find($batch1->id);
    $freshBatch2 = ApplicationBatch::find($batch2->id);

    expect((float) $freshBatch1->published_rate_snapshot)->toBe(800.0)
        ->and((float) $freshBatch2->published_rate_snapshot)->toBe(1000.0)
        ->and((float) $freshBatch1->margin_snapshot)->toBe(200.0)
        ->and((float) $freshBatch2->margin_snapshot)->toBe(200.0);
});

test('Scenario 2: Funding source isolates My Money and User Money without double counting', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);

    $ipo = Ipo::create([
        'company_name' => 'Funding Test IPO',
        'lot_size' => 10,
        'issue_price' => 100.00, // Capital per app = 1000
        'status' => 'open',
    ]);

    $this->actingAs($admin);
    IpoRateService::setRate($ipo, 1000.00, 800.00);

    // 1. Batch funded by My Money (Admin)
    $batchMyMoney = ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $user->id,
        'application_count' => 3,
        'funding_source' => 'my_money',
    ], true);

    // 2. Batch funded by User Money
    $batchUserMoney = ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $user->id,
        'application_count' => 2,
        'funding_source' => 'user_money',
    ], true);

    // 3. Verify capital and calculations
    expect((float) $batchMyMoney->capital_amount)->toBe(3000.0)
        ->and((float) $batchMyMoney->expected_net_earnings)->toBe(600.0) // 3 * 200 margin
        ->and((float) $batchUserMoney->capital_amount)->toBe(2000.0)
        ->and((float) $batchUserMoney->expected_net_earnings)->toBe(400.0); // 2 * 200 margin

    // Verify distinct metrics on Dashboard
    $response = $this->get(route('dashboard'));
    $response->assertOk();
    $response->assertInertia(fn ($page) => $page
        ->where('metrics.capitalDeployedByMe', 3000)
        ->where('metrics.userFundedCapital', 2000)
        ->where('metrics.expectedNetEarnings', 1000)
    );
});

test('Scenario 3: Saved PAN records are normalized, masked, and unauthorized access is prevented', function () {
    $userA = User::factory()->create(['role' => 'user']);
    $userB = User::factory()->create(['role' => 'user']);

    $this->actingAs($userA);

    // 1. Save valid PAN
    $pan = PanService::createPanForUser($userA->id, [
        'pan_number' => 'abcde1234f', // lowercase input
        'account_holder_name' => 'User A',
    ]);

    expect($pan->pan_number)->toBe('ABCDE1234F')
        ->and($pan->masked_pan)->toBe('XXXXXX234F');

    // 2. User A can reveal their own PAN
    $revealResponse = $this->postJson("/pans/{$pan->id}/reveal");
    $revealResponse->assertOk()
        ->assertJson(['pan_number' => 'ABCDE1234F']);

    // 3. User B cannot access User A's PAN reveal endpoint
    $this->actingAs($userB);
    $forbiddenResponse = $this->postJson("/pans/{$pan->id}/reveal");
    $forbiddenResponse->assertForbidden();
});

test('Scenario 4: CSV Export for Trader strictly excludes private rates and margins', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);

    $ipo = Ipo::create([
        'company_name' => 'Export Confidential IPO',
        'lot_size' => 10,
        'status' => 'open',
    ]);

    $this->actingAs($admin);
    IpoRateService::setRate($ipo, 1500.00, 1000.00); // 500 margin

    $pan = PanService::createPanForUser($user->id, [
        'pan_number' => 'ZXCVB9876Q',
        'account_holder_name' => 'Applicant Secret',
    ]);

    ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $user->id,
        'application_count' => 1,
        'funding_source' => 'my_money',
        'pan_ids' => [$pan->id],
    ], true);

    // 1. Request trader export
    $response = $this->get("/ipos/{$ipo->id}/export/trader");
    $response->assertOk();
    $content = $response->streamedContent();

    // 2. Assert trader file does NOT contain "Trader Rate" or "Margin" or the confidential 1500 or 500 rate numbers
    expect($content)->toContain('ZXCVB9876Q')
        ->and($content)->not->toContain('Trader Rate')
        ->and($content)->not->toContain('Margin per App')
        ->and($content)->not->toContain('1500.00')
        ->and($content)->not->toContain('500.00');

    // 3. Regular users cannot access financial report
    $this->actingAs($user);
    $userResponse = $this->get("/ipos/{$ipo->id}/export/financials");
    $userResponse->assertForbidden();
});

test('Scenario 5: Provider synchronization does not overwrite configured internal rates', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $this->actingAs($admin);

    // Run first sync
    $log1 = IpoSyncService::sync('mock');
    expect($log1->status)->toBe('success');

    $swiggy = Ipo::where('symbol', 'SWIGGY')->first();
    expect($swiggy)->not->toBeNull();

    // Admin sets custom private rates
    IpoRateService::setRate($swiggy, 1250.00, 950.00, 'My private configured rate');
    expect($swiggy->fresh()->activeRate->published_rate)->toBe('950.00');

    // Run second sync from mock provider
    $log2 = IpoSyncService::sync('mock');
    expect($log2->status)->toBe('success');

    // Verify rate is STILL 950 and NOT overwritten
    expect($swiggy->fresh()->activeRate->published_rate)->toBe('950.00')
        ->and($swiggy->fresh()->activeRate->trader_rate)->toBe('1250.00')
        ->and($swiggy->fresh()->activeRate->margin)->toBe('300.00');
});

test('Scenario 6: Settlement tracks expected vs realized earnings and keeps capital separate', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $user = User::factory()->create(['role' => 'user']);

    $ipo = Ipo::create([
        'company_name' => 'Settlement IPO',
        'lot_size' => 10,
        'issue_price' => 500.00, // Capital = 5000 per app
        'status' => 'closed',
    ]);

    $this->actingAs($admin);
    IpoRateService::setRate($ipo, 2000.00, 1500.00);

    $batch = ApplicationBatchService::createBatch([
        'ipo_id' => $ipo->id,
        'user_id' => $user->id,
        'application_count' => 1,
        'funding_source' => 'my_money',
    ], true);

    expect($batch->settlement_status)->toBe('estimated')
        ->and((float) $batch->expected_net_earnings)->toBe(500.0)
        ->and($batch->settled_net_earnings)->toBeNull();

    // Settle batch
    $response = $this->post("/applications/{$batch->id}/settle", [
        'settlement_date' => now()->format('Y-m-d'),
        'actual_gross_profit' => 2000.00,
        'actual_user_payout' => 1500.00,
        'actual_net_earnings' => 500.00,
        'capital_returned' => 5000.00,
        'settlement_method' => 'rate_margin',
        'notes' => 'Settled with full capital return',
    ]);

    $response->assertSessionHasNoErrors();

    $settled = $batch->fresh();
    expect($settled->settlement_status)->toBe('settled')
        ->and((float) $settled->settled_net_earnings)->toBe(500.0)
        ->and((float) $settled->capital_returned)->toBe(5000.0);
});
