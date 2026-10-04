<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('user_favorite_ipos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('ipo_id')->constrained()->cascadeOnDelete();
            $table->timestamps();

            $table->unique(['user_id', 'ipo_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_favorite_ipos');
    }
};
