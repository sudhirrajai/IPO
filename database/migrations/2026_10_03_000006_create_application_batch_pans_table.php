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
        Schema::create('application_batch_pans', function (Blueprint $table) {
            $table->id();
            $table->foreignId('application_batch_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_pan_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('sequence_number')->default(1);
            $table->string('pan_number_snapshot', 10);
            $table->string('allotment_status', 30)->default('pending'); // 'pending', 'allotted', 'not_allotted'
            $table->unsignedInteger('allotted_shares')->default(0);
            $table->text('notes')->nullable();
            $table->timestamps();

            $table->index(['application_batch_id', 'user_pan_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('application_batch_pans');
    }
};
