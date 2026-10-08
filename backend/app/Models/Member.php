<?php

namespace App\Models;

use Database\Factories\MemberFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

#[Fillable(['name', 'tone', 'gifts', 'line', 'family', 'interests', 'good_to_know'])]
class Member extends Model
{
    /** @use HasFactory<MemberFactory> */
    use HasFactory;

    /** Avatar tones, in the order new members cycle through them. */
    public const TONES = ['sage', 'accent', 'sand'];

    public const GIFTS = [
        'Encouragement', 'Mercy', 'Hospitality', 'Teaching', 'Serving', 'Giving', 'Leadership',
        'Wisdom', 'Faith', 'Prayer', 'Administration', 'Shepherding', 'Knowledge', 'Evangelism',
    ];

    /** @var array<string, mixed> */
    protected $attributes = ['gifts' => '[]'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return ['gifts' => 'array'];
    }

    /**
     * @return HasMany<MemberDate, $this>
     */
    public function dates(): HasMany
    {
        return $this->hasMany(MemberDate::class)->orderBy('id');
    }

    /**
     * @return HasMany<PrayerRequest, $this>
     */
    public function prayers(): HasMany
    {
        return $this->hasMany(PrayerRequest::class);
    }

    /**
     * The first word of the name, as used in activity copy ("New prayer request for Sarah").
     *
     * @return Attribute<string, never>
     */
    protected function firstName(): Attribute
    {
        return Attribute::get(fn (): string => Str::before(trim($this->name), ' '));
    }
}
