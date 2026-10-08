<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Key/value group settings, read with a single query the first time anything asks for one.
 */
class Settings
{
    public const DEFAULTS = [
        'group_name' => 'Fruitfull Footprints',
        'tagline' => 'A private home for our small group.',
        'meeting_day' => 'Wednesday',
        'meeting_time' => '7pm',
        'meeting_place' => 'Rachel’s porch',
        'since_year' => 2023,
        'password_version' => 1,
    ];

    /** The keys exposed to the client as `Settings`, in order. */
    public const PUBLIC_KEYS = ['group_name', 'tagline', 'meeting_day', 'meeting_time', 'meeting_place', 'since_year'];

    /** @var array<string, mixed>|null */
    private ?array $stored = null;

    /**
     * Everything stored in the table (no defaults applied).
     *
     * @return array<string, mixed>
     */
    public function stored(): array
    {
        return $this->stored ??= DB::table('settings')->pluck('value', 'key')
            ->map(fn (string $value): mixed => json_decode($value, true))
            ->all();
    }

    public function get(string $key): mixed
    {
        return $this->stored()[$key] ?? self::DEFAULTS[$key] ?? null;
    }

    /**
     * @param  array<string, mixed>  $values
     */
    public function set(array $values): void
    {
        DB::table('settings')->upsert(
            collect($values)->map(fn (mixed $value, string $key): array => [
                'key' => $key,
                'value' => json_encode($value, JSON_UNESCAPED_UNICODE),
            ])->values()->all(),
            ['key'],
            ['value'],
        );

        $this->stored = array_merge($this->stored(), $values);
    }

    /**
     * @return array{group_name: string, tagline: string, meeting_day: string, meeting_time: string, meeting_place: string, since_year: int}
     */
    public function public(): array
    {
        return collect(self::PUBLIC_KEYS)->mapWithKeys(fn (string $key): array => [$key => $this->get($key)])->all();
    }

    public function hasPassword(): bool
    {
        return filled($this->get('password_hash'));
    }

    public function checkPassword(string $password): bool
    {
        return $this->hasPassword() && Hash::check($password, $this->get('password_hash'));
    }

    public function passwordVersion(): int
    {
        return (int) $this->get('password_version');
    }

    /**
     * Set a new group password and bump the version, which locks every unlocked session.
     *
     * @return int The new password version.
     */
    public function changePassword(string $password): int
    {
        $version = $this->passwordVersion() + 1;

        $this->set(['password_hash' => Hash::make($password), 'password_version' => $version]);

        return $version;
    }
}
