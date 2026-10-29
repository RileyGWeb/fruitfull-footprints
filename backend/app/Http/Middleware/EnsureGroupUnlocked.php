<?php

namespace App\Http\Middleware;

use App\Services\Logins;
use Closure;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The `group.unlocked` gate: 401 unless someone is signed in (a person with a login, or the super
 * admin), and keeps who on the request for the controllers (see App\Services\Viewer). Implementing
 * AuthenticatesRequests gives it auth-middleware priority, so a locked request gets 401 before route
 * model binding can answer 404.
 */
class EnsureGroupUnlocked implements AuthenticatesRequests
{
    public function __construct(private Logins $logins) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        if ($this->logins->viewerFor($request) === null) {
            return response()->json(['message' => 'Locked'], 401);
        }

        return $next($request);
    }
}
