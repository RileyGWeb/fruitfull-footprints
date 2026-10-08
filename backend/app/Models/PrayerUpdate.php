<?php

namespace App\Models;

use Database\Factories\PrayerUpdateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['body'])]
class PrayerUpdate extends Model
{
    /** @use HasFactory<PrayerUpdateFactory> */
    use HasFactory;

    /**
     * @return BelongsTo<PrayerRequest, $this>
     */
    public function prayerRequest(): BelongsTo
    {
        return $this->belongsTo(PrayerRequest::class);
    }
}
