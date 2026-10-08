<?php

namespace App\Http\Resources;

use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin Member
 */
class MemberResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
            'tone' => $this->tone,
            'gifts' => $this->gifts,
            'line' => $this->line,
            'family' => $this->family,
            'interests' => $this->interests,
            'good_to_know' => $this->good_to_know,
            'dates' => MemberDateResource::collection($this->dates),
            'created_at' => $this->created_at,
        ];
    }
}
