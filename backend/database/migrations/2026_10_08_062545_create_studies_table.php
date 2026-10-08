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
        Schema::create('studies', function (Blueprint $table) {
            $table->id();
            $table->string('series', 120)->nullable();
            $table->string('ref', 120)->nullable();
            $table->string('title', 160)->nullable();
            $table->string('passage', 160)->nullable();
            $table->date('meeting_date')->index();
            $table->string('location', 160)->nullable();
            $table->text('description')->nullable();
            $table->jsonb('sections')->default('[]');
            $table->string('status', 20)->default('draft');
            $table->timestamp('published_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('studies');
    }
};
