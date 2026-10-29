<?php

namespace App\Policies;

use App\Models\Member;
use App\Services\Viewer;

/**
 * Who can change people. Everyone signed in can read everyone.
 */
class MemberPolicy
{
    /** Adding people is for leaders. */
    public function create(Viewer $viewer): bool
    {
        return $viewer->isLeader();
    }

    /** A profile and its dates are changed by a leader, or by the person they belong to. */
    public function update(Viewer $viewer, Member $member): bool
    {
        return $viewer->isLeader() || $viewer->is($member);
    }

    /** Leaders remove people, but not themselves. */
    public function delete(Viewer $viewer, Member $member): bool
    {
        return $viewer->isLeader() && ! $viewer->is($member);
    }

    /** Roles and passwords are for leaders. */
    public function manageLogin(Viewer $viewer, Member $member): bool
    {
        return $viewer->isLeader();
    }

    /** Taking a login away is for leaders too, but not their own: that would lock them out. */
    public function removeLogin(Viewer $viewer, Member $member): bool
    {
        return $viewer->isLeader() && ! $viewer->is($member);
    }
}
