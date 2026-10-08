<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveStudyRequest;
use App\Http\Resources\StudyResource;
use App\Models\Study;
use App\Services\ActivityLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class StudyController extends Controller
{
    public function show(Study $study): StudyResource
    {
        return new StudyResource($study);
    }

    public function store(SaveStudyRequest $request, ActivityLog $activity): StudyResource
    {
        return DB::transaction(fn (): StudyResource => $this->save(new Study, $request, $activity));
    }

    /**
     * Replace the study, unless the client says which version it loaded (`expected_updated_at`)
     * and someone else has saved since: then nothing changes and the 409 carries the current
     * study. The row is locked while checking, so two saves of the same version can't both win.
     */
    public function update(SaveStudyRequest $request, Study $study, ActivityLog $activity): StudyResource|JsonResponse
    {
        return DB::transaction(function () use ($request, $study, $activity): StudyResource|JsonResponse {
            $study = Study::query()->lockForUpdate()->findOrFail($study->getKey());

            if ($request->isStaleFor($study)) {
                return response()->json([
                    'message' => 'This study was changed somewhere else.',
                    'study' => new StudyResource($study),
                ], 409);
            }

            return $this->save($study, $request, $activity);
        });
    }

    public function destroy(Study $study): Response
    {
        $study->delete();

        return response()->noContent();
    }

    /**
     * Replace the study. Publishing (draft → published, or created published) stamps
     * `published_at` and is logged; moving back to draft clears it.
     */
    private function save(Study $study, SaveStudyRequest $request, ActivityLog $activity): StudyResource
    {
        $study->fill($request->studyAttributes());

        $publishing = $study->isPublished() && $study->getOriginal('status') !== 'published';

        if ($publishing) {
            $study->published_at = now();
        } elseif (! $study->isPublished()) {
            $study->published_at = null;
        }

        $study->save();

        if ($publishing) {
            $activity->studyPublished($study);
        }

        return new StudyResource($study);
    }
}
