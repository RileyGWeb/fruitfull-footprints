<?php

namespace Tests\Feature;

use App\Services\Settings;
use Illuminate\Console\Scheduling\Event;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Tests\TestCase;

class PruneLockedSessionsCommandTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Store a session row the way the database session driver writes one.
     *
     * @param  array<string, mixed>  $data
     */
    private function storeSession(string $id, array $data, int $idleHours, bool $encrypted = false): void
    {
        $payload = json_encode(['_token' => 'token', ...$data]);

        DB::table('sessions')->insert([
            'id' => $id,
            'payload' => base64_encode($encrypted ? Crypt::encrypt($payload) : $payload),
            'last_activity' => now()->subHours($idleHours)->getTimestamp(),
        ]);
    }

    public function test_idle_locked_sessions_are_removed_and_unlocked_ones_kept(): void
    {
        $this->setGroupPassword('footprints');
        $version = app(Settings::class)->passwordVersion();

        $this->storeSession('anonymous-old', ['_previous' => ['url' => 'http://localhost/api/group']], idleHours: 30);
        $this->storeSession('anonymous-recent', [], idleHours: 2);
        $this->storeSession('unlocked-old', ['ff_unlocked' => true, 'ff_pw_version' => $version], idleHours: 24 * 200);
        $this->storeSession('old-password', ['ff_unlocked' => true, 'ff_pw_version' => $version - 1], idleHours: 30);
        $this->storeSession('flag-not-true', ['ff_unlocked' => 'yes', 'ff_pw_version' => $version], idleHours: 30);
        DB::table('sessions')->insert(['id' => 'garbage', 'payload' => '%%%', 'last_activity' => now()->subDays(3)->getTimestamp()]);

        $this->artisan('ff:prune-sessions')->expectsOutputToContain('Removed 4 locked sessions.')->assertSuccessful();

        $this->assertEqualsCanonicalizing(['anonymous-recent', 'unlocked-old'], DB::table('sessions')->pluck('id')->all());
    }

    public function test_it_reads_sessions_as_the_app_writes_them(): void
    {
        config(['session.driver' => 'database']);
        $this->setGroupPassword('footprints');

        $this->getJson('/api/group')->assertOk();
        $this->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
        $this->assertSame(2, DB::table('sessions')->count());

        $this->travel(2)->days();
        $this->artisan('ff:prune-sessions')->expectsOutputToContain('Removed 1 locked session.')->assertSuccessful();

        $this->assertStringContainsString('ff_unlocked', base64_decode(DB::table('sessions')->sole()->payload));
    }

    public function test_encrypted_sessions_are_read_too(): void
    {
        config(['session.encrypt' => true]);
        $version = app(Settings::class)->passwordVersion();

        $this->storeSession('unlocked', ['ff_unlocked' => true, 'ff_pw_version' => $version], idleHours: 48, encrypted: true);
        $this->storeSession('locked', [], idleHours: 48, encrypted: true);

        $this->artisan('ff:prune-sessions')->assertSuccessful();

        $this->assertSame(['unlocked'], DB::table('sessions')->pluck('id')->all());
    }

    public function test_the_idle_window_can_be_changed(): void
    {
        $this->storeSession('anonymous', [], idleHours: 2);

        $this->artisan('ff:prune-sessions', ['--hours' => 1])->assertSuccessful();

        $this->assertSame(0, DB::table('sessions')->count());
    }

    public function test_it_runs_daily(): void
    {
        $events = collect(app(Schedule::class)->events())
            ->filter(fn (Event $event): bool => str_contains((string) $event->command, 'ff:prune-sessions'));

        $this->assertSame(['0 0 * * *'], $events->pluck('expression')->all());
    }
}
