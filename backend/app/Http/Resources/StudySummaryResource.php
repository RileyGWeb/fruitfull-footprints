<?php

namespace App\Http\Resources;

use App\Models\Study;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * A study without its sections, as listed in the snapshot.
 *
 * @mixin Study
 */
class StudySummaryResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'series' => $this->series,
            'ref' => $this->ref,
            'title' => $this->title,
            'passage' => $this->passage,
            'meeting_date' => $this->meeting_date->toDateString(),
            'location' => $this->location,
            'description' => $this->description,
            'status' => $this->status,
            'published_at' => $this->published_at,
            'verse' => $this->verse,
            'updated_at' => $this->updated_at,
        ];
    }
}
