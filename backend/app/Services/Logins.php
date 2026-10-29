<?php

namespace App\Services;

use App\Models\Member;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use RuntimeException;

/**
 * Personal logins. Everyone signs in with a password of their own and nothing else, so the
 * password alone has to say who they are:
 *
 *  - `members.password_lookup` is a keyed hash (HMAC-SHA256 with the app key) of the password, unique
 *    across the group. It finds the person without trying every bcrypt hash, and is useless to
 *    anyone who has the database but not the app key.
 *  - `members.password_hash` is the bcrypt hash that actually confirms it.
 *
 * The hidden super admin is not a member. Their bcrypt hash comes from the server's environment
 * (`SUPER_ADMIN_PASSWORD_HASH`, see config/group.php), never from the database.
 *
 * A session stores who signed in (`ff_member_id` + `ff_auth_version`, or `ff_super` + a fingerprint
 * of the super admin hash). The person is loaded again on every request, so a changed role takes
 * effect straight away, and a changed or removed password, a deleted person or a new super admin
 * hash signs the old sessions out.
 */
class Logins
{
    public const MIN_LENGTH = 8;

    public const MAX_LENGTH = 64;

    /**
     * Passwords nobody should have, lower-cased. Only the ones of 8+ characters matter here.
     */
    private const TOO_COMMON = [
        'password', 'password1', 'password12', 'password123', 'passw0rd', 'p@ssw0rd', '12345678',
        '123456789', '1234567890', '987654321', '11111111', '00000000', 'qwertyui', 'qwerty123',
        'qwertyuiop', 'abcd1234', 'abc12345', 'iloveyou', 'welcome1', 'letmein123', 'footprints',
        'footprints1', 'fruitfull', 'fruitful', 'fruitfulfootprints', 'fruitfullfootprints',
        'fruitfull footprints', 'jesus123', 'jesuslives', 'jesusloves', 'godisgood', 'amazinggrace',
    ];

    /** The session keys that say who signed in; cleared before a new sign-in sets its own. */
    private const SESSION_KEYS = ['ff_unlocked', 'ff_member_id', 'ff_auth_version', 'ff_super', 'ff_pw_version'];

    /**
     * What is stored and compared: the password without the spaces a phone keyboard likes to add.
     */
    public static function clean(string $password): string
    {
        return trim($password);
    }

    public function lookupKey(string $password): string
    {
        return hash_hmac('sha256', self::clean($password), 'ff-login:'.config('app.key'));
    }

    /**
     * The first thing wrong with a password someone wants to give a person, in plain words, or
     * null if it will do. `$except` is the person it's for, whose own current password is fine.
     */
    public function passwordProblem(mixed $password, ?Member $except = null): ?string
    {
        if (! is_string($password)) {
            return 'This needs to be text.';
        }

        $password = self::clean($password);
        $length = mb_strlen($password);

        return match (true) {
            $length < self::MIN_LENGTH => 'Use at least '.self::MIN_LENGTH.' characters.',
            // bcrypt only reads the first 72 bytes, so a long run of multi-byte characters is refused too.
            $length > self::MAX_LENGTH, strlen($password) > 72 => 'Keep it under '.self::MAX_LENGTH.' characters.',
            $this->isTooCommon($password) => 'That one’s too easy to guess. Try something longer or less common.',
            $this->isTaken($password, $except) => 'Someone else already uses that password. Try another.',
            default => null,
        };
    }

    private function isTooCommon(string $password): bool
    {
        return in_array(mb_strtolower($password), self::TOO_COMMON, true)
            || preg_match('/^(.)\1*$/su', $password) === 1;
    }

    /**
     * Whether signing in with this password would already mean someone else: another person, or
     * the super admin.
     */
    public function isTaken(string $password, ?Member $except = null): bool
    {
        $takenByMember = Member::query()
            ->where('password_lookup', $this->lookupKey($password))
            ->when($except?->exists, fn ($query) => $query->whereKeyNot($except->getKey()))
            ->exists();

        return $takenByMember || $this->matchesSuperAdmin($password);
    }

    /**
     * Who this password signs in, if anyone. A miss costs one bcrypt check, the same as a hit,
     * so how long an attempt takes doesn't say how close it was.
     */
    public function attempt(string $password): ?Viewer
    {
        $password = self::clean($password);

        $member = Member::query()->where('password_lookup', $this->lookupKey($password))->first();

        if ($member !== null) {
            return $member->hasLogin() && Hash::check($password, $member->password_hash) ? Viewer::asMember($member) : null;
        }

        return $this->matchesSuperAdmin($password) ? Viewer::superAdmin() : null;
    }

