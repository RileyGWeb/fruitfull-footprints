<?php

namespace Database\Seeders;

use App\Services\Settings;
use Illuminate\Database\Seeder;

/**
 * What a fresh install needs: the default settings. Safe to run again (the deploy does, every
 * time); it never overwrites anything. Logins are not seeded: the super admin comes from the
 * environment (config/group.php) and gives everyone else theirs.
 */
class DatabaseSeeder extends Seeder
{
    public function run(Settings $settings): void
    {
        $missing = array_diff_key(Settings::DEFAULTS, $settings->stored());

        if ($missing !== []) {
            $settings->set($missing);
        }
    }
}
