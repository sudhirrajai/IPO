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
        Schema::create('settlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_batch_id')->constrained()->cascadeOnDelete();
            $table->date('settlement_date');
            $table->decimal('actual_gross_profit', 14, 2)->default(0);
            $table->decimal('actual_user_payout', 14, 2)->default(0);
            $table->decimal('actual_net_earnings', 14, 2)->default(0);
            $table->decimal('capital_returned', 14, 2)->default(0);
            $table->string('settlement_method', 30)->default('rate_margin');
            $table->text('notes')->nullable();
            $table->foreignId('settled_by_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('settlements');
    }
};
