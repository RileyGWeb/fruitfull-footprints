<?php

namespace Tests\Feature;

use App\Models\Member;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class SetLoginCommandTest extends TestCase
{
    use RefreshDatabase;

    public function test_it_gives_someone_a_password_by_id(): void
    {
        $member = Member::factory()->create();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--password' => 'cardamom-buns'])->assertSuccessful();

        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertOk()->assertJsonPath('viewer.member_id', $member->id);
    }

    public function test_it_finds_someone_by_their_name_in_any_case(): void
    {
        $member = Member::factory()->create(['name' => 'Rachel Owens']);

        $this->artisan('ff:login', ['member' => 'rachel owens', '--password' => 'porch-light-on', '--role' => 'leader'])->assertSuccessful();

        $this->assertSame('leader', $member->fresh()->role);
        $this->postJson('/api/unlock', ['password' => 'porch-light-on'])->assertOk()->assertJsonPath('viewer.role', 'leader');
    }

    public function test_it_changes_only_the_role_when_that_is_all_it_is_asked(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();
        $version = $member->fresh()->auth_version;

        $this->artisan('ff:login', ['member' => (string) $member->id, '--role' => 'leader'])->assertSuccessful();

        $fresh = $member->fresh();
        $this->assertSame('leader', $fresh->role);
        $this->assertSame($version, $fresh->auth_version);
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertOk();
    }

    public function test_it_asks_for_the_password_when_none_is_given(): void
    {
        $member = Member::factory()->create(['name' => 'Rachel Owens']);

        $this->artisan('ff:login', ['member' => (string) $member->id])
            ->expectsQuestion('New password for Rachel Owens', 'porch-light-on')
            ->assertSuccessful();

        $this->postJson('/api/unlock', ['password' => 'porch-light-on'])->assertOk();
    }

    public function test_a_new_password_signs_the_other_devices_out(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();
        $device = ['ff_unlocked' => true, 'ff_member_id' => $member->id, 'ff_auth_version' => $member->fresh()->auth_version];
        $this->withSession($device)->getJson('/api/snapshot')->assertOk();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--password' => 'porch-light-on'])->assertSuccessful();

        $this->flushSession();
        $this->withSession($device)->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_it_refuses_a_password_that_will_not_do(): void
    {
        $member = Member::factory()->create();
        Member::factory()->withLogin('cardamom-buns')->create();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--password' => 'short'])->assertFailed();
        $this->artisan('ff:login', ['member' => (string) $member->id, '--password' => 'password123'])->assertFailed();
        $this->artisan('ff:login', ['member' => (string) $member->id, '--password' => 'cardamom-buns'])->assertFailed();

        $this->assertNull($member->fresh()->password_hash);
    }

    public function test_it_takes_a_login_away(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--remove' => true])->assertSuccessful();

        $this->assertNull($member->fresh()->password_hash);
    }

    public function test_it_will_not_remove_and_set_at_once(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--remove' => true, '--password' => 'porch-light-on'])->assertFailed();
        $this->artisan('ff:login', ['member' => (string) $member->id, '--remove' => true, '--role' => 'leader'])->assertFailed();

        $this->assertNotNull($member->fresh()->password_hash);
        $this->assertSame('member', $member->fresh()->role);
    }

    public function test_it_refuses_a_role_that_does_not_exist(): void
    {
        $member = Member::factory()->create();

        $this->artisan('ff:login', ['member' => (string) $member->id, '--role' => 'boss', '--password' => 'cardamom-buns'])->assertFailed();

        $this->assertNull($member->fresh()->password_hash);
        $this->assertSame('member', $member->fresh()->role);
    }

    public function test_it_says_when_it_cannot_tell_who_is_meant(): void
    {
        Member::factory()->count(2)->create(['name' => 'Sam Lee']);

        $this->artisan('ff:login', ['member' => 'Nobody Here', '--password' => 'cardamom-buns'])->assertFailed();
        $this->artisan('ff:login', ['member' => '999999', '--password' => 'cardamom-buns'])->assertFailed();
        $this->artisan('ff:login', ['member' => 'sam lee', '--password' => 'cardamom-buns'])->assertFailed();

        $this->assertSame(0, Member::whereNotNull('password_hash')->count());
    }
}
