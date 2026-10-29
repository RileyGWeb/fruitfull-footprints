<?php

namespace App\Http\Middleware;

use App\Services\Logins;
use Closure;
use Illuminate\Contracts\Auth\Middleware\AuthenticatesRequests;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * The `leader` gate for routes only leaders (and the super admin) may use: 401 when nobody is
 * signed in, 403 for a regular member. It looks the viewer up itself, so it doesn't depend on
 * running after `group.unlocked`, and like that gate it answers before route model binding.
 */
class EnsureLeader implements AuthenticatesRequests
{
    public function __construct(private Logins $logins) {}

    /**
     * @param  Closure(Request): (Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $viewer = $this->logins->viewerFor($request);

        if ($viewer === null) {
            return response()->json(['message' => 'Locked'], 401);
        }

        abort_unless($viewer->isLeader(), 403);

        return $next($request);
    }
}
