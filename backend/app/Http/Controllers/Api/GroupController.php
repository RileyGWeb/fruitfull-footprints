<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\Logins;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * The public endpoints: who the group is, and signing in / locking this device.
 */
class GroupController extends Controller
{
    public function show(Request $request, Settings $settings, Logins $logins): JsonResponse
    {
        $viewer = $logins->viewerFor($request);

        return response()->json([
            'group_name' => $settings->get('group_name'),
            'tagline' => $settings->get('tagline'),
            'meeting_day' => $settings->get('meeting_day'),
            'since_year' => $settings->get('since_year'),
            'unlocked' => $viewer !== null,
            'viewer' => $viewer?->payload(),
        ]);
    }

    /**
     * The password alone says who is signing in: a person with a login of their own, or the
     * hidden super admin.
     */
    public function unlock(Request $request, Logins $logins): JsonResponse
    {
        if (! $logins->anyLoginExists()) {
            return response()->json([
                'message' => 'No one can sign in yet. Give a person a login with `php artisan ff:login` on the server.',
            ], 503);
        }

        $password = $request->input('password');
        $viewer = is_string($password) ? $logins->attempt($password) : null;

        if ($viewer === null) {
            throw ValidationException::withMessages(['password' => 'Try that once more.']);
        }

        $logins->signIn($request, $viewer);

        return response()->json(['unlocked' => true, 'viewer' => $viewer->payload()]);
    }

    public function lock(Request $request): Response
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
