<?php

namespace Database\Factories;

use App\Models\Member;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Member>
 */
class MemberFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'name' => fake()->firstName().' '.fake()->lastName(),
            'tone' => fake()->randomElement(Member::TONES),
            'gifts' => fake()->randomElements(Member::GIFTS, 3),
            'line' => fake()->sentence(),
            'family' => fake()->sentence(),
            'interests' => fake()->sentence(),
            'good_to_know' => fake()->sentence(),
        ];
    }
}
