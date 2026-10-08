<?php

namespace App\Services;

use App\Models\Activity;
use App\Models\Member;
use App\Models\Study;

/**
 * Writes the "Recently" feed on the home screen. Only the server adds entries.
 */
class ActivityLog
{
    public function memberAdded(Member $member): void
    {
        $this->log('member_added', "{$member->first_name} joined the group");
    }

    public function prayerAdded(Member $member): void
    {
        $this->log('prayer_added', "New prayer request for {$member->first_name}");
    }

    public function prayerUpdated(Member $member): void
    {
        $this->log('prayer_updated', "{$member->first_name}’s request has an update");
    }

    public function prayerAnswered(Member $member): void
    {
        $this->log('prayer_answered', "{$member->first_name}’s prayer was marked answered");
    }

    public function studyPublished(Study $study): void
    {
        $this->log('study_published', "{$study->ref} study notes were published");
    }

    private function log(string $kind, string $text): void
    {
        Activity::create(['kind' => $kind, 'text' => $text]);
    }
}
