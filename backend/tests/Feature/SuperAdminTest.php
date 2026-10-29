<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use App\Models\Study;
use App\Services\Settings;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * The hidden super admin: signs in with a password from the server's environment, belongs to no
 * profile, and can do everything.
 */
class SuperAdminTest extends TestCase
{
    use RefreshDatabase;

    private const PASSWORD = 'a long way from home!';

    protected function setUp(): void
    {
        parent::setUp();

        // A hash made the way an operator would (plain PHP, `$2y$` and all), not by the test helper.
        config(['group.super_admin_hash' => password_hash(self::PASSWORD, PASSWORD_BCRYPT, ['cost' => 4])]);
    }

    public function test_they_sign_in_with_their_password_alone(): void
    {
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])
            ->assertOk()
            ->assertExactJson(['unlocked' => true, 'viewer' => ['role' => 'super', 'member_id' => null, 'name' => null]]);

        $this->getJson('/api/snapshot')->assertOk();
    }

    public function test_a_wrong_or_empty_password_does_not(): void
    {
        $this->postJson('/api/unlock', ['password' => 'a long way from home'])->assertUnprocessable();
        $this->postJson('/api/unlock', ['password' => ''])->assertUnprocessable();
        $this->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_they_are_nobody_in_the_group(): void
    {
        Member::factory()->count(2)->create();

        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertOk();

        $snapshot = $this->getJson('/api/snapshot')->assertOk();
        $this->assertCount(2, $snapshot->json('members'));
        $this->assertSame(2, Member::count());
        $this->assertSame(0, Activity::count());
    }

    public function test_they_can_do_what_a_leader_can_and_see_what_a_leader_sees(): void
    {
        $draft = Study::factory()->draft()->create();
        $other = Member::factory()->withLogin('cardamom-buns')->create();
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertOk();

        $snapshot = $this->getJson('/api/snapshot')->assertOk();
        $this->assertContains($draft->id, collect($snapshot->json('studies'))->pluck('id')->all());
        $this->assertTrue($snapshot->json('members.0.has_login'));

        $this->patchJson('/api/settings', ['group_name' => 'Porch Group'])->assertOk();
        $created = $this->postJson('/api/members', ['name' => 'Priya Shah', 'role' => 'leader', 'password' => 'chai-on-the-porch'])->assertCreated();
        $this->patchJson("/api/members/{$other->id}", ['role' => 'leader', 'password' => 'a-brand-new-one'])->assertOk();
        $this->deleteJson("/api/members/{$other->id}/login")->assertOk();
        $this->postJson('/api/studies', ['meeting_date' => '2026-10-21', 'status' => 'draft', 'sections' => []])->assertCreated();
        $this->deleteJson("/api/studies/{$draft->id}")->assertNoContent();
        $this->deleteJson('/api/members/'.$created->json('id'))->assertNoContent();

        $this->assertSame('Porch Group', app(Settings::class)->get('group_name'));
    }

    public function test_they_can_manage_any_prayer_and_any_date(): void
    {
        $prayer = PrayerRequest::factory()->create();
        $date = MemberDate::factory()->create();
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertOk();

        $this->patchJson("/api/prayers/{$prayer->id}", ['body' => 'Edited.'])->assertOk();
        $this->postJson("/api/prayers/{$prayer->id}/answer")->assertOk();
        $this->patchJson("/api/dates/{$date->id}", ['label' => 'Changed'])->assertOk();
    }

    public function test_a_new_hash_in_the_environment_signs_them_out(): void
    {
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertOk();
        $this->getJson('/api/snapshot')->assertOk();

        config(['group.super_admin_hash' => password_hash('another password entirely', PASSWORD_BCRYPT, ['cost' => 4])]);

        $this->getJson('/api/snapshot')->assertUnauthorized();
        $this->getJson('/api/group')->assertJsonPath('unlocked', false);
    }

    public function test_without_a_hash_in_the_environment_there_is_no_super_admin(): void
    {
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertOk();

        config(['group.super_admin_hash' => null]);

        $this->getJson('/api/snapshot')->assertUnauthorized();
        $this->flushSession();
        $this->postJson('/api/unlock', ['password' => self::PASSWORD])->assertServiceUnavailable();
    }

    public function test_a_members_password_can_never_be_the_super_admins(): void
    {
        $this->asLeader()->postJson('/api/members', ['name' => 'Priya Shah', 'password' => self::PASSWORD])
            ->assertUnprocessable()
            ->assertJsonPath('errors.password', ['Someone else already uses that password. Try another.']);
    }
}
