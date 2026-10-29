<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Services\Logins;
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

    /**
     * What a session carries once this person has signed in.
     *
     * @return array<string, mixed>
     */
    private function sessionOf(Member $member): array
    {
        return ['ff_unlocked' => true, 'ff_member_id' => $member->id, 'ff_auth_version' => $member->auth_version];
    }

    public function test_idle_sessions_that_are_not_signed_in_are_removed_and_signed_in_ones_kept(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();
        $reset = Member::factory()->withLogin('porch-light-on')->create();
        $loginTaken = Member::factory()->withLogin('garden-gate-open')->create();
        $before = [$this->sessionOf($reset), $this->sessionOf($loginTaken)];
        app(Logins::class)->setPassword($reset, 'a-newer-password');
        app(Logins::class)->removePassword($loginTaken);
        $fingerprint = $this->useSuperAdmin();

        $this->storeSession('anonymous-old', ['_previous' => ['url' => 'http://localhost/api/group']], idleHours: 30);
        $this->storeSession('anonymous-recent', [], idleHours: 2);
        $this->storeSession('member-old', $this->sessionOf($member), idleHours: 24 * 200);
        $this->storeSession('super-old', ['ff_unlocked' => true, 'ff_super' => $fingerprint], idleHours: 24 * 200);
        $this->storeSession('password-was-reset', $before[0], idleHours: 30);
        $this->storeSession('login-was-removed', $before[1], idleHours: 30);
        $this->storeSession('person-is-gone', ['ff_unlocked' => true, 'ff_member_id' => 999999, 'ff_auth_version' => 1], idleHours: 30);
        $this->storeSession('super-hash-changed', ['ff_unlocked' => true, 'ff_super' => str_repeat('0', 32)], idleHours: 30);
        $this->storeSession('retired-group-password', ['ff_unlocked' => true, 'ff_pw_version' => 1], idleHours: 30);
        $this->storeSession('flag-not-true', [...$this->sessionOf($member), 'ff_unlocked' => 'yes'], idleHours: 30);
        DB::table('sessions')->insert(['id' => 'garbage', 'payload' => '%%%', 'last_activity' => now()->subDays(3)->getTimestamp()]);

        $this->artisan('ff:prune-sessions')->expectsOutputToContain('Removed 8 locked sessions.')->assertSuccessful();

        $this->assertEqualsCanonicalizing(['anonymous-recent', 'member-old', 'super-old'], DB::table('sessions')->pluck('id')->all());
    }

    public function test_without_a_super_admin_their_old_sessions_go(): void
    {
        config(['group.super_admin_hash' => null]);
        $this->storeSession('super', ['ff_unlocked' => true, 'ff_super' => str_repeat('a', 32)], idleHours: 30);

        $this->artisan('ff:prune-sessions')->assertSuccessful();

        $this->assertSame(0, DB::table('sessions')->count());
    }

    public function test_it_reads_sessions_as_the_app_writes_them(): void
    {
        config(['session.driver' => 'database']);
        Member::factory()->withLogin('cardamom-buns')->create();

        $this->getJson('/api/group')->assertOk();
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertOk();
        $this->assertSame(2, DB::table('sessions')->count());

        $this->travel(2)->days();
        $this->artisan('ff:prune-sessions')->expectsOutputToContain('Removed 1 locked session.')->assertSuccessful();

        $this->assertStringContainsString('ff_member_id', base64_decode(DB::table('sessions')->sole()->payload));
    }

    public function test_encrypted_sessions_are_read_too(): void
    {
        config(['session.encrypt' => true]);
        $member = Member::factory()->withLogin('cardamom-buns')->create();

        $this->storeSession('signed-in', $this->sessionOf($member), idleHours: 48, encrypted: true);
        $this->storeSession('locked', [], idleHours: 48, encrypted: true);

        $this->artisan('ff:prune-sessions')->assertSuccessful();

        $this->assertSame(['signed-in'], DB::table('sessions')->pluck('id')->all());
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
