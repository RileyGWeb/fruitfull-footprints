<?php

namespace Database\Factories;

use App\Models\Member;
use App\Models\PrayerRequest;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrayerRequest>
 */
class PrayerRequestFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'member_id' => Member::factory(),
            'body' => fake()->sentence(),
            'status' => 'active',
        ];
    }

    public function answered(): static
    {
        return $this->state(fn (): array => [
            'status' => 'answered',
            'answer' => fake()->sentence(),
            'answered_at' => now()->subDay(),
        ]);
    }
}
