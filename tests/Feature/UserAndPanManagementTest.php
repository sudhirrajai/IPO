<?php

namespace Tests\Feature;

use App\Models\ApplicationBatch;
use App\Models\ApplicationBatchPan;
use App\Models\Ipo;
use App\Models\User;
use App\Models\UserPan;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class UserAndPanManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->admin = User::factory()->create([
            'role' => 'admin',
            'status' => 'active',
        ]);

        $this->user = User::factory()->create([
            'role' => 'user',
            'status' => 'active',
        ]);
    }

    public function test_admin_can_toggle_user_status(): void
    {
        $response = $this->actingAs($this->admin)->post(route('users.toggle', $this->user));

        $response->assertSessionHas('success');
        $this->assertEquals('inactive', $this->user->fresh()->status);

        // Toggle back to active
        $response = $this->actingAs($this->admin)->post(route('users.toggle', $this->user));
        $this->assertEquals('active', $this->user->fresh()->status);
    }

    public function test_admin_cannot_deactivate_themselves(): void
    {
        $response = $this->actingAs($this->admin)->post(route('users.toggle', $this->admin));

        $response->assertSessionHas('error');
        $this->assertEquals('active', $this->admin->fresh()->status);
    }

    public function test_admin_can_safely_delete_and_archive_user_keeping_data_safe(): void
    {
        $pan = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'ABCDE1234F',
            'account_holder_name' => 'John Doe',
            'status' => 'active',
        ]);

        $ipo = Ipo::create([
            'company_name' => 'Safe IPO Ltd',
            'exchange' => 'NSE',
            'lot_size' => 100,
            'status' => 'open',
            'provider' => 'manual',
        ]);

        $batch = ApplicationBatch::create([
            'batch_number' => 'BATCH-TEST-SAFE',
            'ipo_id' => $ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'John Doe',
            'application_count' => 1,
            'funding_source' => 'my_money',
            'application_status' => 'submitted',
            'submission_date' => now()->toDateString(),
        ]);

        // Delete with keep_data_safe = true (default)
        $response = $this->actingAs($this->admin)->delete(route('users.destroy', $this->user), [
            'keep_data_safe' => true,
        ]);

        $response->assertSessionHas('success');

        // User should be soft-deleted and status set to archived
        $this->assertSoftDeleted($this->user);
        $archivedUser = User::withTrashed()->find($this->user->id);
        $this->assertEquals('archived', $archivedUser->status);

        // Application batch and PAN must remain 100% intact!
        $this->assertDatabaseHas('application_batches', [
            'id' => $batch->id,
            'user_id' => $this->user->id,
        ]);

        // Relations should resolve without error
        $this->assertNotNull($batch->fresh()->user);
        $this->assertEquals($this->user->name, $batch->fresh()->user->name);

        // Restore user
        $restoreResponse = $this->actingAs($this->admin)->post(route('users.restore', $this->user->id));
        $restoreResponse->assertSessionHas('success');
        $this->assertFalse($this->user->fresh()->trashed());
        $this->assertEquals('active', $this->user->fresh()->status);
    }

    public function test_admin_cannot_permanently_delete_user_with_existing_applications(): void
    {
        $ipo = Ipo::create([
            'company_name' => 'Safe IPO Ltd 2',
            'exchange' => 'BSE',
            'lot_size' => 50,
            'status' => 'open',
            'provider' => 'manual',
        ]);

        ApplicationBatch::create([
            'batch_number' => 'BATCH-TEST-PROTECTED',
            'ipo_id' => $ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'John Doe',
            'application_count' => 1,
            'funding_source' => 'my_money',
            'application_status' => 'submitted',
            'submission_date' => now()->toDateString(),
        ]);

        // Permanent deletion attempt without keep_data_safe
        $response = $this->actingAs($this->admin)->delete(route('users.destroy', $this->user), [
            'keep_data_safe' => false,
        ]);

        $response->assertSessionHas('error');
        $this->assertDatabaseHas('users', ['id' => $this->user->id]);
    }

    public function test_user_can_edit_their_pan(): void
    {
        $pan = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'ABCDE1234F',
            'account_holder_name' => 'Old Name',
            'broker_name' => 'Zerodha',
            'status' => 'active',
        ]);

        $response = $this->actingAs($this->user)->put(route('pans.update', $pan), [
            'pan_number' => 'FGHIJ5678K',
            'account_holder_name' => 'Updated Name',
            'broker_name' => 'Groww',
            'notes' => 'Updated Notes',
            'status' => 'inactive',
        ]);

        $response->assertSessionHas('success');

        $pan->refresh();
        $this->assertEquals('FGHIJ5678K', $pan->pan_number);
        $this->assertEquals('Updated Name', $pan->account_holder_name);
        $this->assertEquals('Groww', $pan->broker_name);
        $this->assertEquals('inactive', $pan->status);
    }

    public function test_user_can_delete_their_pan_with_soft_delete_safety(): void
    {
        $pan = UserPan::create([
            'user_id' => $this->user->id,
            'pan_number' => 'ABCDE1234F',
            'account_holder_name' => 'John Doe',
            'status' => 'active',
        ]);

        $ipo = Ipo::create([
            'company_name' => 'Safe IPO Ltd 3',
            'exchange' => 'NSE',
            'lot_size' => 10,
            'status' => 'open',
            'provider' => 'manual',
        ]);

        $batch = ApplicationBatch::create([
            'batch_number' => 'BATCH-PAN-SAFE',
            'ipo_id' => $ipo->id,
            'user_id' => $this->user->id,
            'applicant_name' => 'John Doe',
            'application_count' => 1,
            'funding_source' => 'my_money',
            'application_status' => 'submitted',
            'submission_date' => now()->toDateString(),
        ]);

        $batchPan = ApplicationBatchPan::create([
            'application_batch_id' => $batch->id,
            'user_pan_id' => $pan->id,
            'sequence_number' => 1,
            'pan_number_snapshot' => $pan->pan_number,
        ]);

        $response = $this->actingAs($this->user)->delete(route('pans.destroy', $pan));

        $response->assertSessionHas('success');

        // PAN should be soft-deleted
        $this->assertSoftDeleted($pan);

        // Historical batch pan and application batch remain intact
        $this->assertDatabaseHas('application_batch_pans', [
            'id' => $batchPan->id,
            'user_pan_id' => $pan->id,
        ]);

        // userPan relation with withTrashed works cleanly
        $this->assertNotNull($batchPan->fresh()->userPan);
        $this->assertEquals('ABCDE1234F', $batchPan->fresh()->userPan->pan_number);
    }
}
