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
        Schema::create('user_pans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('pan_number', 10);
            $table->string('account_holder_name')->nullable();
            $table->string('broker_name')->nullable();
            $table->text('notes')->nullable();
            $table->string('verification_status', 30)->default('unverified');
            $table->string('status', 20)->default('active')->index();
            $table->timestamps();

            $table->unique(['user_id', 'pan_number']);
            $table->index(['pan_number']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('user_pans');
    }
};
