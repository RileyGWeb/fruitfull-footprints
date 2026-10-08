<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use App\Models\Study;
use App\Services\ActivityLog;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Exceptions;
use RuntimeException;
use Tests\TestCase;

/**
 * Writes that also log activity happen in one transaction: if the log entry fails, the client
 * gets an error and nothing is half-saved, so trying again can't create a duplicate.
 */
class AtomicWritesTest extends TestCase
{
    use RefreshDatabase;

    private function failToLog(string $entry): void
    {
        Exceptions::fake();
        $this->mock(ActivityLog::class)->shouldReceive($entry)->once()->andThrow(new RuntimeException('The activity insert failed.'));
    }

    public function test_adding_a_member(): void
    {
        $this->failToLog('memberAdded');

        $this->unlocked()->postJson('/api/members', ['name' => 'Ada Moss'])->assertServerError();

        $this->assertSame(0, Member::count());
    }

    public function test_adding_a_prayer_request(): void
    {
        $member = Member::factory()->create();
        $this->failToLog('prayerAdded');

        $this->unlocked()->postJson('/api/prayers', ['member_id' => $member->id, 'body' => 'For rest.'])->assertServerError();

        $this->assertSame(0, PrayerRequest::count());
    }

    public function test_marking_a_prayer_answered(): void
    {
        $prayer = PrayerRequest::factory()->create();
        $this->failToLog('prayerAnswered');

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/answer", ['answer' => 'He slept.'])->assertServerError();

        $this->assertSame(['active', null, null], [$prayer->fresh()->status, $prayer->fresh()->answer, $prayer->fresh()->answered_at]);
    }

    public function test_adding_a_prayer_update(): void
    {
        Carbon::setTestNow('2026-10-01 19:00:00');
        $prayer = PrayerRequest::factory()->create();
        Carbon::setTestNow('2026-10-07 19:00:00');
        $this->failToLog('prayerUpdated');

        $this->unlocked()->postJson("/api/prayers/{$prayer->id}/updates", ['body' => 'Better today.'])->assertServerError();

        $this->assertSame(0, PrayerUpdate::count());
        $this->assertSame('2026-10-01 19:00:00', $prayer->fresh()->updated_at->toDateTimeString());
    }

    public function test_creating_a_published_study(): void
    {
        $this->failToLog('studyPublished');

        $this->unlocked()->postJson('/api/studies', [
            'ref' => 'Romans 8', 'title' => 'No Condemnation', 'meeting_date' => '2026-10-14', 'sections' => [], 'status' => 'published',
        ])->assertServerError();

        $this->assertSame(0, Study::count());
    }

    public function test_publishing_a_draft(): void
    {
        $study = Study::factory()->draft()->create(['ref' => 'Romans 9', 'title' => 'God’s Purposes']);
        $this->failToLog('studyPublished');

        $this->unlocked()->putJson("/api/studies/{$study->id}", [
            'ref' => 'Romans 9', 'title' => 'God’s Purposes', 'meeting_date' => '2026-10-21', 'sections' => [], 'status' => 'published',
        ])->assertServerError();

        $this->assertSame(['draft', null], [$study->fresh()->status, $study->fresh()->published_at]);
    }
}
