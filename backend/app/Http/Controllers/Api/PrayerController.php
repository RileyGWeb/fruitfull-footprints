<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SavePrayerRequest;
use App\Http\Resources\PrayerResource;
use App\Models\PrayerRequest;
use App\Services\ActivityLog;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class PrayerController extends Controller
{
    public function store(SavePrayerRequest $request, ActivityLog $activity): PrayerResource
    {
        $prayer = DB::transaction(function () use ($request, $activity): PrayerRequest {
            $prayer = PrayerRequest::create($request->validated());

            $activity->prayerAdded($prayer->member);

            return $prayer;
        });

        return new PrayerResource($prayer);
    }

    /**
     * Edit the text or person; `answer` is only kept on answered requests.
     */
    public function update(SavePrayerRequest $request, PrayerRequest $prayer): PrayerResource
    {
        $prayer->update($prayer->isAnswered() ? $request->validated() : $request->safe()->except('answer'));

        return new PrayerResource($prayer);
    }

    public function destroy(PrayerRequest $prayer): Response
    {
        $prayer->delete();

        return response()->noContent();
    }

    /**
     * Mark an active request answered (logged), or edit the answer of one that already is.
     */
    public function answer(Request $request, PrayerRequest $prayer, ActivityLog $activity): PrayerResource
    {
        $data = $request->validate(['answer' => ['nullable', 'string', 'max:2000']], [
            'answer.string' => 'This needs to be text.',
            'answer.max' => 'Keep it under 2,000 characters.',
        ]);

        if ($prayer->isAnswered()) {
            $prayer->update($data);
        } else {
            DB::transaction(function () use ($prayer, $data, $activity): void {
                $prayer->update(['status' => 'answered', 'answered_at' => now(), 'answer' => $data['answer'] ?? null]);

                $activity->prayerAnswered($prayer->member);
            });
        }

        return new PrayerResource($prayer);
    }

    public function reopen(PrayerRequest $prayer): PrayerResource
    {
        $prayer->update(['status' => 'active', 'answer' => null, 'answered_at' => null]);

        return new PrayerResource($prayer);
    }
}
