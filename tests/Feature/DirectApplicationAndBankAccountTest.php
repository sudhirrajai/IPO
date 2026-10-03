<?php

use App\Models\ApplicationBatch;
use App\Models\BankAccount;
use App\Models\Ipo;
use App\Models\User;
use App\Models\UserPan;
use App\Models\UserUpi;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

test('User can manage bank account with only bank name', function () {
    $user = User::factory()->create();

    $response = $this->actingAs($user)->post('/bank-accounts', [
        'bank_name' => 'HDFC Bank',
    ]);

    $response->assertSessionHas('success');
    expect(BankAccount::where('user_id', $user->id)->where('bank_name', 'HDFC Bank')->exists())->toBeTrue();

    $bank = BankAccount::where('user_id', $user->id)->first();

    $deleteResponse = $this->actingAs($user)->delete("/bank-accounts/{$bank->id}");
    $deleteResponse->assertSessionHas('success');
    expect(BankAccount::find($bank->id))->toBeNull();
});

test('User can submit direct application without fixed rate and auto-calculate IPO amount and GMP', function () {
    $user = User::factory()->create();

    // IPO without active rate configured
    $ipo = Ipo::create([
        'company_name' => 'Solar Energy Tech Limited',
        'symbol' => 'SOLARTECH',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 100,
        'price_band_min' => 140,
        'price_band_max' => 150,
        'gmp' => 35,
        'status' => 'open',
    ]);

    // Direct application with Fixed profit sharing
    $response = $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'applicant_name' => 'Rahul Verma',
        'bank_name' => 'State Bank of India',
        'pan_number' => 'ABCDE1234F',
        'upi_id' => 'rahul@oksbi',
        'application_count' => 2,
        'funding_source' => 'my_money',
        'profit_sharing_type' => 'fix',
        'profit_sharing_value' => 750,
    ]);

    $response->assertSessionHas('success');

    $batch = ApplicationBatch::where('ipo_id', $ipo->id)->first();
    expect($batch)->not->toBeNull()
        ->and($batch->applicant_name)->toBe('Rahul Verma')
        ->and($batch->bank_name)->toBe('State Bank of India')
        ->and($batch->pan_number)->toBe('ABCDE1234F')
        ->and($batch->upi_id)->toBe('rahul@oksbi')
        ->and($batch->profit_sharing_type)->toBe('fix')
        ->and((float) $batch->profit_sharing_value)->toBe(750.0)
        // IPO Amount = 100 shares * ₹150 * 2 lots = ₹30,000
        ->and((float) $batch->ipo_amount)->toBe(30000.0)
        ->and((float) $batch->capital_amount)->toBe(30000.0)
        // GMP snapshot = 35
        ->and((float) $batch->gmp_snapshot)->toBe(35.0)
        // Expected user payout = 750 * 2 = 1500
        ->and((float) $batch->expected_user_payout)->toBe(1500.0);

    // Auto-created Bank Account and UserPan
    expect(BankAccount::where('user_id', $user->id)->where('bank_name', 'State Bank of India')->exists())->toBeTrue();
    expect(UserPan::where('user_id', $user->id)->where('pan_number', 'ABCDE1234F')->exists())->toBeTrue();
});

test('1-Click Allotted action records realized profit and settles capital', function () {
    $user = User::factory()->create();

    $ipo = Ipo::create([
        'company_name' => 'Reliance Jio Limited',
        'symbol' => 'JIO',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 50,
        'price_band_max' => 300,
        'gmp' => 120,
        'status' => 'open',
    ]);

    // Application with 20% percentage profit sharing
    $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'applicant_name' => 'Anita Singh',
        'bank_name' => 'Kotak Mahindra Bank',
        'pan_number' => 'XYZPK9876Q',
        'application_count' => 1,
        'funding_source' => 'my_money',
        'profit_sharing_type' => 'percentage',
        'profit_sharing_value' => 20,
    ]);

    $batch = ApplicationBatch::where('ipo_id', $ipo->id)->first();
    // Expected listing gain = 50 * 120 = 6000
    // User payout (20%) = 1200, Net earnings = 4800
    expect((float) $batch->expected_gross_profit)->toBe(6000.0)
        ->and((float) $batch->expected_user_payout)->toBe(1200.0)
        ->and((float) $batch->expected_net_earnings)->toBe(4800.0);

    // 1-Click Allotted Action
    $statusResponse = $this->actingAs($user)->post("/applications/{$batch->id}/status", [
        'application_status' => 'allotted',
    ]);

    $statusResponse->assertSessionHas('success');

    $batch->refresh();
    expect($batch->application_status)->toBe('allotted')
        ->and($batch->settlement_status)->toBe('settled')
        ->and((float) $batch->settled_user_payout)->toBe(1200.0)
        ->and((float) $batch->settled_net_earnings)->toBe(4800.0)
        ->and((float) $batch->capital_returned)->toBe((float) $batch->capital_amount);
});

