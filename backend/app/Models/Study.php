<?php

namespace App\Models;

use Database\Factories\StudyFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

#[Fillable([
    'series', 'ref', 'title', 'passage', 'meeting_date', 'location', 'description', 'sections',
    'status', 'published_at',
])]
class Study extends Model
{
    /** @use HasFactory<StudyFactory> */
    use HasFactory;

    public const SECTION_TYPES = ['text', 'scripture', 'questions', 'reflect', 'prayer'];

    /** @var array<string, mixed> */
    protected $attributes = ['sections' => '[]', 'status' => 'draft'];

    /**
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'meeting_date' => 'date',
            'sections' => 'array',
            'published_at' => 'datetime',
        ];
    }

    protected static function booted(): void
    {
        static::saving(function (Study $study): void {
            if (blank($study->series)) {
                $study->series = static::deriveSeries($study->ref);
            }
        });
    }

    public function isPublished(): bool
    {
        return $this->status === 'published';
    }

    /**
     * The series a ref belongs to: "Romans 9" → "Romans", "1 John 3:1" → "1 John".
     */
    public static function deriveSeries(?string $ref): ?string
    {
        $series = trim(preg_replace('/\s+\d+([:.–-].*)?$/u', '', trim((string) $ref)));

        return $series === '' ? null : $series;
    }

    /**
     * Keep only the fields each section type uses, drop blank question lines, and make sure
     * every section has a unique id (the client's own when it sent a usable one).
     *
     * @param  array<int, array<string, mixed>>  $sections
     * @return list<array{id: string, type: string, heading?: ?string, body?: string, ref?: ?string, text?: string, items?: list<string>}>
     */
    public static function sanitizeSections(array $sections): array
    {
        $seen = [];

        return array_map(function (array $section) use (&$seen): array {
            $id = $section['id'] ?? null;

            if (! is_string($id) || $id === '' || isset($seen[$id])) {
                $id = 's'.Str::random(10);
            }

            $seen[$id] = true;

            return ['id' => $id, 'type' => $section['type'], ...match ($section['type']) {
                'scripture' => [
                    'ref' => $section['ref'] ?? null,
                    'text' => $section['text'] ?? '',
                ],
                'questions' => [
                    'heading' => $section['heading'] ?? null,
                    'items' => array_values(array_filter(
                        array_map(fn (mixed $item): string => trim((string) $item), $section['items'] ?? []),
                        fn (string $item): bool => $item !== '',
                    )),
                ],
                default => [
                    'heading' => $section['heading'] ?? null,
                    'body' => $section['body'] ?? '',
                ],
            }];
        }, array_values($sections));
    }

    /**
     * Pull quote for study cards: the first scripture section's text, cut at the first clause
     * break past 40 characters ("There is therefore now no condemnation to those who are in
     * Christ Jesus…").
     *
     * @return Attribute<?string, never>
     */
    protected function verse(): Attribute
    {
        return Attribute::get(function (): ?string {
            $text = collect($this->sections)
                ->where('type', 'scripture')
                ->pluck('text')
                ->first(fn (?string $text): bool => filled($text));

            if ($text === null) {
                return null;
            }

            $text = preg_replace('/\s+/u', ' ', trim($text));

            return preg_match('/^(.{40,}?)[,;:.?!]\s/u', $text, $match) ? $match[1].'…' : $text;
        });
    }
}
