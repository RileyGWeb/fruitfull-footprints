<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use App\Models\Study;
use App\Services\Settings;
use Database\Seeders\DatabaseSeeder;
use Database\Seeders\DemoSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class SeederTest extends TestCase
{
    use RefreshDatabase;

    public function test_the_database_seeder_writes_defaults_and_the_env_password(): void
    {
        config(['group.password' => 'footprints']);

        $this->seed(DatabaseSeeder::class);

        $stored = DB::table('settings')->pluck('value', 'key')->map(fn (string $value): mixed => json_decode($value, true));
        $this->assertEquals(Settings::DEFAULTS, $stored->except('password_hash')->all());
        $this->assertTrue(app(Settings::class)->checkPassword('footprints'));
        $this->assertSame(1, app(Settings::class)->passwordVersion());
    }

    public function test_the_database_seeder_never_overwrites_anything(): void
    {
        config(['group.password' => 'footprints']);
        $this->seed(DatabaseSeeder::class);
        $hash = DB::table('settings')->where('key', 'password_hash')->value('value');
        app(Settings::class)->set(['group_name' => 'Renamed']);

        config(['group.password' => 'something-else']);
        $this->seed(DatabaseSeeder::class);

        $this->assertSame($hash, DB::table('settings')->where('key', 'password_hash')->value('value'));
        $this->assertSame('"Renamed"', DB::table('settings')->where('key', 'group_name')->value('value'));
        $this->assertSame(8, DB::table('settings')->count());
    }

    public function test_without_group_password_no_password_is_set(): void
    {
        config(['group.password' => '']);

        $this->seed(DatabaseSeeder::class);

        $this->assertFalse(app(Settings::class)->hasPassword());
        $this->postJson('/api/unlock', ['password' => ''])->assertServiceUnavailable();
    }

    public function test_the_demo_seeder_loads_the_prototype(): void
    {
        Carbon::setTestNow('2026-10-07 18:00:00');
        config(['group.password' => 'footprints']);

        $this->seed(DemoSeeder::class);

        $this->assertSame(8, Member::count());
        $this->assertSame(19, MemberDate::count());
        $this->assertSame(['active' => 8, 'answered' => 5], PrayerRequest::toBase()->selectRaw('status, count(*) as n')->groupBy('status')->orderBy('status')->pluck('n', 'status')->all());
        $this->assertSame(3, PrayerUpdate::count());
        $this->assertSame(22, Study::count());
        $this->assertSame(['Romans 9'], Study::where('status', 'draft')->pluck('ref')->all());
        $this->assertSame(8, Study::where('series', 'Psalms of Ascent')->where('status', 'published')->count());
        $this->assertSame(4, Activity::count());
        $this->assertTrue(app(Settings::class)->checkPassword('footprints'));
    }

    public function test_the_demo_matches_the_design_on_the_prototypes_today(): void
    {
        Carbon::setTestNow('2026-10-07 18:00:00');
        $this->seed(DemoSeeder::class);

        $snapshot = $this->unlocked()->getJson('/api/snapshot')->assertOk();

        // Romans 8 is up next, published two days before "today"; Romans 9 is the draft.
        $romans8 = collect($snapshot->json('studies'))->firstWhere('ref', 'Romans 8');
        $this->assertSame('2026-10-14', $romans8['meeting_date']);
        $this->assertSame('published', $romans8['status']);
        $this->assertSame('2026-10-05T19:00:00.000000Z', $romans8['published_at']);
        $this->assertSame('There is therefore now no condemnation to those who are in Christ Jesus…', $romans8['verse']);
        $this->assertSame('Romans', $romans8['series']);
        $romans9 = collect($snapshot->json('studies'))->firstWhere('ref', 'Romans 9');
        $this->assertSame(
            ['title' => 'God’s Purposes', 'meeting_date' => '2026-10-21', 'status' => 'draft', 'published_at' => null],
            [...array_intersect_key($romans9, ['title' => 0, 'meeting_date' => 0, 'status' => 0, 'published_at' => 0])],
        );

        $full = $this->unlocked()->getJson("/api/studies/{$romans8['id']}")->json('sections');
        $this->assertSame(['text', 'scripture', 'questions', 'text', 'scripture', 'reflect', 'prayer'], array_column($full, 'type'));

        // Activity: newest first, same-day entries in the prototype's order.
        $this->assertSame([
            'Romans 8 study notes were published',
            'Sarah’s request has an update',
            'New prayer request for Hannah',
            'New prayer request for Mike',
        ], array_column($snapshot->json('activity'), 'text'));

        // Prayers: newest first, with the prototype's update history.
        $prayers = collect($snapshot->json('prayers'));
        $this->assertSame('Wisdom as we finish packing and sign the new lease.', $prayers->first()['body']);
        $sarah = $prayers->firstWhere('body', 'Pray for peace and confidence as I settle into my new job — the night shifts have been an adjustment.');
        $this->assertSame('2026-09-28T19:00:00.000000Z', $sarah['created_at']);
        $this->assertSame([['body' => 'First full week done. Tired but grateful.', 'created_at' => '2026-10-05T19:00:00.000000Z']],
            array_map(fn (array $u): array => array_intersect_key($u, ['body' => 0, 'created_at' => 0]), $sarah['updates']));
        $this->assertSame(
            ['answer' => 'She said yes.', 'answered_at' => '2026-08-01T19:00:00.000000Z'],
            array_intersect_key($prayers->firstWhere('body', 'Courage to propose — and that she says yes!'), ['answer' => 0, 'answered_at' => 0]),
        );

        // Members: profile text verbatim; recurring and one-time dates.
        $rachel = collect($snapshot->json('members'))->firstWhere('name', 'Rachel Owens');
        $this->assertSame('Married to Tom · two boys, Eli (9) and Sam (6)', $rachel['family']);
        $this->assertSame(['Encouragement', 'Mercy', 'Hospitality'], $rachel['gifts']);
        $this->assertSame([
            ['kind' => 'birthday', 'label' => null, 'month' => 10, 'day' => 11, 'year' => null, 'recurring' => true],
            ['kind' => 'anniversary', 'label' => 'Rachel & Tom’s anniversary', 'month' => 6, 'day' => 3, 'year' => 2011, 'recurring' => true],
        ], array_map(fn (array $d): array => array_diff_key($d, ['id' => 0, 'member_id' => 0]), $rachel['dates']));
    }

    /**
     * @return array<string, array{0: string, 1: int}>
     */
    public static function todays(): array
    {
        return [
            'the prototype’s today' => ['2026-10-07', 0],
            'later that week' => ['2026-10-13', 0],
            'a week on' => ['2026-10-14', 7],
            'two and a half weeks on' => ['2026-10-25', 14],
            'next year' => ['2027-01-01', 84],
            'the day before' => ['2026-10-06', -7],
            'a month before' => ['2026-09-07', -35],
        ];
    }

    #[DataProvider('todays')]
    public function test_demo_dates_shift_by_whole_weeks(string $today, int $shift): void
    {
        Carbon::setTestNow("{$today} 12:00:00");

        $this->assertSame($shift, DemoSeeder::shiftDays());
    }

    public function test_shifted_demo_dates_keep_their_place_relative_to_today(): void
    {
        Carbon::setTestNow('2026-10-25 12:00:00'); // shift = 14 days

        $this->seed(DemoSeeder::class);

        $study = Study::firstWhere('ref', 'Romans 8');
        $this->assertSame('2026-10-28', $study->meeting_date->toDateString());
        $this->assertSame('Wednesday', $study->meeting_date->dayName);
        $this->assertSame('2026-10-19 19:00:00', $study->published_at->toDateTimeString());
        $this->assertSame('2026-04-15', Study::firstWhere('ref', 'Psalm 120')->meeting_date->toDateString());

        $hannah = Member::firstWhere('name', 'Hannah Pruitt');
        $this->assertSame([11, 14, 2026, false], $this->dateParts($hannah, 'Moving day'));        // one-time: 10-31 + 14
        $this->assertSame([10, 28, 2023, true], $this->dateParts($hannah, 'Hannah & Caleb’s anniversary')); // recurring: unchanged

        $this->assertSame('2026-10-17 19:00:00', PrayerRequest::firstWhere('body', 'like', 'Prayer for my dad%')->created_at->toDateTimeString());
        $this->assertSame('2026-10-19 19:00:00', Activity::firstWhere('kind', 'study_published')->created_at->toDateTimeString());
    }

    public function test_the_psalms_of_ascent_quote_the_world_english_bible(): void
    {
        $this->seed(DemoSeeder::class);

        $scripture = Study::where('series', 'Psalms of Ascent')->orderBy('meeting_date')->get()
            ->flatMap(fn (Study $study): array => array_values(array_filter($study->sections, fn (array $s): bool => $s['type'] === 'scripture')))
            ->mapWithKeys(fn (array $section): array => [$section['ref'] => $section['text']])
            ->all();

        $this->assertSame([
            'Psalm 120:1–2' => 'In my distress, I cried to Yahweh. He answered me. Deliver my soul, Yahweh, from lying lips, from a deceitful tongue.',
            'Psalm 121:1–2' => 'I will lift up my eyes to the hills. Where does my help come from? My help comes from Yahweh, who made heaven and earth.',
            'Psalm 122:1' => 'I was glad when they said to me, “Let’s go to Yahweh’s house!”',
            'Psalm 123:1–2' => 'To you I do lift up my eyes, you who sit in the heavens. Behold, as the eyes of servants look to the hand of their master, as the eyes of a maid to the hand of her mistress; so our eyes look to Yahweh, our God, until he has mercy on us.',
            'Psalm 124:7–8' => 'Our soul has escaped like a bird out of the fowler’s snare. The snare is broken, and we have escaped. Our help is in Yahweh’s name, who made heaven and earth.',
            'Psalm 125:1–2' => 'Those who trust in Yahweh are as Mount Zion, which can’t be moved, but remains forever. As the mountains surround Jerusalem, so Yahweh surrounds his people from this time forward and forever more.',
            'Psalm 126:5–6' => 'Those who sow in tears will reap in joy. He who goes out weeping, carrying seed for sowing, will certainly come again with joy, carrying his sheaves.',
            'Psalm 127:1–2' => 'Unless Yahweh builds the house, they labor in vain who build it. Unless Yahweh watches over the city, the watchman guards it in vain. It is vain for you to rise up early, to stay up late, eating the bread of toil; for he gives sleep to his loved ones.',
        ], $scripture);
    }

    /**
     * @return array{0: int, 1: int, 2: ?int, 3: bool}
     */
    private function dateParts(Member $member, string $label): array
    {
        $date = $member->dates()->where('label', $label)->sole();

        return [$date->month, $date->day, $date->year, $date->recurring];
    }
}
