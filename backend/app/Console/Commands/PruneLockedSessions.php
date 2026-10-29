<?php

namespace App\Console\Commands;

use App\Models\Member;
use App\Services\Logins;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Every cookie-less request to /api starts a session row, and rows live as long as the session
 * lifetime (a year). Only signed-in devices need theirs, so the rest are removed once they have
 * sat idle for a day: visitors who never signed in, devices that locked, and devices whose login
 * has since changed or gone (a new password, a removed person, a new super admin hash). A removed
 * device just sees the Entrance, as it would anyway.
 */
#[Signature('ff:prune-sessions {--hours=24 : How long a locked session may sit idle before it goes}')]
#[Description('Remove idle sessions that are not unlocked (scheduled daily)')]
class PruneLockedSessions extends Command
{
    public function handle(Logins $logins): int
    {
        // Who can still be signed in: each person with a login, at the version their sessions must hold.
        $versions = Member::query()->whereNotNull('password_hash')->pluck('auth_version', 'id')->all();
        $super = $logins->superAdminFingerprint();
        $removed = 0;

        DB::connection(config('session.connection'))
            ->table(config('session.table'))
            ->select(['id', 'payload'])
            ->where('last_activity', '<', now()->subHours((int) $this->option('hours'))->getTimestamp())
            ->chunkById(500, function (Collection $sessions) use ($versions, $super, &$removed): void {
                $locked = $sessions
                    ->reject(fn (object $session): bool => $this->isSignedIn($session->payload, $versions, $super))
                    ->pluck('id');

                $removed += DB::connection(config('session.connection'))
                    ->table(config('session.table'))
                    ->whereIn('id', $locked)
                    ->delete();
            }, 'id');

        $this->components->info("Removed {$removed} locked ".str('session')->plural($removed).'.');

        return self::SUCCESS;
    }

    /**
     * The same test as the `group.unlocked` gate (Logins::viewerFor), read from a stored payload:
     * base64 of the serialised session (JSON here), encrypted first when SESSION_ENCRYPT is on.
     *
     * @param  array<int, int>  $versions  Each person's id => the `auth_version` their sessions must hold.
     */
    private function isSignedIn(string $payload, array $versions, ?string $super): bool
    {
        $data = base64_decode($payload, true);

        if ($data !== false && config('session.encrypt')) {
            try {
                $data = Crypt::decrypt($data);
            } catch (DecryptException) {
                return false;
            }
        }

        $session = match (true) {
            ! is_string($data) => null,
            config('session.serialization', 'php') === 'json' => json_decode($data, true),
            default => @unserialize($data, ['allowed_classes' => false]),
        };

        if (! is_array($session) || ($session['ff_unlocked'] ?? null) !== true) {
            return false;
        }

        if (array_key_exists('ff_super', $session)) {
            return $super !== null && is_string($session['ff_super']) && hash_equals($super, $session['ff_super']);
        }

        $id = $session['ff_member_id'] ?? null;

        return is_int($id) && ($versions[$id] ?? null) === ($session['ff_auth_version'] ?? null);
    }
}
