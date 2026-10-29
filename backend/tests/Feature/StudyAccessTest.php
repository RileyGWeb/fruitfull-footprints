<?php

namespace Tests\Feature;

use App\Models\Study;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Leaders write the studies. Members read the published ones; drafts never reach them.
 */
class StudyAccessTest extends TestCase
{
    use RefreshDatabase;

    private const STUDY = ['meeting_date' => '2026-10-21', 'status' => 'draft', 'sections' => []];

    public function test_a_member_cannot_write_studies(): void
    {
        $study = Study::factory()->create(['title' => 'Original']);
        $this->asMember();

        $this->postJson('/api/studies', self::STUDY)->assertForbidden();
        $this->putJson("/api/studies/{$study->id}", [...self::STUDY, 'title' => 'Hijacked'])->assertForbidden();
        $this->deleteJson("/api/studies/{$study->id}")->assertForbidden();

        $this->assertSame(1, Study::count());
        $this->assertSame('Original', $study->fresh()->title);
    }

    public function test_a_leader_writes_studies(): void
    {
        $this->asLeader();

        $id = $this->postJson('/api/studies', self::STUDY)->assertCreated()->json('id');
        $this->putJson("/api/studies/{$id}", [...self::STUDY, 'title' => 'Renamed'])->assertOk();
        $this->deleteJson("/api/studies/{$id}")->assertNoContent();
    }

    public function test_a_member_reads_a_published_study(): void
    {
        $study = Study::factory()->create();

        $this->asMember()->getJson("/api/studies/{$study->id}")->assertOk()->assertJsonPath('id', $study->id);
    }

    public function test_a_draft_is_not_there_for_a_member(): void
    {
        $draft = Study::factory()->draft()->create();

        $this->asMember()->getJson("/api/studies/{$draft->id}")->assertNotFound();
        $this->asLeader()->getJson("/api/studies/{$draft->id}")->assertOk();
        $this->unlocked()->getJson("/api/studies/{$draft->id}")->assertOk();
    }

    public function test_a_member_sees_published_studies_in_the_snapshot_and_a_leader_sees_all(): void
    {
        $published = Study::factory()->create();
        $draft = Study::factory()->draft()->create();

        $this->assertSame([$published->id], collect($this->asMember()->getJson('/api/snapshot')->assertOk()->json('studies'))->pluck('id')->all());

        $this->assertEqualsCanonicalizing(
            [$published->id, $draft->id],
            collect($this->asLeader()->getJson('/api/snapshot')->json('studies'))->pluck('id')->all(),
        );
    }

    public function test_a_study_moved_back_to_drafts_disappears_for_members(): void
    {
        $study = Study::factory()->create();

        $this->asLeader()->putJson("/api/studies/{$study->id}", [
            'meeting_date' => $study->meeting_date->toDateString(),
            'ref' => $study->ref,
            'title' => $study->title,
            'sections' => [],
            'status' => 'draft',
        ])->assertOk();

        $this->asMember()->getJson("/api/studies/{$study->id}")->assertNotFound();
        $this->assertSame([], $this->getJson('/api/snapshot')->json('studies'));
    }
}
