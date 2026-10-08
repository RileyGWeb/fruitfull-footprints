<?php

namespace App\Http\Resources;

use App\Models\PrayerRequest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PrayerRequest
 */
class PrayerResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'member_id' => $this->member_id,
            'body' => $this->body,
            'status' => $this->status,
            'answer' => $this->answer,
            'answered_at' => $this->answered_at,
            'created_at' => $this->created_at,
            'updates' => PrayerUpdateResource::collection($this->updates),
        ];
    }
}
