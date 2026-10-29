<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\MemberDate;
use App\Services\Logins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Who can change people: leaders do anything, a member only their own profile, and the logins
 * (role and password) are the leaders' to hand out.
 */
class MemberAccessTest extends TestCase
{
    use RefreshDatabase;

    private const FORBIDDEN = ['message' => 'You don’t have access to do that.'];

    // ── adding and removing people ──────────────────────────────────────────

    public function test_a_leader_adds_a_person_with_a_role_and_a_password(): void
    {
        $response = $this->asLeader()->postJson('/api/members', [
            'name' => 'Priya Shah',
            'role' => 'leader',
            'password' => 'chai-on-the-porch',
        ])->assertCreated()->assertJsonPath('role', 'leader')->assertJsonPath('has_login', true);

        $priya = Member::findOrFail($response->json('id'));
        $this->assertSame('leader', $priya->role);
        $this->flushSession();
        $this->postJson('/api/unlock', ['password' => 'chai-on-the-porch'])
            ->assertOk()
            ->assertJsonPath('viewer', ['role' => 'leader', 'member_id' => $priya->id, 'name' => 'Priya Shah']);
    }

    public function test_a_person_is_a_member_without_a_login_unless_a_leader_says_otherwise(): void
    {
        $this->asLeader()->postJson('/api/members', ['name' => 'Priya Shah'])
            ->assertCreated()
            ->assertJsonPath('role', 'member')
            ->assertJsonPath('has_login', false);

        $this->assertNull(Member::where('name', 'Priya Shah')->sole()->password_hash);
    }

