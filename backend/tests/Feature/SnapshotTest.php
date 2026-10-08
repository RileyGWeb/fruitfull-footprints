<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use App\Models\Study;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\TestCase;

class SnapshotTest extends TestCase
{
    use RefreshDatabase;

    public function test_an_empty_install_returns_defaults_and_empty_lists(): void
    {
        Carbon::setTestNow('2026-10-07 18:30:00');

        $this->unlocked()->getJson('/api/snapshot')
            ->assertOk()
            ->assertExactJson([
                'settings' => [
                    'group_name' => 'Fruitfull Footprints',
                    'tagline' => 'A private home for our small group.',
                    'meeting_day' => 'Wednesday',
                    'meeting_time' => '7pm',
                    'meeting_place' => 'Rachel’s porch',
                    'since_year' => 2023,
                ],
                'members' => [],
                'prayers' => [],
                'studies' => [],
                'activity' => [],
                'server_time' => '2026-10-07T18:30:00.000000Z',
            ]);
    }

    public function test_it_returns_every_resource_in_the_documented_shape(): void
    {
        $member = Member::factory()->create(['name' => 'Rachel Owens', 'gifts' => ['Mercy']]);
        MemberDate::factory()->for($member)->create(['month' => 10, 'day' => 11]);
        $prayer = PrayerRequest::factory()->for($member)->create();
        PrayerUpdate::factory()->for($prayer)->create();
        Study::factory()->create();
        Activity::factory()->create();

        $this->unlocked()->getJson('/api/snapshot')
            ->assertOk()
            ->assertJsonStructure([
                'settings' => ['group_name', 'tagline', 'meeting_day', 'meeting_time', 'meeting_place', 'since_year'],
                'members' => [[
                    'id', 'name', 'tone', 'gifts', 'line', 'family', 'interests', 'good_to_know', 'created_at',
                    'dates' => [['id', 'member_id', 'kind', 'label', 'month', 'day', 'year', 'recurring']],
                ]],
                'prayers' => [[
                    'id', 'member_id', 'body', 'status', 'answer', 'answered_at', 'created_at',
                    'updates' => [['id', 'prayer_request_id', 'body', 'created_at']],
                ]],
                'studies' => [[
                    'id', 'series', 'ref', 'title', 'passage', 'meeting_date', 'location', 'description',
                    'status', 'published_at', 'verse', 'updated_at',
                ]],
                'activity' => [['id', 'kind', 'text', 'created_at']],
                'server_time',
            ])
            ->assertJsonMissingPath('studies.0.sections')
            ->assertJsonMissingPath('settings.password_hash')
            ->assertJsonMissingPath('settings.password_version')
            ->assertJsonPath('members.0.id', $member->id)
            ->assertJsonPath('members.0.gifts', ['Mercy'])
            ->assertJsonPath('members.0.dates.0.month', 10)
            ->assertJsonPath('members.0.dates.0.recurring', true);
    }

    public function test_lists_are_ordered_for_the_client(): void
    {
        foreach (['Sarah Lindqvist', 'Ben Carter', 'Mike Brennan'] as $name) {
            Member::factory()->create(['name' => $name]);
        }

        $older = PrayerRequest::factory()->create(['created_at' => '2026-09-01 19:00:00']);
        $newer = PrayerRequest::factory()->create(['created_at' => '2026-10-01 19:00:00']);
        $middle = PrayerRequest::factory()->create(['created_at' => '2026-09-15 19:00:00']);
        $late = PrayerUpdate::factory()->for($older)->create(['created_at' => '2026-09-20 19:00:00']);
        $early = PrayerUpdate::factory()->for($older)->create(['created_at' => '2026-09-05 19:00:00']);

        $july = Study::factory()->create(['meeting_date' => '2026-07-01']);
        $october = Study::factory()->draft()->create(['meeting_date' => '2026-10-21']);
        $september = Study::factory()->create(['meeting_date' => '2026-09-30']);

        foreach (range(1, 25) as $day) {
            Activity::factory()->create(['created_at' => Carbon::parse('2026-09-01 19:00:00')->addDays($day)]);
        }

        $snapshot = $this->unlocked()->getJson('/api/snapshot')->assertOk();

        // Join order, so newcomers land at the end of “Our group” (as in the design).
        $this->assertSame(
            ['Sarah Lindqvist', 'Ben Carter', 'Mike Brennan'],
            collect($snapshot->json('members'))->pluck('name')->take(3)->all(),
        );
        $this->assertSame([$newer->id, $middle->id, $older->id], array_column($snapshot->json('prayers'), 'id'));
        $this->assertSame([$early->id, $late->id], array_column($snapshot->json('prayers.2.updates'), 'id'));
        $this->assertSame([$october->id, $september->id, $july->id], array_column($snapshot->json('studies'), 'id'));

        $activity = $snapshot->json('activity');
        $this->assertCount(20, $activity);
        $this->assertSame('2026-09-26T19:00:00.000000Z', $activity[0]['created_at']);
        $this->assertSame('2026-09-07T19:00:00.000000Z', $activity[19]['created_at']);
    }

    public function test_dates_and_timestamps_are_serialised_consistently(): void
    {
        $study = Study::factory()->create([
            'meeting_date' => '2026-10-14',
            'published_at' => '2026-10-05 19:00:00',
        ]);
        PrayerRequest::factory()->answered()->create([
            'created_at' => '2026-08-12 19:00:00',
            'answered_at' => '2026-09-09 19:00:00',
        ]);

        $this->unlocked()->getJson('/api/snapshot')
            ->assertJsonPath('studies.0.id', $study->id)
            ->assertJsonPath('studies.0.meeting_date', '2026-10-14')
            ->assertJsonPath('studies.0.published_at', '2026-10-05T19:00:00.000000Z')
            ->assertJsonPath('prayers.0.created_at', '2026-08-12T19:00:00.000000Z')
            ->assertJsonPath('prayers.0.answered_at', '2026-09-09T19:00:00.000000Z');
    }
}
