<?php

namespace Tests\Feature;

use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SettingsTest extends TestCase
{
    use RefreshDatabase;

    public function test_any_subset_of_settings_can_be_updated(): void
    {
        $this->unlocked()->patchJson('/api/settings', ['meeting_day' => 'Thursday', 'since_year' => '2019'])
            ->assertOk()
            ->assertExactJson([
                'group_name' => 'Fruitfull Footprints',
                'tagline' => 'A private home for our small group.',
                'meeting_day' => 'Thursday',
                'meeting_time' => '7pm',
                'meeting_place' => 'Rachel’s porch',
                'since_year' => 2019,
            ]);

        $this->assertSame('"Thursday"', DB::table('settings')->where('key', 'meeting_day')->value('value'));
        $this->unlocked()->getJson('/api/snapshot')->assertJsonPath('settings.since_year', 2019);
        $this->getJson('/api/group')->assertJsonPath('meeting_day', 'Thursday');
    }

    public function test_every_setting_can_be_changed_at_once(): void
    {
        $settings = [
            'group_name' => 'Tuesday Night Group',
            'tagline' => 'Friends who read together.',
            'meeting_day' => 'Tuesday',
            'meeting_time' => '6:30pm',
            'meeting_place' => 'The Hales’ kitchen',
            'since_year' => 2024,
        ];

        $this->unlocked()->patchJson('/api/settings', $settings)->assertOk()->assertExactJson($settings);
    }

    public function test_the_tagline_can_be_cleared(): void
    {
        $this->unlocked()->patchJson('/api/settings', ['tagline' => ''])->assertOk()->assertJsonPath('tagline', '');
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidSettings(): array
    {
        return [
            'blank group name' => [['group_name' => ''], 'group_name'],
            'long group name' => [['group_name' => str_repeat('a', 121)], 'group_name'],
            'unknown weekday' => [['meeting_day' => 'Someday'], 'meeting_day'],
            'lowercase weekday' => [['meeting_day' => 'wednesday'], 'meeting_day'],
            'blank time' => [['meeting_time' => ''], 'meeting_time'],
            'blank place' => [['meeting_place' => ''], 'meeting_place'],
            'year not a number' => [['since_year' => 'long ago'], 'since_year'],
            'year out of range' => [['since_year' => 1066], 'since_year'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidSettings')]
    public function test_settings_are_validated(array $payload, string $field): void
    {
        $this->unlocked()->patchJson('/api/settings', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    public function test_unknown_keys_are_ignored(): void
    {
        $this->unlocked()->patchJson('/api/settings', ['password_version' => 99, 'password_hash' => 'x'])->assertOk();

        $this->assertSame(1, app(Settings::class)->passwordVersion());
        $this->assertFalse(app(Settings::class)->hasPassword());
    }

    public function test_the_password_can_be_changed_with_the_current_one(): void
    {
        $version = $this->setGroupPassword('footprints');

        $this->unlocked()->putJson('/api/settings/password', [
            'current_password' => 'footprints',
            'password' => 'mustard-seed',
            'password_confirmation' => 'mustard-seed',
        ])->assertNoContent()->assertSessionHas('ff_pw_version', $version + 1);

        $settings = app(Settings::class);
        $this->assertSame($version + 1, $settings->passwordVersion());
        $this->assertTrue(Hash::check('mustard-seed', json_decode(DB::table('settings')->where('key', 'password_hash')->value('value'))));
        $this->assertTrue($settings->checkPassword('mustard-seed'));
        $this->assertFalse($settings->checkPassword('footprints'));
    }

    /**
     * @return array<string, array{0: array<string, string>, 1: string}>
     */
    public static function invalidPasswordChanges(): array
    {
        return [
            'wrong current password' => [['current_password' => 'nope', 'password' => 'mustard-seed', 'password_confirmation' => 'mustard-seed'], 'current_password'],
            'missing current password' => [['password' => 'mustard-seed', 'password_confirmation' => 'mustard-seed'], 'current_password'],
            'current password not text' => [['current_password' => ['footprints'], 'password' => 'mustard-seed', 'password_confirmation' => 'mustard-seed'], 'current_password'],
            'too short' => [['current_password' => 'footprints', 'password' => 'abc', 'password_confirmation' => 'abc'], 'password'],
            'not confirmed' => [['current_password' => 'footprints', 'password' => 'mustard-seed', 'password_confirmation' => 'mustard-seeds'], 'password'],
        ];
    }

    /**
     * @param  array<string, string>  $payload
     */
    #[DataProvider('invalidPasswordChanges')]
    public function test_password_changes_are_validated(array $payload, string $field): void
    {
        $version = $this->setGroupPassword('footprints');

        $this->unlocked()->putJson('/api/settings/password', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame($version, app(Settings::class)->passwordVersion());
        $this->assertTrue(app(Settings::class)->checkPassword('footprints'));
    }

    public function test_settings_are_read_with_one_query_per_request(): void
    {
        $this->unlocked();
        $this->app->forgetScopedInstances(); // start the request with nothing cached, like a real one
        DB::enableQueryLog();

        $this->getJson('/api/snapshot')->assertOk();

        $settingsQueries = collect(DB::getQueryLog())->filter(fn (array $query): bool => str_contains($query['query'], '"settings"'));
        $this->assertCount(1, $settingsQueries);
    }
}
