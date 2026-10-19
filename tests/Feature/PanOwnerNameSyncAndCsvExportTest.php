<?php

namespace Tests\Feature;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\User;
use App\Models\UserPan;
use App\Services\ApplicationBatchService;
use App\Services\IpoRateService;
use App\Services\PanService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PanOwnerNameSyncAndCsvExportTest extends TestCase
{
    use RefreshDatabase;

    private User $admin;
    private User $user;
    private Ipo $ipo;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'name' => 'Admin User',
            'role' => 'admin',
        ]);

        $this->user = User::factory()->create([
            'name' => 'John Submitter',
            'role' => 'user',
        ]);

        $this->ipo = Ipo::create([
            'company_name' => 'TechCorp IPO',
            'symbol' => 'TECH',
            'lot_size' => 100,
            'price_band_min' => 100,
            'price_band_max' => 100,
            'issue_price' => 100,
            'status' => 'open',
            'accept_fix_applications' => true,
        ]);

        IpoRateService::setRate($this->ipo, 500.00, 300.00);
    }

    public function test_updating_pan_owner_name_updates_application_batches(): void
    {
        $this->actingAs($this->user);

        // 1. Create a PAN with initial owner name
        $pan = PanService::createPanForUser($this->user->id, [
            'pan_number' => 'ABCDE1234F',
            'account_holder_name' => 'Original Holder Name',
        ]);

        // 2. Create an application with this PAN
        $batch = ApplicationBatchService::createBatch([
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'application_count' => 1,
            'funding_source' => 'my_money',
            'pan_ids' => [$pan->id],
        ]);

        $this->assertEquals('Original Holder Name', $batch->fresh()->applicant_name);

        // 3. Update the PAN owner name via UserPanController::update
        $response = $this->put(route('pans.update', $pan), [
            'pan_number' => 'ABCDE1234F',
            'account_holder_name' => 'Updated Holder Name',
            'status' => 'active',
        ]);

        $response->assertRedirect();

        // 4. Verify the PAN itself is updated
        $this->assertEquals('Updated Holder Name', $pan->fresh()->account_holder_name);

        // 5. Verify the application batch's applicant_name was automatically updated
        $this->assertEquals('Updated Holder Name', $batch->fresh()->applicant_name);
    }

    public function test_trader_pan_submission_csv_exports_pan_holder_name_not_user_name(): void
    {
        $this->actingAs($this->admin);

        // User "John Submitter" submits an application using PAN with owner "Alice PAN Owner"
        $pan = PanService::createPanForUser($this->user->id, [
            'pan_number' => 'XYZKL5678M',
            'account_holder_name' => 'Alice PAN Owner',
        ]);

        $batch = ApplicationBatchService::createBatch([
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'application_count' => 1,
            'funding_source' => 'my_money',
            'pan_ids' => [$pan->id],
        ]);

        // 1. Export Trader PAN submission CSV
        $response = $this->get("/ipos/{$this->ipo->id}/export/trader");
        $response->assertOk();
        $content = $response->streamedContent();

        // Assert CSV contains the PAN owner name "Alice PAN Owner", NOT the user name "John Submitter"
        $this->assertStringContainsString('Alice PAN Owner', $content);
        $this->assertStringNotContainsString('John Submitter', $content);
        $this->assertStringContainsString('XYZKL5678M', $content);
    }

    public function test_trader_rates_csv_exports_pan_holder_name(): void
    {
        $this->actingAs($this->admin);

        $pan = PanService::createPanForUser($this->user->id, [
            'pan_number' => 'PQRST9999Z',
            'account_holder_name' => 'Bob The Investor',
        ]);

        $batch = ApplicationBatchService::createBatch([
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'application_count' => 1,
            'funding_source' => 'my_money',
            'pan_ids' => [$pan->id],
        ]);

        // 2. Export Trader Rates CSV
        $response = $this->get("/ipos/{$this->ipo->id}/export/trader-csv");
        $response->assertOk();
        $content = $response->streamedContent();

        $this->assertStringContainsString('Bob The Investor', $content);
        $this->assertStringNotContainsString('John Submitter', $content);
        $this->assertStringContainsString('PQRST9999Z', $content);
    }

    public function test_sync_pan_batches_command_heals_out_of_sync_records(): void
    {
        // Simulate a legacy batch where applicant_name was not updated or is empty
        $pan = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'LMNOP3333X',
            'account_holder_name' => 'Synchronized Investor',
            'status' => 'active',
        ]);

        $batch = ApplicationBatch::create([
            'batch_number' => 'BATCH-TEST-SYNC',
            'ipo_id' => $this->ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'Old Outdated Name',
            'pan_number' => 'LMNOP3333X',
            'application_count' => 1,
            'funding_source' => 'my_money',
            'application_status' => 'confirmed',
            'settlement_status' => 'estimated',
            'trader_rate_snapshot' => 0,
            'published_rate_snapshot' => 0,
            'margin_snapshot' => 0,
            'capital_per_application' => 1000,
            'capital_amount' => 1000,
            'expected_gross_profit' => 0,
            'expected_user_payout' => 0,
            'expected_net_earnings' => 0,
        ]);

        // Run the sync command
        $this->artisan('pans:sync-batches')->assertSuccessful();

        // Verify the batch now has the updated PAN owner name
        $this->assertEquals('Synchronized Investor', $batch->fresh()->applicant_name);
    }
}