    public function test_a_bad_password_adds_nobody(): void
    {
        $this->asLeader()->postJson('/api/members', ['name' => 'Priya Shah', 'password' => 'short'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('password');

        $this->assertDatabaseMissing('members', ['name' => 'Priya Shah']);
    }

    public function test_a_member_cannot_add_people(): void
    {
        $this->asMember()->postJson('/api/members', ['name' => 'Priya Shah'])
            ->assertForbidden()
            ->assertExactJson(self::FORBIDDEN);

        $this->assertDatabaseMissing('members', ['name' => 'Priya Shah']);
    }

    public function test_a_leader_removes_people_but_not_themselves(): void
    {
        $leader = Member::factory()->leader()->create();
        $other = Member::factory()->create();

        $this->asLeader($leader)->deleteJson("/api/members/{$other->id}")->assertNoContent();
        $this->assertModelMissing($other);

        $this->asLeader($leader)->deleteJson("/api/members/{$leader->id}")->assertForbidden()->assertExactJson(self::FORBIDDEN);
        $this->assertModelExists($leader);
    }

    public function test_a_member_cannot_remove_anyone_not_even_themselves(): void
    {
        $member = Member::factory()->create();
        $other = Member::factory()->create();

        $this->asMember($member)->deleteJson("/api/members/{$other->id}")->assertForbidden();
        $this->asMember($member)->deleteJson("/api/members/{$member->id}")->assertForbidden();
        $this->assertModelExists($other);
        $this->assertModelExists($member);
    }

    public function test_the_leader_gate_answers_before_the_record_is_looked_up(): void
    {
        $this->asMember()->deleteJson('/api/members/999999')->assertForbidden();
        $this->asLeader()->deleteJson('/api/members/999999')->assertNotFound();
        $this->flushSession();
        $this->deleteJson('/api/members/999999')->assertUnauthorized();
    }

    public function test_removing_a_person_signs_them_out(): void
    {
        $member = Member::factory()->create();
        $this->asMember($member)->getJson('/api/snapshot')->assertOk();

        $member->delete();

        $this->getJson('/api/snapshot')->assertUnauthorized();
    }

    // ── editing profiles ────────────────────────────────────────────────────

    public function test_a_member_edits_their_own_profile(): void
    {
        $member = Member::factory()->create(['name' => 'Sarah Lindqvist']);

        $this->asMember($member)->patchJson("/api/members/{$member->id}", [
            'name' => 'Sarah L.',
            'tone' => 'sand',
            'gifts' => ['Faith'],
            'line' => 'Bakes buns.',
            'family' => 'Her mom, Ingrid',
            'interests' => 'Pottery',
            'good_to_know' => 'Night shifts',
        ])->assertOk()->assertJsonPath('name', 'Sarah L.')->assertJsonMissingPath('has_login');

        $this->assertSame('Sarah L.', $member->fresh()->name);
    }

    public function test_a_member_cannot_edit_someone_elses_profile(): void
    {
        $member = Member::factory()->create();
        $other = Member::factory()->create(['name' => 'Mike Brennan']);

        $this->asMember($member)->patchJson("/api/members/{$other->id}", ['name' => 'Hijacked'])
            ->assertForbidden()
            ->assertExactJson(self::FORBIDDEN);

        $this->assertSame('Mike Brennan', $other->fresh()->name);
    }

    public function test_a_leader_edits_anyones_profile(): void
    {
        $other = Member::factory()->create();

        $this->asLeader()->patchJson("/api/members/{$other->id}", ['name' => 'Renamed'])->assertOk();

        $this->assertSame('Renamed', $other->fresh()->name);
    }

    public function test_a_member_cannot_hand_themselves_leadership_or_a_password(): void
    {
        $member = Member::factory()->create();
        $this->asMember($member);

        $this->patchJson("/api/members/{$member->id}", ['role' => 'leader'])->assertForbidden();
        $this->patchJson("/api/members/{$member->id}", ['password' => 'a-brand-new-one'])->assertForbidden();
        $this->patchJson("/api/members/{$member->id}", ['name' => 'Fine', 'role' => 'member'])->assertForbidden();

        $fresh = $member->fresh();
        $this->assertSame('member', $fresh->role);
        $this->assertNotSame('Fine', $fresh->name);
        $this->assertSame($member->auth_version, $fresh->auth_version);
    }

    public function test_a_leader_changes_someones_role_and_it_counts_straight_away(): void
    {
        $member = Member::factory()->create();

        $this->asMember($member)->postJson('/api/members', ['name' => 'Nope'])->assertForbidden();

        $this->asLeader()->patchJson("/api/members/{$member->id}", ['role' => 'leader'])
            ->assertOk()
            ->assertJsonPath('role', 'leader');

        // Same device, no new sign-in.
        $this->signedInAs($member->fresh())->postJson('/api/members', ['name' => 'Welcome'])->assertCreated();

        $this->asLeader()->patchJson("/api/members/{$member->id}", ['role' => 'member'])->assertOk();
        $this->signedInAs($member->fresh())->postJson('/api/members', ['name' => 'Again'])->assertForbidden();
    }

    public function test_a_leader_cannot_step_down_themselves(): void
    {
        $leader = Member::factory()->leader()->create();

        $this->asLeader($leader)->patchJson("/api/members/{$leader->id}", ['role' => 'member'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.role', ['You can’t step down yourself. Ask another leader.']);

        $this->assertSame('leader', $leader->fresh()->role);

        $this->asLeader($leader)->patchJson("/api/members/{$leader->id}", ['role' => 'leader', 'name' => 'Still Me'])->assertOk();
    }

    public function test_a_leader_can_step_another_leader_down(): void
    {
        $other = Member::factory()->leader()->create();

        $this->asLeader()->patchJson("/api/members/{$other->id}", ['role' => 'member'])->assertOk();

        $this->assertSame('member', $other->fresh()->role);
    }

    // ── logins ──────────────────────────────────────────────────────────────

    public function test_a_leader_gives_someone_a_password_and_the_old_one_stops_working(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();

        $this->asLeader()->patchJson("/api/members/{$member->id}", ['password' => 'porch-light-on'])->assertOk();

        $this->flushSession();
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertUnprocessable();
        $this->postJson('/api/unlock', ['password' => 'porch-light-on'])->assertOk()->assertJsonPath('viewer.member_id', $member->id);
    }

    public function test_a_new_password_signs_that_person_out_everywhere(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();
        $theirDevice = ['ff_unlocked' => true, 'ff_member_id' => $member->id, 'ff_auth_version' => $member->fresh()->auth_version];
        $this->withSession($theirDevice)->getJson('/api/snapshot')->assertOk();

        $this->flushSession();
        $this->asLeader()->patchJson("/api/members/{$member->id}", ['password' => 'porch-light-on'])->assertOk();

        $this->flushSession();
        $this->withSession($theirDevice)->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_a_leader_who_changes_their_own_password_stays_signed_in(): void
    {
        $leader = Member::factory()->leader()->withLogin('cardamom-buns')->create();

        $this->signedInAs($leader->fresh())
            ->patchJson("/api/members/{$leader->id}", ['password' => 'porch-light-on'])
            ->assertOk()
            ->assertSessionHas('ff_auth_version', $leader->fresh()->auth_version);

        $this->getJson('/api/snapshot')->assertOk();
    }

    public function test_a_leader_takes_a_login_away(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();

        $this->asLeader()->deleteJson("/api/members/{$member->id}/login")
            ->assertOk()
            ->assertJsonPath('has_login', false)
            ->assertJsonPath('id', $member->id);

        $fresh = $member->fresh();
        $this->assertNull($fresh->password_hash);
        $this->assertNull($fresh->password_lookup);

        $this->flushSession();
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertUnprocessable();
    }

    public function test_a_login_taken_away_signs_the_person_out(): void
    {
        $member = Member::factory()->withLogin('cardamom-buns')->create();
        $device = ['ff_unlocked' => true, 'ff_member_id' => $member->id, 'ff_auth_version' => $member->fresh()->auth_version];
        $this->withSession($device)->getJson('/api/snapshot')->assertOk();

        app(Logins::class)->removePassword($member);

        $this->flushSession();
        $this->withSession($device)->getJson('/api/snapshot')->assertUnauthorized();
    }

    public function test_a_leader_cannot_take_their_own_login_away(): void
    {
        $leader = Member::factory()->leader()->withLogin('cardamom-buns')->create();

        $this->signedInAs($leader->fresh())->deleteJson("/api/members/{$leader->id}/login")->assertForbidden();

        $this->assertNotNull($leader->fresh()->password_hash);
    }

    public function test_a_member_cannot_take_a_login_away(): void
    {
        $other = Member::factory()->withLogin('cardamom-buns')->create();

        $this->asMember()->deleteJson("/api/members/{$other->id}/login")->assertForbidden();

        $this->assertNotNull($other->fresh()->password_hash);
    }

    public function test_only_leaders_see_who_can_sign_in(): void
    {
        $leader = Member::factory()->leader()->create();
        Member::factory()->withLogin('cardamom-buns')->create(['name' => 'Has Login']);
        Member::factory()->create(['name' => 'No Login']);

        $asLeader = collect($this->asLeader($leader)->getJson('/api/snapshot')->assertOk()->json('members'));
        $this->assertTrue($asLeader->firstWhere('name', 'Has Login')['has_login']);
        $this->assertFalse($asLeader->firstWhere('name', 'No Login')['has_login']);

        $asMember = collect($this->asMember()->getJson('/api/snapshot')->assertOk()->json('members'));
        $this->assertTrue($asMember->every(fn (array $person): bool => ! array_key_exists('has_login', $person)));
        $this->assertSame('leader', $asMember->firstWhere('id', $leader->id)['role']);
    }

    public function test_no_password_or_hash_ever_leaves_the_server(): void
    {
        Member::factory()->leader()->withLogin('cardamom-buns')->create();

        $body = $this->unlocked()->getJson('/api/snapshot')->assertOk()->getContent();

        $this->assertStringNotContainsString('cardamom-buns', $body);
        $this->assertStringNotContainsString('password', $body);
        $this->assertStringNotContainsString('$2y$', $body);
    }

    // ── dates ───────────────────────────────────────────────────────────────

    public function test_a_member_manages_dates_on_their_own_profile_only(): void
    {
        $member = Member::factory()->create();
        $mine = MemberDate::factory()->for($member)->create();
        $theirs = MemberDate::factory()->create();
        $date = ['kind' => 'event', 'label' => 'Moving day', 'date' => '2026-10-31', 'recurring' => true];

        $this->asMember($member);

        $this->postJson("/api/members/{$member->id}/dates", $date)->assertCreated();
        $this->patchJson("/api/dates/{$mine->id}", ['label' => 'Changed'])->assertOk();
        $this->deleteJson("/api/dates/{$mine->id}")->assertNoContent();

        $this->postJson("/api/members/{$theirs->member_id}/dates", $date)->assertForbidden();
        $this->patchJson("/api/dates/{$theirs->id}", ['label' => 'Changed'])->assertForbidden();
        $this->deleteJson("/api/dates/{$theirs->id}")->assertForbidden();
        $this->assertModelExists($theirs);
    }

    public function test_a_leader_manages_anyones_dates(): void
    {
        $date = MemberDate::factory()->create();

        $this->asLeader()->patchJson("/api/dates/{$date->id}", ['label' => 'Changed'])->assertOk();
        $this->deleteJson("/api/dates/{$date->id}")->assertNoContent();
    }
}
