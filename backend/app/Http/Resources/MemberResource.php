<?php

namespace App\Http\Resources;

use App\Models\Member;
use App\Services\Viewer;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * Everyone signed in sees a person's role. Whether they can sign in at all (`has_login`) is for
 * leaders; the password and its hashes are never sent.
 *
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
            'role' => $this->role,
            'gifts' => $this->gifts,
            'line' => $this->line,
            'family' => $this->family,
            'interests' => $this->interests,
            'good_to_know' => $this->good_to_know,
            'dates' => MemberDateResource::collection($this->dates),
            'created_at' => $this->created_at,
            'has_login' => $this->when(Viewer::tryFrom($request)?->isLeader() === true, fn (): bool => $this->hasLogin()),
        ];
    }
}
