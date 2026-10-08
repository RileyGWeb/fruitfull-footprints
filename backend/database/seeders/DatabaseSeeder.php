<?php

namespace Database\Seeders;

use App\Services\Settings;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * What a fresh install needs: default settings, plus the group password from GROUP_PASSWORD
 * when none is set yet. Safe to run again; it never overwrites anything.
 */
class DatabaseSeeder extends Seeder
{
    public function run(Settings $settings): void
    {
        $missing = array_diff_key(Settings::DEFAULTS, $settings->stored());

        if ($missing !== []) {
            $settings->set($missing);
        }

        $password = config('group.password');

        if (! $settings->hasPassword() && filled($password)) {
            $settings->set(['password_hash' => Hash::make($password)]);
        }
    }
}
