<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class PrayerUpdateTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_update_can_be_added_to_a_request(): void
    {
        Carbon::setTestNow('2026-10-01 19:00:00');
        $prayer = PrayerRequest::factory()->for(Member::factory()->state(['name' => 'Hannah Pruitt']))->create();

        Carbon::setTestNow('2026-10-07 20:15:00');
        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/updates", [
            'body' => 'Lease is signed. Packing this weekend — any spare boxes?',
        ])->assertCreated()->assertExactJson([
            'id' => PrayerUpdate::sole()->id,
            'prayer_request_id' => $prayer->id,
            'body' => 'Lease is signed. Packing this weekend — any spare boxes?',
            'created_at' => '2026-10-07T20:15:00.000000Z',
        ]);

        $this->assertDatabaseHas('activities', ['kind' => 'prayer_updated', 'text' => 'Hannah’s request has an update']);
        $this->assertSame('2026-10-07 20:15:00', $prayer->fresh()->updated_at->toDateTimeString());
    }

    public function test_updates_come_back_oldest_first_on_the_request(): void
    {
        $prayer = PrayerRequest::factory()->create();

        foreach (['First', 'Second', 'Third'] as $body) {
            $this->unlocked()->postJson("/api/prayers/{$prayer->id}/updates", ['body' => $body])->assertCreated();
        }

        $this->unlocked()->patchJson("/api/prayers/{$prayer->id}", [])
            ->assertOk()
            ->assertJsonPath('updates.*.body', ['First', 'Second', 'Third']);
    }

    public function test_updates_are_validated(): void
    {
        $prayer = PrayerRequest::factory()->create();

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/updates", ['body' => ''])->assertJsonValidationErrors('body');
        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/updates", ['body' => str_repeat('a', 2001)])->assertJsonValidationErrors('body');
        $this->unlocked()->postJson('/api/prayers/999/updates', ['body' => 'Hello'])->assertNotFound();

        $this->assertSame(0, PrayerUpdate::count());
        $this->assertSame(0, Activity::count());
    }

    public function test_an_update_can_be_removed(): void
    {
        $update = PrayerUpdate::factory()->create();

        $this->unlocked()->deleteJson("/api/prayer-updates/{$update->id}")->assertNoContent();

        $this->assertModelMissing($update);
        $this->assertModelExists($update->prayerRequest);
        $this->unlocked()->deleteJson("/api/prayer-updates/{$update->id}")->assertNotFound();
    }
}
