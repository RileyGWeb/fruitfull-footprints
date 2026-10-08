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
        Schema::create('members', function (Blueprint $table) {
            $table->id();
            $table->string('name', 120);
            $table->string('tone', 10);
            $table->jsonb('gifts')->default('[]');
            $table->string('line', 280)->nullable();
            $table->text('family')->nullable();
            $table->text('interests')->nullable();
            $table->text('good_to_know')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('members');
    }
};
