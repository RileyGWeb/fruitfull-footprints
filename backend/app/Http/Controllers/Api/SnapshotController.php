<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\ActivityResource;
use App\Http\Resources\MemberResource;
use App\Http\Resources\PrayerResource;
use App\Http\Resources\StudySummaryResource;
use App\Models\Activity;
use App\Models\Member;
use App\Models\PrayerRequest;
use App\Models\Study;
use App\Services\Settings;
use Illuminate\Http\JsonResponse;

/**
 * Everything every screen needs, in one request; the client derives its views from this.
 */
class SnapshotController extends Controller
{
    public function __invoke(Settings $settings): JsonResponse
    {
        return response()->json([
            'settings' => $settings->public(),
            'members' => MemberResource::collection(Member::with('dates')->orderBy('created_at')->orderBy('id')->get()),
            'prayers' => PrayerResource::collection(PrayerRequest::with('updates')->latest()->latest('id')->get()),
            'studies' => StudySummaryResource::collection(Study::orderByDesc('meeting_date')->orderByDesc('id')->get()),
            'activity' => ActivityResource::collection(Activity::latest()->latest('id')->limit(20)->get()),
            'server_time' => now(),
        ]);
    }
}
