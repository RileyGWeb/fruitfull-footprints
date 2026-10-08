<?php

namespace App\Console\Commands;

use App\Services\Settings;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;
use Illuminate\Contracts\Encryption\DecryptException;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;

/**
 * Every cookie-less request to /api starts a session row, and rows live as long as the session
 * lifetime (a year). Only unlocked devices need theirs, so locked sessions that have sat idle
 * for a day are removed: visitors who never unlocked, devices that locked, and devices still
 * on an old password. A removed device just sees the Entrance, as it would anyway.
 */
#[Signature('ff:prune-sessions {--hours=24 : How long a locked session may sit idle before it goes}')]
#[Description('Remove idle sessions that are not unlocked (scheduled daily)')]
class PruneLockedSessions extends Command
{
    public function handle(Settings $settings): int
    {
        $version = $settings->passwordVersion();
        $removed = 0;

        DB::connection(config('session.connection'))
            ->table(config('session.table'))
            ->select(['id', 'payload'])
            ->where('last_activity', '<', now()->subHours((int) $this->option('hours'))->getTimestamp())
            ->chunkById(500, function (Collection $sessions) use ($version, &$removed): void {
                $locked = $sessions
                    ->reject(fn (object $session): bool => $this->isUnlocked($session->payload, $version))
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
     * The same test as the `group.unlocked` gate, read from a stored payload: base64 of the
     * serialised session (JSON here), encrypted first when SESSION_ENCRYPT is on.
     */
    private function isUnlocked(string $payload, int $version): bool
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

        return is_array($session)
            && ($session['ff_unlocked'] ?? null) === true
            && ($session['ff_pw_version'] ?? null) === $version;
    }
}
