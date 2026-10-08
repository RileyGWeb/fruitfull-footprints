<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\MemberDate;
use Illuminate\Foundation\Testing\RefreshDatabase;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class MemberDateTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_date_is_split_into_month_day_and_year(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [
            'kind' => 'event',
            'label' => 'Caleb’s graduation',
            'date' => '2026-12-12',
            'recurring' => false,
        ])->assertCreated()->assertExactJson([
            'id' => MemberDate::sole()->id,
            'member_id' => $member->id,
            'kind' => 'event',
            'label' => 'Caleb’s graduation',
            'month' => 12,
            'day' => 12,
            'year' => 2026,
            'recurring' => false,
        ]);
    }

    public function test_birthdays_never_keep_a_label(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [
            'kind' => 'birthday',
            'label' => 'Birthday',
            'date' => '1990-03-22',
            'recurring' => true,
        ])->assertCreated()->assertJson(['label' => null, 'month' => 3, 'day' => 22, 'year' => 1990]);
    }

    public function test_february_29th_is_allowed_in_a_leap_year(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [
            'kind' => 'anniversary',
            'label' => 'Leap day wedding',
            'date' => '2024-02-29',
            'recurring' => true,
        ])->assertCreated()->assertJson(['month' => 2, 'day' => 29, 'year' => 2024]);
    }

    /**
     * @return array<string, array{0: array<string, mixed>, 1: string}>
     */
    public static function invalidDates(): array
    {
        $valid = ['kind' => 'event', 'label' => 'Moving day', 'date' => '2026-10-31', 'recurring' => false];

        return [
            'no kind' => [array_diff_key($valid, ['kind' => 0]), 'kind'],
            'unknown kind' => [[...$valid, 'kind' => 'holiday'], 'kind'],
            'no date' => [array_diff_key($valid, ['date' => 0]), 'date'],
            'not a date' => [[...$valid, 'date' => 'soon'], 'date'],
            'wrong format' => [[...$valid, 'date' => '10/31/2026'], 'date'],
            'impossible day' => [[...$valid, 'date' => '2026-02-30'], 'date'],
            'feb 29 in a common year' => [[...$valid, 'date' => '2026-02-29'], 'date'],
            'year 0' => [[...$valid, 'date' => '0000-01-01'], 'date'],
            'year 1' => [[...$valid, 'date' => '0001-01-01'], 'date'],
            'before 1900' => [[...$valid, 'date' => '1899-12-31'], 'date'],
            'after 2200' => [[...$valid, 'date' => '2201-01-01'], 'date'],
            'no recurring flag' => [array_diff_key($valid, ['recurring' => 0]), 'recurring'],
            'recurring not boolean' => [[...$valid, 'recurring' => 'sometimes'], 'recurring'],
            'long label' => [[...$valid, 'label' => str_repeat('a', 161)], 'label'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('invalidDates')]
    public function test_new_dates_are_validated(array $payload, string $field): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", $payload)
            ->assertUnprocessable()
            ->assertJsonValidationErrors($field);

        $this->assertSame(0, MemberDate::count());
    }

    public function test_dates_out_of_range_get_a_plain_message(): void
    {
        $member = Member::factory()->create();
        $payload = ['kind' => 'birthday', 'recurring' => true];

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [...$payload, 'date' => '0001-01-01'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.date', ['Pick a date between 1900 and 2200.']);

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [...$payload, 'date' => '1900-01-01'])->assertCreated();
        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [...$payload, 'date' => '2200-12-31'])->assertCreated();

        $date = MemberDate::firstOrFail();
        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '0000-06-01'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.date', ['Pick a date between 1900 and 2200.']);
    }

    public function test_a_date_can_be_partly_updated(): void
    {
        $date = MemberDate::factory()->event()->create(['label' => 'Moving day', 'month' => 10, 'day' => 31, 'year' => 2026]);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '2026-11-07'])
            ->assertOk()
            ->assertJson(['label' => 'Moving day', 'month' => 11, 'day' => 7, 'year' => 2026, 'recurring' => false]);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['recurring' => true, 'label' => 'Housewarming'])
            ->assertOk()
            ->assertJson(['label' => 'Housewarming', 'month' => 11, 'day' => 7, 'recurring' => true]);
    }

    public function test_changing_a_date_to_a_birthday_drops_its_label(): void
    {
        $date = MemberDate::factory()->event()->create();

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['kind' => 'birthday'])
            ->assertOk()
            ->assertJson(['kind' => 'birthday', 'label' => null]);
    }

    public function test_date_updates_are_validated(): void
    {
        $date = MemberDate::factory()->create();

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['kind' => 'holiday', 'date' => '2026-13-01', 'recurring' => null])
            ->assertUnprocessable()
            ->assertJsonValidationErrors(['kind', 'date', 'recurring']);
    }

    public function test_a_yearless_date_needs_a_full_date_to_become_one_time(): void
    {
        // Like the demo's “Remembering Margaret”: recurring, stored without a year.
        $date = MemberDate::factory()->create(['kind' => 'event', 'label' => 'Remembering Margaret', 'month' => 5, 'day' => 4]);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['recurring' => false])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('date');
        $this->assertTrue($date->fresh()->recurring);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['recurring' => false, 'date' => '2027-05-04'])
            ->assertOk()
            ->assertJson(['month' => 5, 'day' => 4, 'year' => 2027, 'recurring' => false]);

        // Once it has a year, recurring can be switched off on its own.
        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['recurring' => true])->assertOk();
        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['recurring' => false])->assertOk()->assertJsonPath('year', 2027);
    }

    public function test_a_recurring_date_can_be_kept_without_a_year(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", [
            'kind' => 'event',
            'label' => 'Remembering Margaret',
            'date' => '--05-04',
            'recurring' => true,
        ])->assertCreated()->assertExactJson([
            'id' => MemberDate::sole()->id,
            'member_id' => $member->id,
            'kind' => 'event',
            'label' => 'Remembering Margaret',
            'month' => 5,
            'day' => 4,
            'year' => null,
            'recurring' => true,
        ]);

        $this->assertDatabaseHas('member_dates', ['month' => 5, 'day' => 4, 'year' => null]);
    }

    public function test_february_29th_is_allowed_without_a_year(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", ['kind' => 'birthday', 'date' => '--02-29', 'recurring' => true])
            ->assertCreated()
            ->assertJson(['month' => 2, 'day' => 29, 'year' => null]);
    }

    /**
     * @return array<string, array{0: string}>
     */
    public static function invalidYearlessDates(): array
    {
        return [
            'day 30 of February' => ['--02-30'],
            'day 31 of April' => ['--04-31'],
            'month 13' => ['--13-01'],
            'month 0' => ['--00-10'],
            'day 0' => ['--05-00'],
            'single digits' => ['--5-4'],
            'three dashes' => ['---05-04'],
            'trailing text' => ['--05-04x'],
            'just dashes' => ['--'],
        ];
    }

    #[DataProvider('invalidYearlessDates')]
    public function test_yearless_dates_must_be_on_the_calendar(string $date): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", ['kind' => 'birthday', 'date' => $date, 'recurring' => true])
            ->assertUnprocessable()
            ->assertJsonPath('errors.date', ['That date isn’t on the calendar.']);

        $this->assertSame(0, MemberDate::count());
    }

    public function test_a_new_one_time_date_needs_a_year(): void
    {
        $member = Member::factory()->create();

        $this->unlocked()->postJson("/api/members/{$member->id}/dates", ['kind' => 'event', 'label' => 'Moving day', 'date' => '--10-31', 'recurring' => false])
            ->assertUnprocessable()
            ->assertExactJson([
                'message' => 'A one-time date needs a year.',
                'errors' => ['date' => ['A one-time date needs a year.']],
            ]);

        $this->assertSame(0, MemberDate::count());
    }

    public function test_a_date_can_be_moved_to_a_yearless_day_and_back(): void
    {
        $date = MemberDate::factory()->create(['kind' => 'birthday', 'month' => 3, 'day' => 22, 'year' => 1990]);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '--03-23'])
            ->assertOk()
            ->assertJson(['month' => 3, 'day' => 23, 'year' => null, 'recurring' => true]);
        $this->assertNull($date->fresh()->year);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '1990-03-22'])
            ->assertOk()
            ->assertJson(['month' => 3, 'day' => 22, 'year' => 1990, 'recurring' => true]);
    }

    public function test_a_one_time_date_cannot_lose_its_year(): void
    {
        $date = MemberDate::factory()->event()->create(['label' => 'Moving day', 'month' => 10, 'day' => 31, 'year' => 2026]);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '--11-07'])
            ->assertUnprocessable()
            ->assertJsonPath('errors.date', ['A one-time date needs a year.']);

        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '--11-07', 'recurring' => false])
            ->assertUnprocessable()
            ->assertJsonPath('errors.date', ['A one-time date needs a year.']);

        $this->assertSame([10, 31, 2026, false], [$date->fresh()->month, $date->fresh()->day, $date->fresh()->year, $date->fresh()->recurring]);

        // Made recurring in the same save, it can drop the year.
        $this->unlocked()->patchJson("/api/dates/{$date->id}", ['date' => '--11-07', 'recurring' => true])
            ->assertOk()
            ->assertJson(['month' => 11, 'day' => 7, 'year' => null, 'recurring' => true]);
    }

    public function test_a_date_can_be_removed(): void
    {
        $date = MemberDate::factory()->create();

        $this->unlocked()->deleteJson("/api/dates/{$date->id}")->assertNoContent();

        $this->assertModelMissing($date);
        $this->assertModelExists($date->member);
    }

    public function test_dates_for_missing_records_are_404(): void
    {
        $this->unlocked()->postJson('/api/members/999/dates', ['kind' => 'birthday', 'date' => '2000-01-01', 'recurring' => true])->assertNotFound();
        $this->unlocked()->patchJson('/api/dates/999', ['kind' => 'birthday'])->assertNotFound();
        $this->unlocked()->deleteJson('/api/dates/999')->assertNotFound();
    }
}
