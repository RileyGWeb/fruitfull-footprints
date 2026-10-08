<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Models\MemberDate;
use App\Models\PrayerRequest;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * What a 422 says, word for word. People read these under the field, so they are plain and
 * warm: no field names or paths, no exclamation marks, curly apostrophes.
 */
class ValidationMessagesTest extends TestCase
{
    use RefreshDatabase;

    private const DATE = ['kind' => 'event', 'label' => 'Moving day', 'date' => '2026-10-31', 'recurring' => true];

    private const STUDY = ['meeting_date' => '2026-10-21', 'status' => 'draft', 'sections' => []];

    private const PASSWORD = ['current_password' => 'footprints', 'password' => 'mustard-seed', 'password_confirmation' => 'mustard-seed'];

    /**
     * @return array<string, array{0: string, 1: string, 2: array<string, mixed>, 3: string, 4: string}>
     */
    public static function plainMessages(): array
    {
        $long = fn (int $length): string => str_repeat('a', $length);

        return [
            'member: no name' => ['POST', '/api/members', [], 'name', 'Add their name.'],
            'member: name not text' => ['POST', '/api/members', ['name' => ['Ann']], 'name', 'This needs to be text.'],
            'member: long name' => ['POST', '/api/members', ['name' => $long(121)], 'name', 'Keep it under 120 characters.'],
            'member: unknown tone' => ['POST', '/api/members', ['name' => 'Ann Lee', 'tone' => 'teal'], 'tone', 'Pick one of the three colors.'],
            'member: gifts not a list' => ['POST', '/api/members', ['name' => 'Ann Lee', 'gifts' => 'Mercy'], 'gifts', 'Pick gifts from the list.'],
            'member: too many gifts' => ['POST', '/api/members', ['name' => 'Ann Lee', 'gifts' => [...Member::GIFTS, 'Joy']], 'gifts', 'Pick up to 14 gifts.'],
            'member: unknown gift' => ['POST', '/api/members', ['name' => 'Ann Lee', 'gifts' => ['Juggling']], 'gifts.0', 'Pick gifts from the list.'],
            'member: gift not text' => ['POST', '/api/members', ['name' => 'Ann Lee', 'gifts' => [['Mercy']]], 'gifts.0', 'Pick gifts from the list.'],
            'member: long line' => ['POST', '/api/members', ['name' => 'Ann Lee', 'line' => $long(281)], 'line', 'Keep it under 280 characters.'],
            'member: long family' => ['POST', '/api/members', ['name' => 'Ann Lee', 'family' => $long(1001)], 'family', 'Keep it under 1,000 characters.'],
            'member: long interests' => ['POST', '/api/members', ['name' => 'Ann Lee', 'interests' => $long(1001)], 'interests', 'Keep it under 1,000 characters.'],
            'member: long good to know' => ['POST', '/api/members', ['name' => 'Ann Lee', 'good_to_know' => $long(1001)], 'good_to_know', 'Keep it under 1,000 characters.'],
            'member edit: blank name' => ['PATCH', '/api/members/{member}', ['name' => ''], 'name', 'Add their name.'],
            'member edit: no tone' => ['PATCH', '/api/members/{member}', ['tone' => null], 'tone', 'Pick one of the three colors.'],

            'date: no kind' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'kind' => null], 'kind', 'Pick a kind of date.'],
            'date: unknown kind' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'kind' => 'holiday'], 'kind', 'Pick a kind of date.'],
            'date: label not text' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'label' => ['Moving']], 'label', 'This needs to be text.'],
            'date: long label' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'label' => $long(161)], 'label', 'Keep it under 160 characters.'],
            'date: no date' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => null], 'date', 'Pick a date.'],
            'date: impossible day' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '2026-02-30'], 'date', 'That date isn’t on the calendar.'],
            'date: wrong format' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '10/31/2026'], 'date', 'That date isn’t on the calendar.'],
            'date: impossible yearless day' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '--02-30'], 'date', 'That date isn’t on the calendar.'],
            'date: before 1900' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '1899-12-31'], 'date', 'Pick a date between 1900 and 2200.'],
            'date: after 2200' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '2201-01-01'], 'date', 'Pick a date between 1900 and 2200.'],
            'date: one-time without a year' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'date' => '--10-31', 'recurring' => false], 'date', 'A one-time date needs a year.'],
            'date: no recurring flag' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'recurring' => null], 'recurring', 'Choose whether to remember it every year.'],
            'date: recurring not a flag' => ['POST', '/api/members/{member}/dates', [...self::DATE, 'recurring' => 'sometimes'], 'recurring', 'Choose whether to remember it every year.'],
            'date edit: no kind' => ['PATCH', '/api/dates/{date}', ['kind' => null], 'kind', 'Pick a kind of date.'],
            'date edit: impossible yearless day' => ['PATCH', '/api/dates/{date}', ['date' => '--04-31'], 'date', 'That date isn’t on the calendar.'],

            'prayer: no person' => ['POST', '/api/prayers', ['body' => 'Pray'], 'member_id', 'Pick someone from the group.'],
            'prayer: unknown person' => ['POST', '/api/prayers', ['member_id' => 999999, 'body' => 'Pray'], 'member_id', 'Pick someone from the group.'],
            'prayer: person not a number' => ['POST', '/api/prayers', ['member_id' => 'sarah', 'body' => 'Pray'], 'member_id', 'Pick someone from the group.'],
            'prayer: person is a boolean' => ['POST', '/api/prayers', ['member_id' => true, 'body' => 'Pray'], 'member_id', 'Pick someone from the group.'],
            'prayer: no body' => ['POST', '/api/prayers', ['member_id' => '{member}'], 'body', 'Add a few words about the request.'],
            'prayer: blank body' => ['POST', '/api/prayers', ['member_id' => '{member}', 'body' => '   '], 'body', 'Add a few words about the request.'],
            'prayer: body not text' => ['POST', '/api/prayers', ['member_id' => '{member}', 'body' => ['Pray']], 'body', 'This needs to be text.'],
            'prayer: long body' => ['POST', '/api/prayers', ['member_id' => '{member}', 'body' => $long(2001)], 'body', 'Keep it under 2,000 characters.'],
            'prayer edit: blank body' => ['PATCH', '/api/prayers/{prayer}', ['body' => ''], 'body', 'Add a few words about the request.'],
            'prayer edit: long answer' => ['PATCH', '/api/prayers/{prayer}', ['answer' => $long(2001)], 'answer', 'Keep it under 2,000 characters.'],
            'answer: long' => ['POST', '/api/prayers/{prayer}/answer', ['answer' => $long(2001)], 'answer', 'Keep it under 2,000 characters.'],
            'answer: not text' => ['POST', '/api/prayers/{prayer}/answer', ['answer' => ['Yes']], 'answer', 'This needs to be text.'],
            'update: no body' => ['POST', '/api/prayers/{prayer}/updates', [], 'body', 'Add a few words about what’s changed.'],
            'update: body not text' => ['POST', '/api/prayers/{prayer}/updates', ['body' => ['News']], 'body', 'This needs to be text.'],
            'update: long body' => ['POST', '/api/prayers/{prayer}/updates', ['body' => $long(2001)], 'body', 'Keep it under 2,000 characters.'],

            'study: no meeting date' => ['POST', '/api/studies', [...self::STUDY, 'meeting_date' => null], 'meeting_date', 'Pick the date we’ll meet.'],
            'study: impossible meeting date' => ['POST', '/api/studies', [...self::STUDY, 'meeting_date' => '2026-02-30'], 'meeting_date', 'Pick the date we’ll meet.'],
            'study: meeting date before 1900' => ['POST', '/api/studies', [...self::STUDY, 'meeting_date' => '1899-12-31'], 'meeting_date', 'Pick a date between 1900 and 2200.'],
            'study: meeting date after 2200' => ['POST', '/api/studies', [...self::STUDY, 'meeting_date' => '2201-01-01'], 'meeting_date', 'Pick a date between 1900 and 2200.'],
            'study: no status' => ['POST', '/api/studies', [...self::STUDY, 'status' => null], 'status', 'Save it as a draft or publish it.'],
            'study: unknown status' => ['POST', '/api/studies', [...self::STUDY, 'status' => 'archived'], 'status', 'Save it as a draft or publish it.'],
            'study: title not text' => ['POST', '/api/studies', [...self::STUDY, 'title' => ['Romans']], 'title', 'This needs to be text.'],
            'study: no sections' => ['POST', '/api/studies', [...self::STUDY, 'sections' => null], 'sections', 'The sections didn’t come through — try saving again.'],
            'study: section not an object' => ['POST', '/api/studies', [...self::STUDY, 'sections' => ['Opening']], 'sections.0', 'This section didn’t come through — try saving again.'],
            'study: section without a kind' => ['POST', '/api/studies', [...self::STUDY, 'sections' => [['heading' => 'Hi']]], 'sections.0.type', 'Pick a kind for this section.'],
            'study: unknown section kind' => ['POST', '/api/studies', [...self::STUDY, 'sections' => [['type' => 'poem']]], 'sections.0.type', 'Pick a kind for this section.'],
            'study: section body not text' => ['POST', '/api/studies', [...self::STUDY, 'sections' => [['type' => 'text', 'body' => ['Hi']]]], 'sections.0.body', 'This needs to be text.'],
            'study: questions not a list' => ['POST', '/api/studies', [...self::STUDY, 'sections' => [['type' => 'questions', 'items' => 'Why?']]], 'sections.0.items', 'The questions didn’t come through — try saving again.'],
            'study: question not text' => ['POST', '/api/studies', [...self::STUDY, 'sections' => [['type' => 'questions', 'items' => [['Why?']]]]], 'sections.0.items.0', 'This needs to be text.'],
            'study: expected version not a date' => ['POST', '/api/studies', [...self::STUDY, 'expected_updated_at' => 'yesterday-ish'], 'expected_updated_at', 'Reload the study and try again.'],

            'settings: blank group name' => ['PATCH', '/api/settings', ['group_name' => ''], 'group_name', 'The group needs a name.'],
            'settings: group name not text' => ['PATCH', '/api/settings', ['group_name' => ['Us']], 'group_name', 'This needs to be text.'],
            'settings: long group name' => ['PATCH', '/api/settings', ['group_name' => $long(121)], 'group_name', 'Keep it under 120 characters.'],
            'settings: long tagline' => ['PATCH', '/api/settings', ['tagline' => $long(281)], 'tagline', 'Keep it under 280 characters.'],
            'settings: unknown weekday' => ['PATCH', '/api/settings', ['meeting_day' => 'Someday'], 'meeting_day', 'Pick the day you usually meet.'],
            'settings: blank weekday' => ['PATCH', '/api/settings', ['meeting_day' => ''], 'meeting_day', 'Pick the day you usually meet.'],
            'settings: blank time' => ['PATCH', '/api/settings', ['meeting_time' => ''], 'meeting_time', 'Add a time, like 7pm.'],
            'settings: long time' => ['PATCH', '/api/settings', ['meeting_time' => $long(41)], 'meeting_time', 'Keep it under 40 characters.'],
            'settings: blank place' => ['PATCH', '/api/settings', ['meeting_place' => ''], 'meeting_place', 'Add where you usually meet.'],
            'settings: long place' => ['PATCH', '/api/settings', ['meeting_place' => $long(161)], 'meeting_place', 'Keep it under 160 characters.'],
            'settings: blank year' => ['PATCH', '/api/settings', ['since_year' => ''], 'since_year', 'Add the year you started, like 2023.'],
            'settings: year not a number' => ['PATCH', '/api/settings', ['since_year' => 'long ago'], 'since_year', 'Add the year you started, like 2023.'],
            'settings: year out of range' => ['PATCH', '/api/settings', ['since_year' => 1066], 'since_year', 'Pick a year between 1900 and 2100.'],

            'password: no current password' => ['PUT', '/api/settings/password', [...self::PASSWORD, 'current_password' => null], 'current_password', 'Type the password you use now.'],
            'password: current password not text' => ['PUT', '/api/settings/password', [...self::PASSWORD, 'current_password' => ['footprints']], 'current_password', 'Type the password you use now.'],
            'password: wrong current password' => ['PUT', '/api/settings/password', [...self::PASSWORD, 'current_password' => 'nope'], 'current_password', 'That isn’t the current password.'],
            'password: no new password' => ['PUT', '/api/settings/password', [...self::PASSWORD, 'password' => null], 'password', 'Choose a new password.'],
            'password: new password not text' => ['PUT', '/api/settings/password', [...self::PASSWORD, 'password' => ['mustard-seed']], 'password', 'This needs to be text.'],
        ];
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('plainMessages')]
    public function test_validation_messages_are_plain_and_warm(string $method, string $uri, array $payload, string $field, string $message): void
    {
        $this->send($method, $uri, $payload)->assertUnprocessable()->assertJson(['errors' => [$field => [$message]]]);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('plainMessages')]
    public function test_messages_are_written_in_the_apps_voice(string $method, string $uri, array $payload, string $field, string $message): void
    {
        $this->assertMatchesRegularExpression('/^[A-Z].*\.$/u', $message);
        $this->assertDoesNotMatchRegularExpression('/[!\'"_]|\w\.\w|\bfield\b/u', $message, 'No exclamation marks, straight quotes or field names.');

        // The screens that match on server wording (see the next test) must not mistake these for the messages they translate.
        if ($uri === '/api/studies') {
            $this->assertDoesNotMatchRegularExpression('/greater than \d+ characters|more than \d+ items|required/i', $message);
        }
        if ($field === 'meeting_date' && $message !== 'Pick a date between 1900 and 2200.') {
            $this->assertDoesNotMatchRegularExpression('/between/i', $message);
        }
        if ($uri === '/api/settings/password') {
            $this->assertDoesNotMatchRegularExpression('/least|min|confirm/i', $message);
        }
    }

    /**
     * @return array<string, array{0: string, 1: array<string, mixed>, 2: string, 3: string, 4: string}>
     */
    public static function messagesTheFrontendReads(): array
    {
        $chars = '/greater than (\d+) characters/';
        $items = '/more than (\d+) items/';

        return [
            'study: long title' => ['/api/studies', [...self::STUDY, 'title' => str_repeat('a', 161)], 'title', 'The title field must not be greater than 160 characters.', $chars],
            'study: long section text' => ['/api/studies', [...self::STUDY, 'sections' => [['type' => 'text', 'body' => str_repeat('a', 20001)]]], 'sections.0.body', 'The sections.0.body field must not be greater than 20000 characters.', $chars],
            'study: too many sections' => ['/api/studies', [...self::STUDY, 'sections' => array_fill(0, 61, ['type' => 'text'])], 'sections', 'The sections field must not have more than 60 items.', $items],
            'study: too many questions' => ['/api/studies', [...self::STUDY, 'sections' => [['type' => 'questions', 'items' => array_fill(0, 41, 'Why?')]]], 'sections.0.items', 'The sections.0.items field must not have more than 40 items.', $items],
            'study: publishing without a ref' => ['/api/studies', [...self::STUDY, 'status' => 'published', 'title' => 'Hope'], 'ref', 'The ref field is required when status is published.', '/required/i'],
            'study: publishing without a title' => ['/api/studies', [...self::STUDY, 'status' => 'published', 'ref' => 'Romans 8'], 'title', 'The title field is required when status is published.', '/required/i'],
            'study: meeting date out of range' => ['/api/studies', [...self::STUDY, 'meeting_date' => '1899-12-31'], 'meeting_date', 'Pick a date between 1900 and 2200.', '/between/i'],
            'password: too short' => ['/api/settings/password', [...self::PASSWORD, 'password' => 'abc', 'password_confirmation' => 'abc'], 'password', 'The password field must be at least 6 characters.', '/least|min/i'],
            'password: not confirmed' => ['/api/settings/password', [...self::PASSWORD, 'password_confirmation' => 'mustard-seeds'], 'password', 'The password field confirmation does not match.', '/confirm/i'],
        ];
    }

    /**
     * The study editor (frontend/components/editor/draft.ts `friendly`) and the Settings
     * password form (frontend/components/settings/form.ts `passwordServerErrors`) recognise
     * these by their wording and show their own copy, so they stay exactly as Laravel words them.
     *
     * @param  array<string, mixed>  $payload
     */
    #[DataProvider('messagesTheFrontendReads')]
    public function test_messages_the_frontend_reads_keep_their_wording(string $uri, array $payload, string $field, string $message, string $frontendPattern): void
    {
        $this->send($uri === '/api/studies' ? 'POST' : 'PUT', $uri, $payload)
            ->assertUnprocessable()
            ->assertJson(['errors' => [$field => [$message]]]);

        $this->assertMatchesRegularExpression($frontendPattern, $message);
    }

    /**
     * @param  array<string, mixed>  $payload
     */
    private function send(string $method, string $uri, array $payload): TestResponse
    {
        $this->setGroupPassword('footprints');

        $ids = [
            '{member}' => Member::factory()->create()->id,
            '{date}' => MemberDate::factory()->create()->id,
            '{prayer}' => PrayerRequest::factory()->create()->id,
        ];
        $payload = array_map(fn (mixed $value): mixed => is_string($value) ? ($ids[$value] ?? $value) : $value, $payload);

        return $this->unlocked()->json($method, strtr($uri, $ids), $payload);
    }
}
