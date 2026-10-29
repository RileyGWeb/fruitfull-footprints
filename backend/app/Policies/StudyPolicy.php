<?php

namespace App\Policies;

use App\Models\Study;
use App\Services\Viewer;

/**
 * Leaders write the studies; members read the published ones, and drafts stay out of their sight.
 */
class StudyPolicy
{
    public function view(Viewer $viewer, Study $study): bool
    {
        return $viewer->isLeader() || $study->isPublished();
    }

    public function create(Viewer $viewer): bool
    {
        return $viewer->isLeader();
    }

    public function update(Viewer $viewer, Study $study): bool
    {
        return $viewer->isLeader();
    }

    public function delete(Viewer $viewer, Study $study): bool
    {
        return $viewer->isLeader();
    }
}
