<?php

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\IpoRate;
use App\Models\User;
use App\Models\UserPan;

test('regular user can apply in bulk using multiple saved PAN cards', function () {
    $user = User::factory()->create(['role' => 'user']);
    $ipo = Ipo::create([
        'company_name' => 'Tata Technologies Ltd',
        'symbol' => 'TATATECH',
        'exchange' => 'NSE',
        'lot_size' => 100,
        'issue_price' => 150,
        'price_band_max' => 150,
        'gmp' => 30,
        'status' => 'bidding_open',
    ]);
    IpoRate::create([
        'ipo_id' => $ipo->id,
        'trader_rate' => 1500,
        'published_rate' => 1200,
        'margin' => 300,
        'is_active' => true,
    ]);

    $pan1 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'ABCDE1111A',
        'account_holder_name' => 'Rahul Sharma',
        'status' => 'active',
    ]);
    $pan2 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'BCDEF2222B',
        'account_holder_name' => 'Pooja Sharma',
        'status' => 'active',
    ]);
    $pan3 = UserPan::create([
        'user_id' => $user->id,
        'pan_number' => 'CDEFG3333C',
        'account_holder_name' => 'Amit Sharma',
        'status' => 'active',
    ]);

    $response = $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'pan_ids' => [$pan1->id, $pan2->id, $pan3->id],
        'bank_name' => 'HDFC Bank',
        'upi_id' => 'rahul@okhdfc',
        'profit_sharing_type' => 'rate_margin',
    ]);

    $response->assertRedirect();

    $batch = ApplicationBatch::where('ipo_id', $ipo->id)
        ->where('user_id', $user->id)
        ->latest('id')
        ->first();

    expect($batch)->not->toBeNull()
        ->and($batch->application_count)->toBe(3)
        ->and((float) $batch->expected_user_payout)->toBe(3600.0) // 1200 * 3
        ->and($batch->funding_source)->toBe('user_money');

    $batchPans = ApplicationBatchPan::where('application_batch_id', $batch->id)->get();
    expect($batchPans)->toHaveCount(3);
    expect($batchPans->pluck('pan_number_snapshot')->toArray())->toBe([
        'ABCDE1111A',
        'BCDEF2222B',
        'CDEFG3333C',
    ]);
});

test('admin can apply in bulk using PAN cards across users with chosen funding source', function () {
    $admin = User::factory()->create(['role' => 'admin']);
    $friend = User::factory()->create(['role' => 'user']);
    $ipo = Ipo::create([
        'company_name' => 'Adani Energy Ltd',
        'symbol' => 'ADANIEN',
        'exchange' => 'BSE',
        'lot_size' => 50,
        'issue_price' => 200,
        'price_band_max' => 200,
        'gmp' => 50,
        'status' => 'bidding_open',
    ]);
    IpoRate::create([
        'ipo_id' => $ipo->id,
        'trader_rate' => 2000,
        'published_rate' => 1700,
        'margin' => 300,
        'is_active' => true,
    ]);

    $pan1 = UserPan::create([
        'user_id' => $friend->id,
        'pan_number' => 'KLMNO4444D',
        'account_holder_name' => 'Vikram Singh',
        'status' => 'active',
    ]);
    $pan2 = UserPan::create([
        'user_id' => $friend->id,
        'pan_number' => 'MNOPQ5555E',
        'account_holder_name' => 'Sunita Singh',
        'status' => 'active',
    ]);

    $response = $this->actingAs($admin)->post('/applications', [
        'ipo_id' => $ipo->id,
        'user_id' => $friend->id,
        'pan_ids' => [$pan1->id, $pan2->id],
        'bank_name' => 'ICICI Bank',
        'funding_source' => 'my_money',
        'profit_sharing_type' => 'rate_margin',
        'trader_reference' => 'TR-BULK-01',
    ]);

    $response->assertRedirect();

    $batch = ApplicationBatch::where('ipo_id', $ipo->id)
        ->where('user_id', $friend->id)
        ->latest('id')
        ->first();

    expect($batch)->not->toBeNull()
        ->and($batch->application_count)->toBe(2)
        ->and((float) $batch->expected_user_payout)->toBe(3400.0) // 1700 * 2
        ->and((float) $batch->expected_net_earnings)->toBe(600.0) // (2000 - 1700) * 2
        ->and($batch->funding_source)->toBe('my_money')
        ->and($batch->trader_reference)->toBe('TR-BULK-01');

    $batchPans = ApplicationBatchPan::where('application_batch_id', $batch->id)->get();
    expect($batchPans)->toHaveCount(2);
});
