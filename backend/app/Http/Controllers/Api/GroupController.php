<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Middleware\EnsureGroupUnlocked;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Validation\ValidationException;

/**
 * The public endpoints: who the group is, and unlocking / locking this device.
 */
class GroupController extends Controller
{
    public function show(Request $request, Settings $settings, EnsureGroupUnlocked $gate): JsonResponse
    {
        return response()->json([
            'group_name' => $settings->get('group_name'),
            'tagline' => $settings->get('tagline'),
            'meeting_day' => $settings->get('meeting_day'),
            'since_year' => $settings->get('since_year'),
            'unlocked' => $gate->isUnlocked($request),
        ]);
    }

    public function unlock(Request $request, Settings $settings): JsonResponse
    {
        if (! $settings->hasPassword()) {
            return response()->json([
                'message' => 'No group password is set yet. Run `php artisan ff:password` on the server.',
            ], 503);
        }

        $password = $request->input('password');

        if (! is_string($password) || ! $settings->checkPassword($password)) {
            throw ValidationException::withMessages(['password' => 'Try that once more.']);
        }

        $request->session()->regenerate();
        $request->session()->put(['ff_unlocked' => true, 'ff_pw_version' => $settings->passwordVersion()]);

        return response()->json(['unlocked' => true]);
    }

    public function lock(Request $request): Response
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->noContent();
    }
}
