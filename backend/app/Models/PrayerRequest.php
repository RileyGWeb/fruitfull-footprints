<?php

namespace App\Models;

use Database\Factories\PrayerRequestFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['member_id', 'body', 'status', 'answer', 'answered_at'])]
class PrayerRequest extends Model
{
    /** @use HasFactory<PrayerRequestFactory> */
    use HasFactory;

    /** @var array<string, mixed> */
    protected $attributes = ['status' => 'active'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['member_id' => 'integer', 'answered_at' => 'datetime'];
    }

    /**
     * @return BelongsTo<Member, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }

    /**
     * @return HasMany<PrayerUpdate, $this>
     */
    public function updates(): HasMany
    {
        return $this->hasMany(PrayerUpdate::class)->oldest()->orderBy('id');
    }

    public function isAnswered(): bool
    {
        return $this->status === 'answered';
    }
}
