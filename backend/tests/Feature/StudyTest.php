<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Study;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class StudyTest extends TestCase
{
    use RefreshDatabase;

    /**
     * @param  array<string, mixed>  $overrides
     * @return array<string, mixed>
     */
    private function payload(array $overrides = []): array
    {
        return [
            'series' => null,
            'ref' => 'Romans 9',
            'title' => 'God’s Purposes',
            'passage' => 'Romans 9:1–24',
            'meeting_date' => '2026-10-21',
            'location' => null,
            'description' => 'A hard chapter, honestly.',
            'sections' => [
                ['id' => 's1', 'type' => 'text', 'heading' => 'Opening Thought', 'body' => "Para one.\n\nPara two."],
                ['id' => 's2', 'type' => 'scripture', 'ref' => 'Romans 9:1–2', 'text' => 'I tell the truth in Christ.'],
                ['id' => 's3', 'type' => 'questions', 'heading' => 'Discussion Questions', 'items' => ['Why grief first?']],
            ],
            'status' => 'draft',
            ...$overrides,
        ];
    }

    public function test_a_study_is_shown_with_its_sections(): void
    {
        $study = Study::factory()->create(['meeting_date' => '2026-10-14', 'location' => 'The Hales’']);

        $this->unlocked()->getJson("/api/studies/{$study->id}")
            ->assertOk()
            ->assertJson([
                'id' => $study->id,
                'series' => 'Romans',
                'ref' => $study->ref,
                'meeting_date' => '2026-10-14',
                'location' => 'The Hales’',
                'status' => 'published',
                'sections' => $study->sections,
            ])
            ->assertJsonStructure(['published_at', 'verse', 'updated_at']);
    }

    public function test_a_draft_needs_only_a_meeting_date(): void
    {
        $this->unlocked()->postJson('/api/studies', ['meeting_date' => '2026-10-28', 'sections' => [], 'status' => 'draft'])
            ->assertCreated()
            ->assertJson([
                'series' => null,
                'ref' => null,
                'title' => null,
                'meeting_date' => '2026-10-28',
                'status' => 'draft',
                'published_at' => null,
                'verse' => null,
                'sections' => [],
            ]);

        $this->assertSame(0, Activity::count());
    }

    public function test_saving_a_draft_does_not_log_anything(): void
    {
        $response = $this->unlocked()->postJson('/api/studies', $this->payload())->assertCreated();

        $this->assertSame('Romans', $response->json('series'));
        $this->assertNull($response->json('published_at'));
        $this->assertSame(0, Activity::count());
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidStudies(): array
    {
        return [
            'no meeting date' => [['meeting_date' => null], 'meeting_date'],
            'bad meeting date' => [['meeting_date' => '2026-02-30'], 'meeting_date'],
            'meeting date in year 0' => [['meeting_date' => '0000-01-01'], 'meeting_date'],
            'meeting date in year 1' => [['meeting_date' => '0001-01-01'], 'meeting_date'],
            'meeting date before 1900' => [['meeting_date' => '1899-12-31'], 'meeting_date'],
            'meeting date after 2200' => [['meeting_date' => '2201-01-01'], 'meeting_date'],
            'expected version not a date' => [['expected_updated_at' => 'yesterday-ish'], 'expected_updated_at'],
            'no status' => [['status' => null], 'status'],
            'unknown status' => [['status' => 'archived'], 'status'],
            'publishing without a ref' => [['status' => 'published', 'ref' => ''], 'ref'],
            'publishing without a title' => [['status' => 'published', 'title' => null], 'title'],
            'long ref' => [['ref' => str_repeat('a', 121)], 'ref'],
            'long title' => [['title' => str_repeat('a', 161)], 'title'],
            'long series' => [['series' => str_repeat('a', 121)], 'series'],
            'long location' => [['location' => str_repeat('a', 161)], 'location'],
            'long description' => [['description' => str_repeat('a', 2001)], 'description'],
            'sections missing' => [['sections' => null], 'sections'],
            'too many sections' => [['sections' => array_fill(0, 61, ['type' => 'text'])], 'sections'],
            'unknown section type' => [['sections' => [['type' => 'poem']]], 'sections.0.type'],
            'section without a type' => [['sections' => [['heading' => 'Hi']]], 'sections.0.type'],
            'section id too long' => [['sections' => [['id' => str_repeat('x', 41), 'type' => 'text']]], 'sections.0.id'],
            'section body too long' => [['sections' => [['type' => 'text', 'body' => str_repeat('a', 20001)]]], 'sections.0.body'],
            'too many questions' => [['sections' => [['type' => 'questions', 'items' => array_fill(0, 41, 'Why?')]]], 'sections.0.items'],
            'question not text' => [['sections' => [['type' => 'questions', 'items' => [['nested']]]]], 'sections.0.items.0'],
        ];
    }

    /**
     * @param  array<string, mixed>  $overrides
     */
    #[DataProvider('invalidStudies')]
    public function test_studies_are_validated(array $overrides, string $field): void
    {
        $this->unlocked()->postJson('/api/studies', $this->payload($overrides))
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame(0, Study::count());
    }

    public function test_meeting_dates_out_of_range_get_a_plain_message(): void
    {
        $this->unlocked()->postJson('/api/studies', $this->payload(['meeting_date' => '0000-01-01']))
            ->assertUnprocessable()
            ->assertJsonPath('errors.meeting_date', ['Pick a date between 1900 and 2200.']);

        $this->unlocked()->postJson('/api/studies', $this->payload(['meeting_date' => '1900-01-01']))->assertCreated();
        $this->unlocked()->postJson('/api/studies', $this->payload(['meeting_date' => '2200-12-31']))->assertCreated();
    }

    public function test_creating_a_published_study_stamps_and_logs_it(): void
    {
        Carbon::setTestNow('2026-10-05 19:00:00');

        $this->unlocked()->postJson('/api/studies', $this->payload(['ref' => 'Romans 8', 'status' => 'published']))
            ->assertCreated()
            ->assertJson(['status' => 'published', 'published_at' => '2026-10-05T19:00:00.000000Z']);

        $this->assertDatabaseHas('activities', ['kind' => 'study_published', 'text' => 'Romans 8 study notes were published']);
    }

    public function test_publishing_a_draft_stamps_and_logs_it_once(): void
    {
        $study = Study::factory()->draft()->create(['ref' => 'Romans 9']);

        Carbon::setTestNow('2026-10-18 09:00:00');
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['status' => 'published']))
            ->assertOk()
            ->assertJson(['status' => 'published', 'published_at' => '2026-10-18T09:00:00.000000Z']);

        Carbon::setTestNow('2026-10-19 09:00:00');
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['status' => 'published', 'title' => 'Edited']))
            ->assertOk()
            ->assertJson(['title' => 'Edited', 'published_at' => '2026-10-18T09:00:00.000000Z']);

        $this->assertSame(['Romans 9 study notes were published'], Activity::pluck('text')->all());
    }

    public function test_moving_a_study_back_to_drafts_clears_published_at(): void
    {
        $study = Study::factory()->create();

        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['status' => 'draft']))
            ->assertOk()
            ->assertJson(['status' => 'draft', 'published_at' => null]);

        Carbon::setTestNow('2026-10-20 12:00:00');
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['status' => 'published']))
            ->assertOk()
            ->assertJson(['published_at' => '2026-10-20T12:00:00.000000Z']);

        $this->assertSame(1, Activity::where('kind', 'study_published')->count());
    }

    public function test_a_save_replaces_the_whole_study(): void
    {
        $study = Study::factory()->create(['location' => 'The park', 'passage' => 'Romans 1:1', 'series' => 'Custom']);

        $this->unlocked()->putJson("/api/studies/{$study->id}", [
            'meeting_date' => '2026-11-04',
            'sections' => [],
            'status' => 'draft',
        ])->assertOk()->assertJson([
            'ref' => null,
            'title' => null,
            'passage' => null,
            'location' => null,
            'description' => null,
            'series' => null,
            'meeting_date' => '2026-11-04',
            'sections' => [],
        ]);
    }

    public function test_a_save_of_the_version_the_client_loaded_goes_through(): void
    {
        Carbon::setTestNow('2026-10-05 19:00:00');
        $study = Study::factory()->draft()->create();
        $loaded = $this->unlocked()->getJson("/api/studies/{$study->id}")->json('updated_at');

        Carbon::setTestNow('2026-10-06 08:30:00');
        $saved = $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['expected_updated_at' => $loaded]))
            ->assertOk()
            ->assertJson(['title' => 'God’s Purposes', 'updated_at' => '2026-10-06T08:30:00.000000Z']);

        // The version a save returns is the one to send with the next save, straight away.
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload([
            'title' => 'Again', 'expected_updated_at' => $saved->json('updated_at'),
        ]))->assertOk()->assertJson(['title' => 'Again']);
    }

    public function test_the_expected_version_may_come_at_any_iso_precision(): void
    {
        Carbon::setTestNow('2026-10-05 19:00:00');
        $study = Study::factory()->draft()->create();

        Carbon::setTestNow('2026-10-06 08:30:00');
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['expected_updated_at' => '2026-10-05T19:00:00.000Z']))
            ->assertOk();
    }

    public function test_a_save_of_a_version_changed_elsewhere_is_refused_with_the_current_study(): void
    {
        Carbon::setTestNow('2026-10-05 19:00:00');
        $study = Study::factory()->draft()->create(['ref' => 'Romans 9']);
        $loaded = $this->unlocked()->getJson("/api/studies/{$study->id}")->json('updated_at');

        // Someone else saves first…
        Carbon::setTestNow('2026-10-05 19:05:00');
        $current = $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['title' => 'Theirs']))
            ->assertOk()
            ->json();

        // …so publishing the version loaded earlier changes nothing and logs nothing.
        Carbon::setTestNow('2026-10-05 19:10:00');
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload([
            'title' => 'Mine', 'status' => 'published', 'expected_updated_at' => $loaded,
        ]))
            ->assertConflict()
            ->assertExactJson(['message' => 'This study was changed somewhere else.', 'study' => $current]);

        $this->assertSame(['Theirs', 'draft'], [$study->fresh()->title, $study->fresh()->status]);
        $this->assertSame('2026-10-05T19:05:00.000000Z', $study->fresh()->updated_at->toJSON());
        $this->assertSame(0, Activity::count());

        // Keeping mine anyway: the same save without an expected version overwrites.
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload(['title' => 'Mine', 'status' => 'published']))
            ->assertOk()
            ->assertJson(['title' => 'Mine', 'status' => 'published']);
    }

    public function test_a_new_study_ignores_an_expected_version(): void
    {
        $this->unlocked()->postJson('/api/studies', $this->payload(['expected_updated_at' => '2020-01-01T00:00:00.000000Z']))
            ->assertCreated()
            ->assertJsonMissingPath('expected_updated_at');
    }

    /**
     * @return array<string, array{0: ?string, 1: ?string, 2: ?string}>
     */
    public static function seriesCases(): array
    {
        return [
            'chapter' => [null, 'Romans 9', 'Romans'],
            'chapter and verse' => [null, '1 John 3:1', '1 John'],
            'verse range with en dash' => [null, 'Romans 8:1–17', 'Romans'],
            'chapter range with hyphen' => [null, 'Genesis 1-3', 'Genesis'],
            'chapter range with en dash' => [null, 'Genesis 1–3', 'Genesis'],
            'psalm' => [null, 'Psalm 120', 'Psalm'],
            'book only' => [null, 'Song of Songs', 'Song of Songs'],
            'blank series is derived' => ['', 'James 2', 'James'],
            'explicit series wins' => ['Psalms of Ascent', 'Psalm 121', 'Psalms of Ascent'],
            'no ref, no series' => [null, null, null],
        ];
    }

    #[DataProvider('seriesCases')]
    public function test_the_series_is_derived_from_the_ref_when_blank(?string $series, ?string $ref, ?string $expected): void
    {
        $this->unlocked()->postJson('/api/studies', $this->payload(['series' => $series, 'ref' => $ref]))
            ->assertCreated()
            ->assertJsonPath('series', $expected);
    }

    public function test_blank_question_lines_do_not_count_toward_the_forty_question_limit(): void
    {
        // The editor sends one item per textarea line, so blank lines between questions are normal.
        $lines = collect(range(1, 40))->flatMap(fn (int $n): array => ["Question {$n}?", '', '   '])->all();

        $this->unlocked()->postJson('/api/studies', $this->payload(['sections' => [
            ['type' => 'questions', 'heading' => 'Discussion Questions', 'items' => $lines],
        ]]))
            ->assertCreated()
            ->assertJsonCount(40, 'sections.0.items')
            ->assertJsonPath('sections.0.items.39', 'Question 40?');
    }

    public function test_sections_are_sanitised(): void
    {
        $response = $this->unlocked()->postJson('/api/studies', $this->payload(['sections' => [
            ['id' => 'keep-me', 'type' => 'text', 'heading' => 'Opening', 'body' => 'Hello', 'items' => ['x'], 'evil' => '<script>'],
            ['type' => 'scripture', 'ref' => 'Romans 9:1', 'text' => 'I tell the truth.', 'heading' => 'dropped'],
            ['id' => 'keep-me', 'type' => 'questions', 'heading' => 'Discuss', 'items' => ['  One  ', '', null, '   ', 'Two'], 'body' => 'dropped'],
            ['type' => 'reflect'],
            ['type' => 'prayer', 'heading' => 'Closing Prayer', 'body' => 'Amen.'],
            ['type' => 'questions'],
        ]]))->assertCreated();

        $sections = $response->json('sections');

        $this->assertSame(['id' => 'keep-me', 'type' => 'text', 'heading' => 'Opening', 'body' => 'Hello'], $sections[0]);
        $this->assertSame(['type' => 'scripture', 'ref' => 'Romans 9:1', 'text' => 'I tell the truth.'], array_diff_key($sections[1], ['id' => 0]));
        $this->assertSame(['type' => 'questions', 'heading' => 'Discuss', 'items' => ['One', 'Two']], array_diff_key($sections[2], ['id' => 0]));
        $this->assertSame(['type' => 'reflect', 'heading' => null, 'body' => ''], array_diff_key($sections[3], ['id' => 0]));
        $this->assertSame(['type' => 'prayer', 'heading' => 'Closing Prayer', 'body' => 'Amen.'], array_diff_key($sections[4], ['id' => 0]));
        $this->assertSame(['type' => 'questions', 'heading' => null, 'items' => []], array_diff_key($sections[5], ['id' => 0]));

        $ids = array_column($sections, 'id');
        $this->assertCount(6, array_unique($ids), 'every section gets a unique id');
        $this->assertNotSame('keep-me', $ids[2], 'a duplicate client id is replaced');
        $this->assertEquals($sections, Study::sole()->sections); // jsonb stores object keys in its own order

        // Saving the study back keeps the ids the server assigned.
        $this->unlocked()->putJson('/api/studies/'.$response->json('id'), $this->payload(['sections' => $sections]))
            ->assertOk()
            ->assertJsonPath('sections.*.id', $ids);
    }

    public function test_the_verse_is_a_pull_quote_from_the_first_scripture_section(): void
    {
        $study = Study::factory()->create(['sections' => Study::sanitizeSections([
            ['type' => 'text', 'heading' => 'Opening Thought', 'body' => 'Not this.'],
            ['type' => 'scripture', 'ref' => 'Romans 8:1', 'text' => ''],
            ['type' => 'scripture', 'ref' => 'Romans 8:1–2', 'text' => 'There is therefore now no condemnation to those who are in Christ Jesus, who don’t walk according to the flesh, but according to the Spirit.'],
            ['type' => 'scripture', 'ref' => 'Romans 8:14', 'text' => 'Not this either.'],
        ])]);

        $this->unlocked()->getJson("/api/studies/{$study->id}")
            ->assertJsonPath('verse', 'There is therefore now no condemnation to those who are in Christ Jesus…');
    }

    /**
     * @return array<string, array{0: string, 1: string}>
     */
    public static function verseCases(): array
    {
        return [
            'short verse stays whole' => ['Jesus wept.', 'Jesus wept.'],
            'cut at the first break past 40 characters' => [
                'For I don’t know what I am doing. For I don’t practice what I desire to do; but what I hate, that I do.',
                'For I don’t know what I am doing. For I don’t practice what I desire to do…',
            ],
            'quoted exclamation is not a break' => [
                'I was glad when they said to me, “Let’s go to Yahweh’s house!”',
                'I was glad when they said to me, “Let’s go to Yahweh’s house!”',
            ],
            'whitespace collapsed' => ["My help comes from Yahweh,\n   who made heaven and earth.", 'My help comes from Yahweh, who made heaven and earth.'],
        ];
    }

    #[DataProvider('verseCases')]
    public function test_verse_excerpts(string $text, string $expected): void
    {
        $study = Study::factory()->make(['sections' => [['id' => 'a', 'type' => 'scripture', 'ref' => null, 'text' => $text]]]);

        $this->assertSame($expected, $study->verse);
    }

    public function test_a_study_without_scripture_has_no_verse(): void
    {
        $study = Study::factory()->make(['sections' => [['id' => 'a', 'type' => 'text', 'heading' => null, 'body' => 'Hi']]]);

        $this->assertNull($study->verse);
    }

    public function test_a_study_can_be_deleted(): void
    {
        $study = Study::factory()->create();

        $this->unlocked()->deleteJson("/api/studies/{$study->id}")->assertNoContent();

        $this->assertModelMissing($study);
        $this->unlocked()->getJson("/api/studies/{$study->id}")->assertNotFound();
        $this->unlocked()->putJson("/api/studies/{$study->id}", $this->payload())->assertNotFound();
        $this->unlocked()->deleteJson("/api/studies/{$study->id}")->assertNotFound();
    }
}
