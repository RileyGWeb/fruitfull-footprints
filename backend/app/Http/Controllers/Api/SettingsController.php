<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\UpdateSettingsRequest;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;

class SettingsController extends Controller
{
    /**
     * The group's details. Leaders only (route middleware).
     */
    public function update(UpdateSettingsRequest $request, Settings $settings): JsonResponse
    {
        $settings->set($request->settings());

        return response()->json($settings->public());
    }
}
