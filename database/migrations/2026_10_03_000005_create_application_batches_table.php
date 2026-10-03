<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('application_batches', function (Blueprint $table) {
            $table->id();
            $table->string('batch_number', 50)->unique();
            $table->foreignId('ipo_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('rate_id')->nullable()->constrained('ipo_rates')->nullOnDelete();
            $table->unsignedInteger('application_count')->default(1);
            $table->string('funding_source', 20)->default('my_money')->index(); // 'my_money', 'user_money'

            // Immutable rate snapshots at time of batch creation
            $table->decimal('trader_rate_snapshot', 12, 2);
            $table->decimal('published_rate_snapshot', 12, 2);
            $table->decimal('margin_snapshot', 12, 2);

            // Capital details
            $table->decimal('capital_per_application', 14, 2)->default(0);
            $table->decimal('capital_amount', 14, 2)->default(0);

            // Estimated calculations
            $table->decimal('expected_gross_profit', 14, 2)->default(0);
            $table->decimal('expected_user_payout', 14, 2)->default(0);
            $table->decimal('expected_net_earnings', 14, 2)->default(0);

            // Realized / settled amounts
            $table->decimal('settled_gross_profit', 14, 2)->nullable();
            $table->decimal('settled_user_payout', 14, 2)->nullable();
            $table->decimal('settled_net_earnings', 14, 2)->nullable();
            $table->decimal('capital_returned', 14, 2)->nullable();

            // Statuses
            $table->string('application_status', 30)->default('draft')->index(); // 'draft', 'ready', 'submitted', 'confirmed', 'pending_allotment', 'allotted', 'not_allotted', 'cancelled'
            $table->string('settlement_status', 30)->default('estimated')->index(); // 'estimated', 'partially_settled', 'settled', 'cancelled'

            // Additional details
            $table->string('trader_reference')->nullable();
            $table->date('submission_date')->nullable();
            $table->text('notes')->nullable();
            $table->foreignId('created_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['ipo_id', 'user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_batches');
    }
};
