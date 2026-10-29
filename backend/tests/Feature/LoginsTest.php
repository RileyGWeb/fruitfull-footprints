<?php

namespace Tests\Feature;

use App\Models\Member;
use App\Services\Logins;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

/**
 * The password alone says who signs in, so it is stored two ways (a bcrypt hash to confirm it,
 * a keyed lookup to find the person) and no two people can share one.
 */
class LoginsTest extends TestCase
{
    use RefreshDatabase;

    private function logins(): Logins
    {
        return app(Logins::class);
    }

    public function test_a_password_is_kept_as_a_bcrypt_hash_and_a_keyed_lookup_never_as_itself(): void
    {
        $member = Member::factory()->create();

        $this->logins()->setPassword($member, 'cardamom-buns');

        $stored = $member->fresh();
        $this->assertTrue(Hash::check('cardamom-buns', $stored->password_hash));
        $this->assertSame(64, strlen($stored->password_lookup));
        $this->assertNotSame(hash('sha256', 'cardamom-buns'), $stored->password_lookup, 'The lookup is keyed, not a plain hash.');
        $this->assertStringNotContainsString('cardamom-buns', json_encode(DB::table('members')->get()));
    }

    public function test_setting_a_password_signs_out_older_sessions_by_raising_the_version(): void
    {
        $member = Member::factory()->create();
        $first = $member->auth_version;

        $this->logins()->setPassword($member, 'cardamom-buns');
        $second = $member->fresh()->auth_version;
        $this->logins()->setPassword($member, 'porch-light-on');
        $third = $member->fresh()->auth_version;
        $this->logins()->removePassword($member);

        $this->assertSame([$first + 1, $first + 2, $first + 3], [$second, $third, $member->fresh()->auth_version]);
    }

    public function test_the_lookup_is_keyed_by_the_app_key(): void
    {
        Member::factory()->withLogin('cardamom-buns')->create();
        $this->assertNotNull($this->logins()->attempt('cardamom-buns'));

        // After the app key changes, passwords have to be set again.
        config(['app.key' => 'base64:'.base64_encode(random_bytes(32))]);

        $this->assertNull($this->logins()->attempt('cardamom-buns'));
    }

    public function test_attempt_finds_exactly_the_person_with_that_password(): void
    {
        $sarah = Member::factory()->withLogin('cardamom-buns')->create();
        $mike = Member::factory()->leader()->withLogin('porch-light-on')->create();
        Member::factory()->create();

        $this->assertTrue($this->logins()->attempt('cardamom-buns')->is($sarah));
        $this->assertTrue($this->logins()->attempt('  porch-light-on  ')->is($mike));
        $this->assertTrue($this->logins()->attempt('porch-light-on')->isLeader());
        $this->assertNull($this->logins()->attempt('Cardamom-Buns'), 'Passwords are case sensitive.');
        $this->assertNull($this->logins()->attempt(''));
        $this->assertNull($this->logins()->attempt('porch-light-on '.'x'));
    }

    /**
     * @return array<string, array{0: mixed, 1: string|null}>
     */
    public static function passwords(): array
    {
        $tooEasy = 'That one’s too easy to guess. Try something longer or less common.';

        return [
            'eight characters' => ['abcdefg1', null],
            'a phrase' => ['we walk by faith', null],
            'seven characters' => ['abcdef1', 'Use at least 8 characters.'],
            'spaces around do not count' => ['  abc1234  ', 'Use at least 8 characters.'],
            'sixty-four characters' => [str_repeat('ab', 32), null],
            'sixty-five characters' => [str_repeat('ab', 32).'c', 'Keep it under 64 characters.'],
            'forty long characters, eighty bytes' => [str_repeat('é', 40), 'Keep it under 64 characters.'],
            'a common password' => ['password123', $tooEasy],
            'a common password in capitals' => ['PASSWORD123', $tooEasy],
            'the app’s own name' => ['Footprints', $tooEasy],
            'one letter repeated' => ['zzzzzzzz', $tooEasy],
            'one digit repeated' => ['77777777', $tooEasy],
            'not text' => [['cardamom-buns'], 'This needs to be text.'],
        ];
    }

    #[DataProvider('passwords')]
    public function test_what_makes_a_usable_password(mixed $password, ?string $problem): void
    {
        $this->assertSame($problem, $this->logins()->passwordProblem($password));
    }

    public function test_a_password_someone_has_is_taken_but_not_to_its_own_owner(): void
    {
        $sarah = Member::factory()->withLogin('cardamom-buns')->create();
        $taken = 'Someone else already uses that password. Try another.';

        $this->assertSame($taken, $this->logins()->passwordProblem('cardamom-buns'));
        $this->assertSame($taken, $this->logins()->passwordProblem('  cardamom-buns  '));
        $this->assertSame($taken, $this->logins()->passwordProblem('cardamom-buns', Member::factory()->create()));
        $this->assertNull($this->logins()->passwordProblem('cardamom-buns', $sarah));
        $this->assertNull($this->logins()->passwordProblem('Cardamom-Buns'), 'Different capitals make a different password.');
    }

    public function test_the_super_admins_password_is_taken_too(): void
    {
        $this->useSuperAdmin('a-long-way-from-home');

        $this->assertSame('Someone else already uses that password. Try another.', $this->logins()->passwordProblem('a-long-way-from-home'));
    }

    public function test_a_clash_the_checks_missed_is_stopped_by_the_database_and_reported(): void
    {
        Member::factory()->withLogin('cardamom-buns')->create();
        $other = Member::factory()->create();

        try {
            $this->logins()->setPassword($other, 'cardamom-buns');
            $this->fail('The clash went through.');
        } catch (ValidationException $e) {
            $this->assertSame(['password' => ['Someone else already uses that password. Try another.']], $e->errors());
        }

        $this->assertNull($other->fresh()->password_hash); // and the database can still be used
    }

    public function test_a_hash_that_is_not_bcrypt_signs_nobody_in_and_breaks_nothing(): void
    {
        Member::factory()->withLogin('cardamom-buns')->create();
        config(['group.super_admin_hash' => 'not-a-bcrypt-hash']);

        $this->postJson('/api/unlock', ['password' => 'anything-else'])->assertUnprocessable();
        $this->assertNull($this->logins()->attempt('anything-else'));
        $this->assertNull($this->logins()->passwordProblem('a-fresh-password'));
        $this->postJson('/api/unlock', ['password' => 'cardamom-buns'])->assertOk();
    }

    public function test_anyone_able_to_sign_in_at_all(): void
    {
        $this->assertFalse($this->logins()->anyLoginExists());

        $person = Member::factory()->create();
        $this->assertFalse($this->logins()->anyLoginExists(), 'A person with no login does not count.');

        $this->logins()->setPassword($person, 'cardamom-buns');
        $this->assertTrue($this->logins()->anyLoginExists());

        $this->logins()->removePassword($person);
        $this->assertFalse($this->logins()->anyLoginExists());

        $this->useSuperAdmin();
        $this->assertTrue($this->logins()->anyLoginExists());
    }
}
