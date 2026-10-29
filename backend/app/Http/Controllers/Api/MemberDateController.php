<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveMemberDateRequest;
use App\Http\Resources\MemberDateResource;
use App\Models\Member;
use App\Models\MemberDate;
use App\Services\Viewer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class MemberDateController extends Controller
{
    public function store(SaveMemberDateRequest $request, Member $member): MemberDateResource
    {
        return new MemberDateResource($member->dates()->create($request->modelAttributes()));
    }

    public function update(SaveMemberDateRequest $request, MemberDate $date): MemberDateResource
    {
        $date->update($request->modelAttributes());

        return new MemberDateResource($date);
    }

    public function destroy(Request $request, MemberDate $date): Response
    {
        Viewer::from($request)->authorize('update', $date->member);

        $date->delete();

        return response()->noContent();
    }
}
