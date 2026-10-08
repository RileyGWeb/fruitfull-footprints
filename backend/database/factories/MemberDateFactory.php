<?php

namespace Database\Factories;

use App\Models\Member;
use App\Models\MemberDate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MemberDate>
 */
class MemberDateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'member_id' => Member::factory(),
            'kind' => 'birthday',
            'label' => null,
            'month' => fake()->numberBetween(1, 12),
            'day' => fake()->numberBetween(1, 28),
            'year' => null,
            'recurring' => true,
        ];
    }

    public function event(): static
    {
        return $this->state(fn (): array => [
            'kind' => 'event',
            'label' => fake()->words(3, true),
            'year' => 2026,
            'recurring' => false,
        ]);
    }
}
