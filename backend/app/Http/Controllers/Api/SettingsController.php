<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdatePasswordRequest;
use App\Http\Requests\UpdateSettingsRequest;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;

class SettingsController extends Controller
{
    public function update(UpdateSettingsRequest $request, Settings $settings): JsonResponse
    {
        $settings->set($request->settings());

        return response()->json($settings->public());
    }

    /**
     * Changing the password locks every other device; this session moves to the new version.
     */
    public function password(UpdatePasswordRequest $request, Settings $settings): Response
    {
        $version = $settings->changePassword($request->validated('password'));

        $request->session()->put('ff_pw_version', $version);

        return response()->noContent();
    }
}
