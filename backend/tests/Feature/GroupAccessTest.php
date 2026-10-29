<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use App\Models\Study;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class GroupAccessTest extends TestCase
{
    use RefreshDatabase;

    /**
     * Someone with a login of their own, ready to sign in with this password.
     */
    private function personWithLogin(string $password = 'footprints'): Member
    {
        return Member::factory()->withLogin($password)->create();
    }

    public function test_group_info_is_public_and_seeds_the_xsrf_cookie(): void
    {
        $this->getJson('/api/group')
            ->assertOk()
            ->assertExactJson([
                'group_name' => 'Fruitfull Footprints',
                'tagline' => 'A private home for our small group.',
                'meeting_day' => 'Wednesday',
                'since_year' => 2023,
                'unlocked' => false,
                'viewer' => null,
            ])
            ->assertCookie('XSRF-TOKEN');
    }

    public function test_group_info_says_who_is_signed_in(): void
    {
        $leader = Member::factory()->leader()->create(['name' => 'Rachel Owens']);
        $member = Member::factory()->create(['name' => 'Sarah Lindqvist']);

        $this->asLeader($leader)->getJson('/api/group')->assertOk()
            ->assertJsonPath('unlocked', true)
            ->assertExactJson([
                'group_name' => 'Fruitfull Footprints',
                'tagline' => 'A private home for our small group.',
                'meeting_day' => 'Wednesday',
                'since_year' => 2023,
                'unlocked' => true,
                'viewer' => ['role' => 'leader', 'member_id' => $leader->id, 'name' => 'Rachel Owens'],
            ]);

        $this->asMember($member)->getJson('/api/group')
            ->assertJsonPath('viewer', ['role' => 'member', 'member_id' => $member->id, 'name' => 'Sarah Lindqvist']);

        $this->unlocked()->getJson('/api/group')
            ->assertJsonPath('unlocked', true)
            ->assertJsonPath('viewer', ['role' => 'super', 'member_id' => null, 'name' => null]);
    }

    public function test_signing_in_with_a_personal_password_opens_the_gated_routes(): void
    {
        $member = $this->personWithLogin('footprints');

        $this->getJson('/api/snapshot')->assertUnauthorized();

        $this->postJson('/api/unlock', ['password' => 'footprints'])
            ->assertOk()
            ->assertExactJson(['unlocked' => true, 'viewer' => ['role' => 'member', 'member_id' => $member->id, 'name' => $member->name]])
            ->assertSessionHas('ff_unlocked', true)
            ->assertSessionHas('ff_member_id', $member->id)
            ->assertSessionHas('ff_auth_version', $member->fresh()->auth_version);

        $this->getJson('/api/snapshot')->assertOk();
        $this->getJson('/api/group')->assertJsonPath('unlocked', true)->assertJsonPath('viewer.member_id', $member->id);
    }

    public function test_the_password_alone_says_who_signs_in(): void
    {
        $rachel = Member::factory()->leader()->withLogin('porch-light-on')->create();
        $sarah = Member::factory()->withLogin('cardamom-buns')->create();

        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertOk()->assertJsonPath('viewer.member_id', $sarah->id);
        $this->flushSession();
        $this->postJson('/api/unlock', ['password' => 'porch-light-on'])->assertOk()->assertJsonPath('viewer', ['role' => 'leader', 'member_id' => $rachel->id, 'name' => $rachel->name]);
    }

    public function test_spaces_around_a_password_do_not_matter(): void
    {
        $member = $this->personWithLogin('cardamom-buns');

        $this->postJson('/api/unlock', ['password' => '  cardamom-buns '])->assertOk()->assertJsonPath('viewer.member_id', $member->id);
    }

    public function test_the_super_admin_signs_in_with_their_own_password_and_has_no_profile(): void
    {
        $this->useSuperAdmin('a-long-way-from-home');

        $this->postJson('/api/unlock', ['password' => 'a-long-way-from-home'])
            ->assertOk()
            ->assertExactJson(['unlocked' => true, 'viewer' => ['role' => 'super', 'member_id' => null, 'name' => null]])
            ->assertSessionHas('ff_unlocked', true)
            ->assertSessionHas('ff_super');

        $this->getJson('/api/snapshot')->assertOk();
        $this->assertSame(0, Member::count());
    }

    public function test_signing_in_as_someone_else_replaces_who_the_session_is(): void
    {
        $this->useSuperAdmin('a-long-way-from-home');
        $member = $this->personWithLogin('cardamom-buns');

        $this->postJson('/api/unlock', ['password' => 'a-long-way-from-home'])->assertOk();
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])
            ->assertOk()
            ->assertSessionMissing('ff_super')
            ->assertSessionHas('ff_member_id', $member->id);

        $this->getJson('/api/group')->assertJsonPath('viewer.role', 'member');
    }

    /**
     * @return array<string, array{0: mixed}>
     */
    public static function wrongPasswords(): array
    {
        return [
            'wrong' => ['nope-nope'],
            'case differs' => ['Footprints'],
            'blank' => [''],
            'missing' => [null],
            'not a string' => [['footprints']],
        ];
    }

    #[DataProvider('wrongPasswords')]
    public function test_a_wrong_password_is_rejected_gently(mixed $password): void
    {
        $this->personWithLogin('footprints');
        $this->useSuperAdmin('a-long-way-from-home');

        $this->postJson('/api/unlock', $password === null ? [] : ['password' => $password])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'Try that once more.',
                'errors' => ['password' => ['Try that once more.']],
            ]);

        $this->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_unlock_reports_when_no_one_can_sign_in_yet(): void
    {
        Member::factory()->create(); // a person with no login doesn't count

        $this->postJson('/api/unlock', ['password' => 'anything'])
            ->assertServiceUnavailable()
            ->assertJsonStructure(['message']);
    }

    public function test_a_super_admin_alone_is_enough_to_sign_in_to(): void
    {
        $this->useSuperAdmin('a-long-way-from-home');

        $this->postJson('/api/unlock', ['password' => 'anything'])->assertUnprocessable();
    }

    public function test_a_person_without_a_login_cannot_sign_in(): void
    {
        $this->personWithLogin('footprints');
        Member::factory()->create(['name' => 'No Login']);

        $this->postJson('/api/unlock', ['password' => ''])->assertUnprocessable();
    }

    /**
     * Requests as the Next.js proxy forwards them: from loopback, carrying whatever
     * X-Forwarded-For arrived (Next passes it through and adds none).
     */
    private function forwardedFor(string $ip): static
    {
        return $this->withServerVariables(['REMOTE_ADDR' => '127.0.0.1'])->withHeader('X-Forwarded-For', $ip);
    }

    public function test_unlock_allows_ten_wrong_passwords_a_minute(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 10) as $attempt) {
            $this->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        // Even the right password waits now, or the 429 would give the answer away.
        $this->postJson('/api/unlock', ['password' => 'footprints'])
            ->assertTooManyRequests()
            ->assertJsonStructure(['message'])
            ->assertHeader('Retry-After');

        $this->travel(61)->seconds();
        $this->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
    }

    public function test_only_wrong_passwords_count_toward_the_throttle(): void
    {
        $this->personWithLogin('footprints');

        // A whole group unlocking from one Wi-Fi network on meeting night.
        foreach (range(1, 20) as $device) {
            $this->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
        }

        foreach (range(1, 10) as $attempt) {
            $this->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        $this->postJson('/api/unlock', ['password' => 'wrong'])->assertTooManyRequests();
    }

    public function test_throttling_keys_on_the_client_ip_forwarded_by_the_local_proxy(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 10) as $attempt) {
            $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'wrong'])->assertTooManyRequests();
        $this->forwardedFor('198.51.100.4')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();

        // A front proxy appends the address it saw; whatever the client put before it is ignored.
        $this->forwardedFor('198.51.100.4, 203.0.113.7')->postJson('/api/unlock', ['password' => 'footprints'])->assertTooManyRequests();
    }

    public function test_a_client_that_keeps_guessing_waits_out_the_hour_without_locking_out_others(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 3) as $minute) {
            foreach (range(1, 10) as $attempt) {
                $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
            }
            $this->travel(61)->seconds();
        }

        $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'footprints'])->assertTooManyRequests();
        $this->forwardedFor('198.51.100.4')->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();

        $this->travel(1)->hours();
        $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
    }

    public function test_rotating_forwarded_addresses_runs_into_the_group_wide_ceiling(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 100) as $n) {
            $this->forwardedFor('198.51.100.'.$n)->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        $this->forwardedFor('203.0.113.50')->postJson('/api/unlock', ['password' => 'wrong'])->assertTooManyRequests();
        $this->forwardedFor('203.0.113.51')->postJson('/api/unlock', ['password' => 'footprints'])->assertTooManyRequests();

        $this->travel(61)->minutes();
        $this->forwardedFor('203.0.113.51')->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
    }

    public function test_ipv6_clients_are_throttled_by_their_64(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 10) as $n) {
            $this->forwardedFor("2001:db8:1:2::{$n}")->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        $this->forwardedFor('2001:db8:1:2:ffff::9')->postJson('/api/unlock', ['password' => 'wrong'])->assertTooManyRequests();
        $this->forwardedFor('2001:db8:1:3::1')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
    }

    public function test_ipv4_mapped_addresses_count_as_the_ipv4_client(): void
    {
        $this->personWithLogin('footprints');

        foreach (range(1, 10) as $attempt) {
            $this->forwardedFor('203.0.113.7')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
        }

        $this->forwardedFor('::ffff:203.0.113.7')->postJson('/api/unlock', ['password' => 'wrong'])->assertTooManyRequests();
        $this->forwardedFor('::ffff:203.0.113.8')->postJson('/api/unlock', ['password' => 'wrong'])->assertUnprocessable();
    }

    public function test_locking_ends_the_session(): void
    {
        $this->personWithLogin('footprints');
        $this->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();

        $this->postJson('/api/lock')->assertNoContent()->assertCookie('XSRF-TOKEN');

        $this->getJson('/api/snapshot')->assertUnauthorized()->assertExactJson(['message' => 'Locked']);
        $this->getJson('/api/group')->assertJsonPath('unlocked', false);
    }

    public function test_locking_an_already_locked_device_is_fine(): void
    {
        $this->postJson('/api/lock')->assertNoContent();
    }

    public function test_a_session_without_the_unlocked_flag_is_locked(): void
    {
        $member = $this->personWithLogin('footprints');

        $this->withSession(['ff_member_id' => $member->id, 'ff_auth_version' => $member->auth_version])
            ->getJson('/api/snapshot')
            ->assertUnauthorized();
    }

    public function test_the_old_group_password_sessions_are_locked_out(): void
    {
        $this->personWithLogin('footprints');

        // What a device unlocked with the retired single group password still carries.
        $this->withSession(['ff_unlocked' => true, 'ff_pw_version' => 1])->getJson('/api/snapshot')->assertUnauthorized();
        $this->withSession(['ff_unlocked' => true, 'ff_pw_version' => 1])->getJson('/api/group')->assertJsonPath('unlocked', false);
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function gatedRoutes(): array
    {
        return [
            'snapshot' => ['GET', '/api/snapshot'],
            'update settings' => ['PATCH', '/api/settings'],
            'add member' => ['POST', '/api/members'],
            'update member' => ['PATCH', '/api/members/{member}'],
            'remove member' => ['DELETE', '/api/members/{member}'],
            'remove login' => ['DELETE', '/api/members/{member}/login'],
            'add date' => ['POST', '/api/members/{member}/dates'],
            'update date' => ['PATCH', '/api/dates/{date}'],
            'remove date' => ['DELETE', '/api/dates/{date}'],
            'add prayer' => ['POST', '/api/prayers'],
            'update prayer' => ['PATCH', '/api/prayers/{prayer}'],
            'delete prayer' => ['DELETE', '/api/prayers/{prayer}'],
            'answer prayer' => ['POST', '/api/prayers/{prayer}/answer'],
            'reopen prayer' => ['POST', '/api/prayers/{prayer}/reopen'],
            'add prayer update' => ['POST', '/api/prayers/{prayer}/updates'],
            'delete prayer update' => ['DELETE', '/api/prayer-updates/{update}'],
            'show study' => ['GET', '/api/studies/{study}'],
            'add study' => ['POST', '/api/studies'],
            'replace study' => ['PUT', '/api/studies/{study}'],
            'delete study' => ['DELETE', '/api/studies/{study}'],
        ];
    }

    #[DataProvider('gatedRoutes')]
    public function test_gated_routes_answer_401_when_locked(string $method, string $uri): void
    {
        $member = Member::factory()->create();
        $prayer = PrayerRequest::factory()->for($member)->create();
        $ids = [
            '{member}' => $member->id,
            '{date}' => MemberDate::factory()->for($member)->create()->id,
            '{prayer}' => $prayer->id,
            '{update}' => PrayerUpdate::factory()->for($prayer)->create()->id,
            '{study}' => Study::factory()->create()->id,
        ];

        $this->json($method, strtr($uri, $ids), ['name' => 'Changed', 'body' => 'Changed'])
            ->assertUnauthorized()
            ->assertExactJson(['message' => 'Locked']);

        $this->assertSame([1, 1, 1, 1, 1, 0], [
            Member::count(), MemberDate::count(), PrayerRequest::count(), PrayerUpdate::count(),
            Study::count(), Member::where('name', 'Changed')->count(),
        ]);
    }

    #[DataProvider('gatedRoutes')]
    public function test_gated_routes_say_locked_before_revealing_whether_a_record_exists(string $method, string $uri): void
    {
        $this->json($method, preg_replace('/\{\w+\}/', '999999', $uri))->assertUnauthorized();
    }

    public function test_unknown_ids_are_404_once_unlocked(): void
    {
        $this->unlocked()->getJson('/api/studies/999999')->assertNotFound();
        $this->unlocked()->getJson('/api/studies/not-a-number')->assertNotFound();
        $this->unlocked()->getJson('/api/nothing-here')->assertNotFound();
    }
}
