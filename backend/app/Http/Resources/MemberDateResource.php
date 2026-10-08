<?php

namespace App\Http\Resources;

use App\Models\MemberDate;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin MemberDate
 */
class MemberDateResource extends JsonResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'member_id' => $this->member_id,
            'kind' => $this->kind,
            'label' => $this->label,
            'month' => $this->month,
            'day' => $this->day,
            'year' => $this->year,
            'recurring' => $this->recurring,
        ];
    }
}
