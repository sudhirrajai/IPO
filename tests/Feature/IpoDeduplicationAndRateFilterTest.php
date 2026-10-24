<?php

use App\Models\ApplicationBatch;
use App\Models\BankAccount;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('Ipo::deduplicate consolidates duplicate IPO records and reassigns application batches', function () {
    $admin = User::factory()->create(['role' => 'admin']);

    $ipo1 = Ipo::create([
        'company_name' => 'Reliance Jio Infocomm Limited',
        'symbol' => 'JIOPLATFOR',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'status' => 'upcoming',
        'lot_size' => 10,
        'gmp' => 150,
    ]);

    $ipo2 = Ipo::create([
        'company_name' => 'Reliance Jio IPO',
        'symbol' => 'RELIANCEJIO',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'status' => 'upcoming',
        'lot_size' => 10,
        'gmp' => 170,
    ]);

    $batch = ApplicationBatch::create([
        'batch_number' => 'BATCH-TEST-001',
        'ipo_id' => $ipo2->id,
        'user_id' => $admin->id,
        'application_count' => 1,
        'profit_sharing_type' => 'rate_margin',
        'published_rate_snapshot' => 1100,
        'trader_rate_snapshot' => 1250,
        'margin_snapshot' => 150,
        'application_status' => 'submitted',
        'funding_source' => 'my_money',
    ]);

    $deleted = Ipo::deduplicate();

    expect($deleted)->toBe(1);
    expect(Ipo::count())->toBe(1);

    $remainingIpo = Ipo::first();
    expect($batch->fresh()->ipo_id)->toBe($remainingIpo->id);
});

test('bank account controller prevents duplicate bank accounts for same user', function () {
    $user = User::factory()->create();

    $this->actingAs($user)->post('/bank-accounts', [
        'bank_name' => 'HDFC',
    ]);

    $this->actingAs($user)->post('/bank-accounts', [
        'bank_name' => ' hdfc ',
    ]);

    expect(BankAccount::where('user_id', $user->id)->count())->toBe(1);
});

test('applications index filters correctly by user_rate and trader_rate', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $ipo = Ipo::create([
        'company_name' => 'Tata Technologies IPO',
        'symbol' => 'TATATECH',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'status' => 'open',
        'lot_size' => 30,
    ]);

    ApplicationBatch::create([
        'batch_number' => 'BATCH-R1',
        'ipo_id' => $ipo->id,
        'user_id' => $admin->id,
        'application_count' => 1,
        'profit_sharing_type' => 'rate_margin',
        'published_rate_snapshot' => 1100,
        'trader_rate_snapshot' => 1250,
        'application_status' => 'submitted',
        'funding_source' => 'my_money',
    ]);

    ApplicationBatch::create([
        'batch_number' => 'BATCH-R2',
        'ipo_id' => $ipo->id,
        'user_id' => $admin->id,
        'application_count' => 1,
        'profit_sharing_type' => 'rate_margin',
        'published_rate_snapshot' => 800,
        'trader_rate_snapshot' => 1000,
        'application_status' => 'submitted',
        'funding_source' => 'my_money',
    ]);

    $responseUserRate = $this->actingAs($admin)->get('/applications?user_rate=1100');
    $responseUserRate->assertOk();
    $batches = $responseUserRate->viewData('page')['props']['batches']['data'];
    expect(count($batches))->toBe(1);
    expect($batches[0]['batch_number'])->toBe('BATCH-R1');

    $responseTraderRate = $this->actingAs($admin)->get('/applications?trader_rate=1000');
    $responseTraderRate->assertOk();
    $traderBatches = $responseTraderRate->viewData('page')['props']['batches']['data'];
    expect(count($traderBatches))->toBe(1);
    expect($traderBatches[0]['batch_number'])->toBe('BATCH-R2');
});
