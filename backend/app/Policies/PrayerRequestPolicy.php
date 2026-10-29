<?php

namespace App\Policies;

use App\Models\PrayerRequest;
use App\Services\Viewer;

/**
 * Anyone signed in can add a request or an update to one. Changing a request itself is for
 * leaders and the person it is about.
 */
class PrayerRequestPolicy
{
    /** Edit, mark answered, reopen or delete a request, or remove one of its updates. */
    public function manage(Viewer $viewer, PrayerRequest $prayer): bool
    {
        return $viewer->isLeader() || $viewer->is($prayer->member_id);
    }

    /** Moving a request to a different person is for leaders. */
    public function reassign(Viewer $viewer, PrayerRequest $prayer): bool
    {
        return $viewer->isLeader();
    }
}
