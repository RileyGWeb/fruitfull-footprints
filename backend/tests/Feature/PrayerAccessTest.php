<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Anyone signed in adds requests and updates. Changing a request is for leaders and for the
 * person it is about.
 */
class PrayerAccessTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_adds_a_request_for_anyone(): void
    {
        $member = Member::factory()->create();
        $other = Member::factory()->create();

        $this->asMember($member)->postJson('/api/prayers', ['member_id' => $other->id, 'body' => 'Pray for her week.'])
            ->assertCreated()
            ->assertJsonPath('member_id', $other->id);

        $this->postJson('/api/prayers', ['member_id' => $member->id, 'body' => 'And for me.'])->assertCreated();
    }

    public function test_a_member_adds_an_update_to_any_request(): void
    {
        $prayer = PrayerRequest::factory()->create();

        $this->asMember()->postJson("/api/prayers/{$prayer->id}/updates", ['body' => 'She is home.'])->assertCreated();
    }

    public function test_a_member_manages_requests_about_themselves(): void
    {
        $member = Member::factory()->create();
        $prayer = PrayerRequest::factory()->for($member)->create();
        $this->asMember($member);

        $this->patchJson("/api/prayers/{$prayer->id}", ['body' => 'Reworded.'])->assertOk()->assertJsonPath('body', 'Reworded.');
        $this->postJson("/api/prayers/{$prayer->id}/answer", ['answer' => 'It came through.'])->assertOk()->assertJsonPath('status', 'answered');
        $this->patchJson("/api/prayers/{$prayer->id}", ['answer' => 'Better words.'])->assertOk();
        $this->postJson("/api/prayers/{$prayer->id}/reopen")->assertOk()->assertJsonPath('status', 'active');
        $this->deleteJson("/api/prayers/{$prayer->id}")->assertNoContent();
    }

    public function test_a_member_removes_an_update_on_a_request_about_themselves(): void
    {
        $member = Member::factory()->create();
        $update = PrayerUpdate::factory()->for(PrayerRequest::factory()->for($member))->create();

        $this->asMember($member)->deleteJson("/api/prayer-updates/{$update->id}")->assertNoContent();
    }

    public function test_a_member_cannot_manage_requests_about_other_people(): void
    {
        $prayer = PrayerRequest::factory()->create(['body' => 'Original.']);
        $update = PrayerUpdate::factory()->for($prayer)->create();
        $this->asMember();

        $this->patchJson("/api/prayers/{$prayer->id}", ['body' => 'Hijacked.'])->assertForbidden();
        $this->postJson("/api/prayers/{$prayer->id}/answer")->assertForbidden();
        $this->postJson("/api/prayers/{$prayer->id}/reopen")->assertForbidden();
        $this->deleteJson("/api/prayers/{$prayer->id}")->assertForbidden();
        $this->deleteJson("/api/prayer-updates/{$update->id}")->assertForbidden();

        $this->assertSame('Original.', $prayer->fresh()->body);
        $this->assertSame('active', $prayer->fresh()->status);
        $this->assertModelExists($update);
    }

    public function test_a_member_cannot_hand_their_request_to_someone_else_or_take_one_over(): void
    {
        $member = Member::factory()->create();
        $other = Member::factory()->create();
        $mine = PrayerRequest::factory()->for($member)->create();
        $theirs = PrayerRequest::factory()->for($other)->create();
        $this->asMember($member);

        $this->patchJson("/api/prayers/{$mine->id}", ['member_id' => $other->id])->assertForbidden();
        $this->patchJson("/api/prayers/{$theirs->id}", ['member_id' => $member->id])->assertForbidden();

        $this->assertSame($member->id, $mine->fresh()->member_id);
        $this->assertSame($other->id, $theirs->fresh()->member_id);

        // Naming themselves again is not a move.
        $this->patchJson("/api/prayers/{$mine->id}", ['member_id' => (string) $member->id, 'body' => 'Same person.'])->assertOk();
    }

    public function test_a_leader_manages_every_request_and_can_move_one(): void
    {
        $prayer = PrayerRequest::factory()->create();
        $other = Member::factory()->create();
        $this->asLeader();

        $this->patchJson("/api/prayers/{$prayer->id}", ['member_id' => $other->id, 'body' => 'Moved.'])->assertOk()->assertJsonPath('member_id', $other->id);
        $this->postJson("/api/prayers/{$prayer->id}/answer")->assertOk();
        $this->postJson("/api/prayers/{$prayer->id}/reopen")->assertOk();
        $this->deleteJson("/api/prayers/{$prayer->id}")->assertNoContent();
    }

    public function test_the_permission_check_comes_before_validation(): void
    {
        $prayer = PrayerRequest::factory()->create();

        $this->asMember()->patchJson("/api/prayers/{$prayer->id}", ['body' => ''])->assertForbidden();
    }
}