    /**
     * A hash that isn't bcrypt (say, one a shell or .env file mangled, since it holds `$`) is
     * logged and matches nobody, rather than breaking sign-in for everyone.
     */
    private function matchesSuperAdmin(string $password): bool
    {
        $hash = config('group.super_admin_hash');

        if (blank($hash)) {
            return false;
        }

        try {
            return Hash::check($password, $hash);
        } catch (RuntimeException) {
            Log::warning('SUPER_ADMIN_PASSWORD_HASH is not a valid bcrypt hash, so the super admin cannot sign in.');

            return false;
        }
    }

    /**
     * Whether anyone at all could sign in. False on a fresh install with no super admin yet.
     */
    public function anyLoginExists(): bool
    {
        return $this->superAdminFingerprint() !== null || Member::query()->whereNotNull('password_hash')->exists();
    }

    /**
     * Give a person a password (a new one, or a reset). Their other devices are signed out.
     *
     * @throws ValidationException when someone else got the same password first
     */
    public function setPassword(Member $member, string $password): void
    {
        $password = self::clean($password);

        try {
            // A transaction of its own (a savepoint inside the caller's), so a clash can be undone and reported.
            DB::transaction(fn () => $member->forceFill([
                'password_hash' => Hash::make($password),
                'password_lookup' => $this->lookupKey($password),
                'auth_version' => $member->auth_version + 1,
            ])->save());
        } catch (UniqueConstraintViolationException) {
            throw ValidationException::withMessages(['password' => 'Someone else already uses that password. Try another.']);
        }
    }

    /**
     * Take a person's login away, so they can't sign in. Any device that is signed in is signed out.
     */
    public function removePassword(Member $member): void
    {
        $member->forceFill([
            'password_hash' => null,
            'password_lookup' => null,
            'auth_version' => $member->auth_version + 1,
        ])->save();
    }

    /**
     * A short, stable stamp of the super admin hash. Sessions keep it, so changing the hash
     * signs the super admin out everywhere.
     */
    public function superAdminFingerprint(): ?string
    {
        $hash = config('group.super_admin_hash');

        return filled($hash) ? substr(hash('sha256', 'ff-super:'.$hash), 0, 32) : null;
    }

    /**
     * Start a session for a viewer who just proved who they are.
     */
    public function signIn(Request $request, Viewer $viewer): void
    {
        $session = $request->session();

        $session->regenerate();
        $session->forget(self::SESSION_KEYS);

        $session->put($viewer->isSuper()
            ? ['ff_unlocked' => true, 'ff_super' => $this->superAdminFingerprint()]
            : ['ff_unlocked' => true, 'ff_member_id' => $viewer->member->id, 'ff_auth_version' => $viewer->member->auth_version]);
    }

    /**
     * Keep the signed-in device signed in after it changed its own password.
     */
    public function refreshSession(Request $request, Member $member): void
    {
        if ($request->session()->get('ff_member_id') === $member->id) {
            $request->session()->put('ff_auth_version', $member->auth_version);
        }
    }

    /**
     * Who is signed in on this request, or null. Looked up once per request.
     */
    public function viewerFor(Request $request): ?Viewer
    {
        if (($known = Viewer::tryFrom($request)) !== null) {
            return $known;
        }

        $viewer = $this->viewerInSession($request);

        if ($viewer !== null) {
            $request->attributes->set('viewer', $viewer);
        }

        return $viewer;
    }

    private function viewerInSession(Request $request): ?Viewer
    {
        $session = $request->session();

        if ($session->get('ff_unlocked') !== true) {
            return null;
        }

        if ($session->has('ff_super')) {
            $stamp = $session->get('ff_super');
            $current = $this->superAdminFingerprint();

            return is_string($stamp) && $current !== null && hash_equals($current, $stamp) ? Viewer::superAdmin() : null;
        }

        $id = $session->get('ff_member_id');
        $member = is_int($id) ? Member::query()->find($id) : null;

        return $member?->hasLogin() && $member->auth_version === $session->get('ff_auth_version')
            ? Viewer::asMember($member)
            : null;
    }
}
