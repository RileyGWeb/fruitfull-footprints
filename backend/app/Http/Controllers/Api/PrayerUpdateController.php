<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PrayerUpdateResource;
use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use App\Services\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PrayerUpdateController extends Controller
{
    public function store(Request $request, PrayerRequest $prayer, ActivityLog $activity): PrayerUpdateResource
    {
        $data = $request->validate(['body' => ['required', 'string', 'max:2000']], [
            'body.required' => 'Add a few words about what’s changed.',
            'body.string' => 'This needs to be text.',
            'body.max' => 'Keep it under 2,000 characters.',
        ]);

        $update = DB::transaction(function () use ($prayer, $data, $activity): PrayerUpdate {
            $update = $prayer->updates()->create($data);

            $prayer->touch();
            $activity->prayerUpdated($prayer->member);

            return $update;
        });

        return new PrayerUpdateResource($update);
    }

    public function destroy(PrayerUpdate $update): Response
    {
        $update->delete();

        return response()->noContent();
    }
}
