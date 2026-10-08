<?php

namespace Tests\Feature;

use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SetGroupPasswordCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_sets_the_password_and_bumps_the_version(): void
    {
        $this->artisan('ff:password', ['--password' => 'mustard-seed'])->assertSuccessful();

        $settings = app(Settings::class);
        $this->assertTrue($settings->checkPassword('mustard-seed'));
        $this->assertSame(2, $settings->passwordVersion());

        $this->postJson('/api/unlock', ['password' => 'mustard-seed'])->assertOk();
    }

    public function test_it_locks_devices_unlocked_with_the_old_password(): void
    {
        $this->setGroupPassword('footprints');
        $this->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();

        $this->artisan('ff:password', ['--password' => 'mustard-seed'])->assertSuccessful();

        $this->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_it_prompts_when_no_password_is_given(): void
    {
        $this->artisan('ff:password')
            ->expectsQuestion('New group password', 'mustard-seed')
            ->assertSuccessful();

        $this->assertTrue(app(Settings::class)->checkPassword('mustard-seed'));
    }

    public function test_it_refuses_a_short_password(): void
    {
        $this->artisan('ff:password', ['--password' => 'abc'])->assertFailed();

        $this->assertFalse(app(Settings::class)->hasPassword());
        $this->assertSame(1, app(Settings::class)->passwordVersion());
    }
}
