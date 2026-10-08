<?php

namespace App\Http\Resources;

use App\Models\PrayerUpdate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin PrayerUpdate
 */
class PrayerUpdateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'prayer_request_id' => $this->prayer_request_id,
            'body' => $this->body,
            'created_at' => $this->created_at,
        ];
    }
}