test('1-Click Not Allotted action releases capital and sets profit to zero', function () {
    $user = User::factory()->create();

    $ipo = Ipo::create([
        'company_name' => 'Alpha Defense Ltd',
        'symbol' => 'ALPHADEF',
        'exchange' => 'BSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 40,
        'price_band_max' => 250,
        'gmp' => 80,
        'status' => 'open',
    ]);

    $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'applicant_name' => 'Vikram Roy',
        'bank_name' => 'Axis Bank',
        'application_count' => 1,
        'profit_sharing_type' => 'fix',
        'profit_sharing_value' => 1000,
    ]);

    $batch = ApplicationBatch::where('ipo_id', $ipo->id)->first();

    // 1-Click Not Allotted Action
    $statusResponse = $this->actingAs($user)->post("/applications/{$batch->id}/status", [
        'application_status' => 'not_allotted',
    ]);

    $statusResponse->assertSessionHas('success');

    $batch->refresh();
    expect($batch->application_status)->toBe('not_allotted')
        ->and($batch->settlement_status)->toBe('settled')
        ->and((float) $batch->settled_user_payout)->toBe(0.0)
        ->and((float) $batch->settled_net_earnings)->toBe(0.0)
        ->and((float) $batch->capital_returned)->toBe((float) $batch->capital_amount);
});

test('User can save UPI ID, link to bank account, and auto-detect UPI app', function () {
    $user = User::factory()->create();

    $bank = BankAccount::create([
        'user_id' => $user->id,
        'bank_name' => 'HDFC Bank',
    ]);

    // Save UPI linked to bank with auto app detection (@okhdfcbank -> Google Pay)
    $response = $this->actingAs($user)->post('/user-upis', [
        'upi_id' => 'vikas@okhdfcbank',
        'bank_account_id' => $bank->id,
    ]);

    $response->assertSessionHas('success');
    expect(UserUpi::where('user_id', $user->id)->where('upi_id', 'vikas@okhdfcbank')->exists())->toBeTrue();

    $upi = UserUpi::where('user_id', $user->id)->where('upi_id', 'vikas@okhdfcbank')->first();
    expect($upi->bank_account_id)->toBe($bank->id)
        ->and($upi->upi_app)->toBe('Google Pay');

    // Save PhonePe UPI with auto-detection
    $this->actingAs($user)->post('/user-upis', [
        'upi_id' => '9876543210@ybl',
        'bank_account_id' => $bank->id,
    ]);

    $phonePeUpi = UserUpi::where('user_id', $user->id)->where('upi_id', '9876543210@ybl')->first();
    expect($phonePeUpi->upi_app)->toBe('PhonePe');

    // Delete UPI
    $delResponse = $this->actingAs($user)->delete("/user-upis/{$upi->id}");
    $delResponse->assertSessionHas('success');
    expect(UserUpi::find($upi->id))->toBeNull();
});

test('Direct application submission automatically saves UPI ID and links to bank account', function () {
    $user = User::factory()->create();

    $ipo = Ipo::create([
        'company_name' => 'Tata Technologies Ltd',
        'symbol' => 'TATATECH',
        'exchange' => 'NSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 30,
        'price_band_max' => 500,
        'gmp' => 150,
        'status' => 'open',
    ]);

    $response = $this->actingAs($user)->post('/applications', [
        'ipo_id' => $ipo->id,
        'applicant_name' => 'Rohan Sharma',
        'bank_name' => 'Kotak Mahindra Bank',
        'upi_id' => 'rohan@ptsbi',
        'application_count' => 1,
        'funding_source' => 'my_money',
        'profit_sharing_type' => 'fix',
        'profit_sharing_value' => 500,
    ]);

    $response->assertSessionHas('success');

    // Verify batch has upi_id and auto-detected upi_app (Paytm for @ptsbi)
    $batch = ApplicationBatch::where('ipo_id', $ipo->id)->first();
    expect($batch->upi_id)->toBe('rohan@ptsbi')
        ->and($batch->upi_app)->toBe('Paytm');

    // Verify UserUpi was automatically created and linked to the auto-saved BankAccount
    $bank = BankAccount::where('user_id', $user->id)->where('bank_name', 'Kotak Mahindra Bank')->first();
    expect($bank)->not->toBeNull();

    $userUpi = UserUpi::where('user_id', $user->id)->where('upi_id', 'rohan@ptsbi')->first();
    expect($userUpi)->not->toBeNull()
        ->and($userUpi->bank_account_id)->toBe($bank->id)
        ->and($userUpi->upi_app)->toBe('Paytm');
});

test('User can update IPO Grey Market Premium (GMP)', function () {
    $user = User::factory()->create();

    $ipo = Ipo::create([
        'company_name' => 'Nityas Gems & Jewellery IPO',
        'symbol' => 'NITYAS',
        'exchange' => 'BSE,NSE',
        'ipo_type' => 'mainboard',
        'lot_size' => 200,
        'price_band_max' => 75,
        'gmp' => null,
        'status' => 'open',
    ]);

    $response = $this->actingAs($user)->post("/ipos/{$ipo->id}/gmp", [
        'gmp' => 25.5,
    ]);

    $response->assertSessionHas('success');

    $ipo->refresh();
    expect((float) $ipo->gmp)->toBe(25.5);
});
