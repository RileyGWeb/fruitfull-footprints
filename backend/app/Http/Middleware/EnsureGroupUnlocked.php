<?php

namespace App\Http\Middleware;

use App\Services\Settings;
use Closure;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The `group.unlocked` gate. Implementing AuthenticatesRequests gives it auth-middleware
 * priority, so a locked request gets 401 before route model binding can answer 404.
 */
class EnsureGroupUnlocked implements AuthenticatesRequests
{
    public function __construct(private Settings $settings) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if (! $this->isUnlocked($request)) {
            return response()->json(['message' => 'Locked'], 401);
        }

        return $next($request);
    }

    /**
     * Unlocked with the current password. Changing the password bumps its version, which
     * locks every session that unlocked with an older one.
     */
    public function isUnlocked(Request $request): bool
    {
        return $request->session()->get('ff_unlocked') === true
            && $request->session()->get('ff_pw_version') === $this->settings->passwordVersion();
    }
}
