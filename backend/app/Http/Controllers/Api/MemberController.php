<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveMemberRequest;
use App\Http\Resources\MemberResource;
use App\Models\Member;
use App\Services\ActivityLog;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class MemberController extends Controller
{
    public function store(SaveMemberRequest $request, ActivityLog $activity): MemberResource
    {
        $member = DB::transaction(function () use ($request, $activity): Member {
            $member = new Member($request->validated());
            $member->tone ??= Member::TONES[Member::count() % count(Member::TONES)];
            $member->save();

            $activity->memberAdded($member);

            return $member;
        });

        return new MemberResource($member);
    }

    public function update(SaveMemberRequest $request, Member $member): MemberResource
    {
        $member->update($request->validated());

        return new MemberResource($member);
    }

    public function destroy(Member $member): Response
    {
        $member->delete();

        return response()->noContent();
    }
}
