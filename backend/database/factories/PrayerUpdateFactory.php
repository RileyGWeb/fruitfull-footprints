<?php

namespace Database\Factories;

use App\Models\PrayerRequest;
use App\Models\PrayerUpdate;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<PrayerUpdate>
 */
class PrayerUpdateFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'prayer_request_id' => PrayerRequest::factory(),
            'body' => fake()->sentence(),
        ];
    }
}
