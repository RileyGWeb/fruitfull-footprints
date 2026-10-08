<?php

namespace Tests;

use App\Services\Settings;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;

abstract class TestCase extends BaseTestCase
{
    /**
     * Make the following requests from a device that unlocked with the current password.
     */
    protected function unlocked(): static
    {
        return $this->withSession([
            'ff_unlocked' => true,
            'ff_pw_version' => app(Settings::class)->passwordVersion(),
        ]);
    }

    /**
     * Store a group password, as `php artisan ff:password` would.
     */
    protected function setGroupPassword(string $password = 'footprints'): int
    {
        return app(Settings::class)->changePassword($password);
    }
}
