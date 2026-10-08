<?php

namespace Tests\Feature;

use App\Models\Activity;
use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MemberTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_member_can_be_added_with_just_a_name(): void
    {
        $response = $this->unlocked()->postJson('/api/members', ['name' => 'Priya Shah'])
            ->assertCreated()
            ->assertJson([
                'name' => 'Priya Shah',
                'tone' => 'sage',
                'gifts' => [],
                'line' => null,
                'family' => null,
                'interests' => null,
                'good_to_know' => null,
                'dates' => [],
            ]);

        $this->assertIsInt($response->json('id'));
        $this->assertNotNull($response->json('created_at'));
        $this->assertDatabaseHas('members', ['id' => $response->json('id'), 'name' => 'Priya Shah']);
    }

    public function test_adding_a_member_is_logged_with_their_first_name(): void
    {
        $this->unlocked()->postJson('/api/members', ['name' => 'Priya Shah'])->assertCreated();

        $this->assertDatabaseHas('activities', ['kind' => 'member_added', 'text' => 'Priya joined the group']);
    }

    public function test_new_members_cycle_through_the_tones(): void
    {
        $tones = collect(['A One', 'B Two', 'C Three', 'D Four'])
            ->map(fn (string $name): string => $this->unlocked()->postJson('/api/members', ['name' => $name])->json('tone'));

        $this->assertSame(['sage', 'accent', 'sand', 'sage'], $tones->all());
    }

    public function test_a_member_can_be_added_with_everything(): void
    {
        $payload = [
            'name' => 'Grace Adeyemi',
            'tone' => 'accent',
            'gifts' => ['Hospitality', 'Administration', 'Mercy'],
            'line' => 'Organizes our meal trains.',
            'family' => 'Married to Tunde',
            'interests' => 'Choir',
            'good_to_know' => 'Meal train starts the week after the baby comes.',
        ];

        $this->unlocked()->postJson('/api/members', $payload)->assertCreated()->assertJson($payload);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidMembers(): array
    {
        return [
            'no name' => [[], 'name'],
            'blank name' => [['name' => '   '], 'name'],
            'long name' => [['name' => str_repeat('a', 121)], 'name'],
            'unknown tone' => [['name' => 'A B', 'tone' => 'teal'], 'tone'],
            'gifts not a list' => [['name' => 'A B', 'gifts' => 'Mercy'], 'gifts'],
            'gifts keyed like an object' => [['name' => 'A B', 'gifts' => ['first' => 'Mercy']], 'gifts'],
            'unknown gift' => [['name' => 'A B', 'gifts' => ['Juggling']], 'gifts.0'],
            'too many gifts' => [['name' => 'A B', 'gifts' => [...Member::GIFTS, 'Joy']], 'gifts'],
            'long line' => [['name' => 'A B', 'line' => str_repeat('a', 281)], 'line'],
            'long family' => [['name' => 'A B', 'family' => str_repeat('a', 1001)], 'family'],
            'long interests' => [['name' => 'A B', 'interests' => str_repeat('a', 1001)], 'interests'],
            'long good to know' => [['name' => 'A B', 'good_to_know' => str_repeat('a', 1001)], 'good_to_know'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidMembers')]
    public function test_new_members_are_validated(array $payload, string $field): void
    {
        $this->unlocked()->postJson('/api/members', $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame(0, Member::count());
        $this->assertSame(0, Activity::count());
    }

    public function test_any_subset_of_a_member_can_be_updated(): void
    {
        $member = Member::factory()->create(['name' => 'Ben Carter', 'tone' => 'sage', 'gifts' => ['Serving']]);

        $this->unlocked()->patchJson("/api/members/{$member->id}", ['gifts' => ['Serving', 'Encouragement']])
            ->assertOk()
            ->assertJson(['id' => $member->id, 'name' => 'Ben Carter', 'tone' => 'sage', 'gifts' => ['Serving', 'Encouragement']]);

        $this->unlocked()->patchJson("/api/members/{$member->id}", ['line' => null, 'tone' => 'sand'])
            ->assertOk()
            ->assertJson(['line' => null, 'tone' => 'sand', 'gifts' => ['Serving', 'Encouragement']]);

        $this->unlocked()->patchJson("/api/members/{$member->id}", ['gifts' => []])->assertOk()->assertJsonPath('gifts', []);

        $this->assertSame(0, Activity::count());
    }

    public function test_an_update_returns_the_members_dates(): void
    {
        $member = Member::factory()->create();
        MemberDate::factory()->for($member)->count(2)->create();

        $this->unlocked()->patchJson("/api/members/{$member->id}", ['name' => 'New Name'])
            ->assertOk()
            ->assertJsonCount(2, 'dates');
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidUpdates(): array
    {
        return [
            'blank name' => [['name' => ''], 'name'],
            'null tone' => [['tone' => null], 'tone'],
            'unknown gift' => [['gifts' => ['Juggling']], 'gifts.0'],
            'gifts keyed like an object' => [['gifts' => ['first' => 'Mercy']], 'gifts'],
        ];
    }

    public function test_repeated_gifts_are_kept_once_in_the_order_sent(): void
    {
        $created = $this->unlocked()->postJson('/api/members', ['name' => 'Ben Carter', 'gifts' => ['Serving', 'Faith', 'Serving']])
            ->assertCreated()
            ->assertJsonPath('gifts', ['Serving', 'Faith']);

        $this->unlocked()->patchJson("/api/members/{$created->json('id')}", ['gifts' => ['Mercy', 'Mercy', 'Faith', 'Mercy']])
            ->assertOk()
            ->assertJsonPath('gifts', ['Mercy', 'Faith']);

        $this->assertSame(['Mercy', 'Faith'], Member::sole()->gifts);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidUpdates')]
    public function test_member_updates_are_validated(array $payload, string $field): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->patchJson("/api/members/{$member->id}", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);
    }

    public function test_removing_a_member_removes_their_dates_prayers_and_updates(): void
    {
        $member = Member::factory()->create();
        MemberDate::factory()->for($member)->create();
        PrayerUpdate::factory()->for(PrayerRequest::factory()->for($member), 'prayerRequest')->create();
        $other = PrayerRequest::factory()->create();

        $this->unlocked()->deleteJson("/api/members/{$member->id}")->assertNoContent();

        $this->assertModelMissing($member);
        $this->assertSame(0, MemberDate::count());
        $this->assertSame([$other->id], PrayerRequest::pluck('id')->all());
        $this->assertSame(0, PrayerUpdate::count());
    }

    public function test_missing_members_are_404(): void
    {
        $this->unlocked()->patchJson('/api/members/999', ['name' => 'X Y'])->assertNotFound();
        $this->unlocked()->deleteJson('/api/members/999')->assertNotFound();
    }
}
