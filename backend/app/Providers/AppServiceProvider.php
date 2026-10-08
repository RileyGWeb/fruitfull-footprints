<?php

namespace App\Providers;

use App\Services\Settings;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Symfony\Component\HttpFoundation\Response;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Settings are read once per request (or job) and cached on the instance.
        $this->app->scoped(Settings::class);
    }

    public function boot(): void
    {
        JsonResource::withoutWrapping();

        $this->configureUnlockThrottle();
    }

    /**
     * The `unlock` limiter: only wrong passwords (422) count, so a whole group unlocking from
     * one Wi-Fi network never trips it. Each client gets 10 misses a minute and 30 an hour, which
     * keeps a single guesser well under the group-wide ceiling of 100 an hour; that ceiling caps
     * guessing from many addresses at once. See docs/contracts/backend.md for the model.
     */
    private function configureUnlockThrottle(): void
    {
        RateLimiter::for('unlock', function (Request $request): array {
            $client = self::clientNetwork((string) $request->ip());
            $failed = fn (Response $response): bool => $response->getStatusCode() === 422;

            return [
                Limit::perMinute(10)->by("minute:{$client}")->after($failed),
                Limit::perHour(30)->by("hour:{$client}")->after($failed),
                Limit::perHour(100)->by('everyone')->after($failed),
            ];
        });
    }

    /**
     * The address a client is throttled by: an IPv4 address as is, an IPv6 address by its /64
     * (one home or server usually holds a whole /64, so single addresses are free to rotate).
     */
    private static function clientNetwork(string $ip): string
    {
        $packed = @inet_pton($ip);

        if ($packed === false || strlen($packed) !== 16) {
            return $ip;
        }

        if (str_starts_with($packed, str_repeat("\0", 10)."\xff\xff")) {
            return (string) inet_ntop(substr($packed, 12));
        }

        return inet_ntop(substr($packed, 0, 8).str_repeat("\0", 8)).'/64';
    }
}
