<?php

namespace App\Models;

use Database\Factories\MemberDateFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['kind', 'label', 'month', 'day', 'year', 'recurring'])]
class MemberDate extends Model
{
    /** @use HasFactory<MemberDateFactory> */
    use HasFactory;

    public const KINDS = ['birthday', 'anniversary', 'event'];

    /** @var array<string, mixed> */
    protected $attributes = ['recurring' => true];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'month' => 'integer',
            'day' => 'integer',
            'year' => 'integer',
            'recurring' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (MemberDate $date): void {
            if ($date->kind === 'birthday') {
                $date->label = null;
            }
        });
    }

    /**
     * @return BelongsTo<Member, $this>
     */
    public function member(): BelongsTo
    {
        return $this->belongsTo(Member::class);
    }
}
