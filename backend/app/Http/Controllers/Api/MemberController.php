<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\SaveMemberRequest;
use App\Http\Resources\MemberResource;
use App\Models\Member;
use App\Services\ActivityLog;
use App\Services\Logins;
use App\Services\Viewer;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\DB;

class MemberController extends Controller
{
    /**
     * Adding people is leaders' work (route middleware). A leader can give the new person a role
     * and a password right away.
     */
    public function store(SaveMemberRequest $request, ActivityLog $activity, Logins $logins): MemberResource
    {
        $member = DB::transaction(function () use ($request, $activity, $logins): Member {
            $member = new Member($request->profile());
            $member->tone ??= Member::TONES[Member::count() % count(Member::TONES)];
            $member->role = $request->input('role', 'member');
            $member->save();

            if ($request->filled('password')) {
                $logins->setPassword($member, $request->input('password'));
            }

            $activity->memberAdded($member);

            return $member;
        });

        return new MemberResource($member);
    }

    /**
     * A leader edits anyone, a member only themselves; the request refuses the rest. A new
     * password signs that person out everywhere else, but not the device that just set it.
     */
    public function update(SaveMemberRequest $request, Member $member, Logins $logins): MemberResource
    {
        DB::transaction(function () use ($request, $member, $logins): void {
            $member->update($request->profile());

            if ($request->has('role')) {
                $member->forceFill(['role' => $request->input('role')])->save();
            }

            if ($request->filled('password')) {
                $logins->setPassword($member, $request->input('password'));
                $logins->refreshSession($request, $member);
            }
        });

        return new MemberResource($member);
    }

    /**
     * Removing someone also signs them out: their login goes with them.
     */
    public function destroy(Request $request, Member $member): Response
    {
        Viewer::from($request)->authorize('delete', $member);

        $member->delete();

        return response()->noContent();
    }

    /**
     * Take someone's password away. They stay in the group, they just can't sign in.
     */
    public function destroyLogin(Request $request, Member $member, Logins $logins): MemberResource
    {
        Viewer::from($request)->authorize('removeLogin', $member);

        $logins->removePassword($member);

        return new MemberResource($member);
    }
}
