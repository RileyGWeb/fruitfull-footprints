<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class PrayerTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_prayer_request_can_be_added_for_a_member(): void
    {
        Carbon::setTestNow('2026-10-07 19:00:00');
        $member = Member::factory()->create(['name' => 'David Hale']);

        $response = $this->unlocked()->postJson('/api/prayers', [
            'member_id' => $member->id,
            'body' => '  Wisdom for my granddaughter as she chooses a college.  ',
        ]);

        $response->assertCreated()->assertExactJson([
            'id' => PrayerRequest::sole()->id,
            'member_id' => $member->id,
            'body' => 'Wisdom for my granddaughter as she chooses a college.',
            'status' => 'active',
            'answer' => null,
            'answered_at' => null,
            'created_at' => '2026-10-07T19:00:00.000000Z',
            'updates' => [],
        ]);

        $this->assertDatabaseHas('activities', ['kind' => 'prayer_added', 'text' => 'New prayer request for David']);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidPrayers(): array
    {
        return [
            'no member' => [['body' => 'Pray'], 'member_id'],
            'unknown member' => [['member_id' => 999, 'body' => 'Pray'], 'member_id'],
            'member id not a number' => [['member_id' => 'sarah', 'body' => 'Pray'], 'member_id'],
            'no body' => [['member_id' => 'MEMBER'], 'body'],
            'blank body' => [['member_id' => 'MEMBER', 'body' => '   '], 'body'],
            'long body' => [['member_id' => 'MEMBER', 'body' => str_repeat('a', 2001)], 'body'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidPrayers')]
    public function test_new_prayer_requests_are_validated(array $payload, string $field): void
    {
        $member = Member::factory()->create();
        $payload = array_map(fn (mixed $value): mixed => $value === 'MEMBER' ? $member->id : $value, $payload);

        $this->unlocked()->postJson('/api/prayers', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame(0, PrayerRequest::count());
        $this->assertSame(0, Activity::count());
    }

    public function test_member_ids_come_back_as_numbers_even_when_sent_as_strings(): void
    {
        [$sarah, $mike] = Member::factory()->count(2)->create()->all();

        $created = $this->unlocked()->postJson('/api/prayers', ['member_id' => (string) $sarah->id, 'body' => 'Pray'])
            ->assertCreated()
            ->assertJsonPath('member_id', $sarah->id);

        $this->unlocked()->patchJson("/api/prayers/{$created->json('id')}", ['member_id' => (string) $mike->id])
            ->assertOk()
            ->assertJsonPath('member_id', $mike->id);
    }

    public function test_a_boolean_is_not_a_member_id(): void
    {
        Member::factory()->create();

        $this->unlocked()->postJson('/api/prayers', ['member_id' => true, 'body' => 'Pray'])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['member_id' => 'Pick someone from the group.']);

        $this->assertSame(0, PrayerRequest::count());
    }

    public function test_the_text_and_person_can_be_edited(): void
    {
        $prayer = PrayerRequest::factory()->create();
        $other = Member::factory()->create();

        $this->unlocked()->patchJson("/api/prayers/{$prayer->id}", ['body' => 'Edited request'])
            ->assertOk()
            ->assertJson(['body' => 'Edited request', 'member_id' => $prayer->member_id]);

        $this->unlocked()->patchJson("/api/prayers/{$prayer->id}", ['member_id' => $other->id])
            ->assertOk()
            ->assertJson(['body' => 'Edited request', 'member_id' => $other->id]);

        $this->unlocked()->patchJson("/api/prayers/{$prayer->id}", ['body' => '', 'member_id' => 999])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['body', 'member_id']);

        $this->assertSame(0, Activity::count());
    }

    public function test_an_answer_is_only_kept_on_answered_requests(): void
    {
        $active = PrayerRequest::factory()->create();
        $answered = PrayerRequest::factory()->answered()->create(['answer' => 'She said yes.']);

        $this->unlocked()->patchJson("/api/prayers/{$active->id}", ['answer' => 'Too soon'])
            ->assertOk()
            ->assertJson(['status' => 'active', 'answer' => null]);

        $this->unlocked()->patchJson("/api/prayers/{$answered->id}", ['answer' => 'She said yes, twice.'])
            ->assertOk()
            ->assertJson(['status' => 'answered', 'answer' => 'She said yes, twice.']);

        $this->unlocked()->patchJson("/api/prayers/{$answered->id}", ['answer' => null])
            ->assertOk()
            ->assertJson(['answer' => null]);
    }

    public function test_marking_a_request_answered_stamps_it_and_logs_it(): void
    {
        Carbon::setTestNow('2026-10-07 19:30:00');
        $prayer = PrayerRequest::factory()->for(Member::factory()->state(['name' => 'Sarah Lindqvist']))->create();

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer", [
            'answer' => 'Second week was so much better. Found a rhythm with the night shifts.',
        ])->assertOk()->assertJson([
            'id' => $prayer->id,
            'status' => 'answered',
            'answer' => 'Second week was so much better. Found a rhythm with the night shifts.',
            'answered_at' => '2026-10-07T19:30:00.000000Z',
        ]);

        $this->assertDatabaseHas('activities', ['kind' => 'prayer_answered', 'text' => 'Sarah’s prayer was marked answered']);
    }

    public function test_a_request_can_be_answered_without_words(): void
    {
        $prayer = PrayerRequest::factory()->create();

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer")
            ->assertOk()
            ->assertJson(['status' => 'answered', 'answer' => null]);
    }

    public function test_answering_an_answered_request_only_edits_the_answer(): void
    {
        $prayer = PrayerRequest::factory()->answered()->create(['answered_at' => '2026-09-09 19:00:00', 'answer' => 'Got the offer.']);

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer", ['answer' => 'Got the offer. Starting September 28.'])
            ->assertOk()
            ->assertJson([
                'answer' => 'Got the offer. Starting September 28.',
                'answered_at' => '2026-09-09T19:00:00.000000Z',
            ]);

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer")->assertOk()->assertJsonPath('answer', 'Got the offer. Starting September 28.');
        $this->assertSame(0, Activity::count());
    }

    public function test_answers_are_validated(): void
    {
        $prayer = PrayerRequest::factory()->create();

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer", ['answer' => str_repeat('a', 2001)])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('answer');

        $this->assertSame('active', $prayer->fresh()->status);
    }

    public function test_an_answered_request_can_be_reopened(): void
    {
        $prayer = PrayerRequest::factory()->answered()->create();

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/reopen")
            ->assertOk()
            ->assertJson(['status' => 'active', 'answer' => null, 'answered_at' => null]);
    }

    public function test_deleting_a_request_removes_its_updates(): void
    {
        $prayer = PrayerRequest::factory()->create();
        PrayerUpdate::factory()->for($prayer)->count(2)->create();

        $this->unlocked()->deleteJson("/api/prayers/{$prayer->id}")->assertNoContent();

        $this->assertModelMissing($prayer);
        $this->assertSame(0, PrayerUpdate::count());
        $this->assertModelExists($prayer->member);
    }

    public function test_missing_requests_are_404(): void
    {
        foreach (['patch' => '', 'delete' => '', 'post' => '/answer'] as $method => $suffix) {
            $this->unlocked()->json($method, "/api/prayers/999{$suffix}")->assertNotFound();
        }

        $this->unlocked()->postJson('/api/prayers/999/reopen')->assertNotFound();
    }
}
