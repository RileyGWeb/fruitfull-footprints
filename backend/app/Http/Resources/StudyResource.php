<?php

namespace App\Http\Resources;

use App\Models\Study;
use Illuminate\Http\Request;

/**
 * @mixin Study
 */
class StudyResource extends StudySummaryResource
{
    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return [...parent::toArray($request), 'sections' => $this->sections];
    }
}
