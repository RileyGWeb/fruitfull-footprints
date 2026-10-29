<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Each person can have a login of their own: a role (member or leader) and a password. The
     * password alone says who is signing in, so `password_lookup` (a keyed hash of it, unique)
     * finds the person and `password_hash` (bcrypt) confirms it. `auth_version` goes up whenever
     * the password changes or is removed, which signs out that person's other devices.
     */
    public function up(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->string('role', 10)->default('member');
            $table->string('password_hash')->nullable();
            $table->string('password_lookup', 64)->nullable()->unique();
            $table->unsignedInteger('auth_version')->default(1);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('members', function (Blueprint $table) {
            $table->dropColumn(['role', 'password_hash', 'password_lookup', 'auth_version']);
        });
    }
};
