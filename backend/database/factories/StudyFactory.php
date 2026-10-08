<?php

namespace Database\Factories;

use App\Models\Study;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Study>
 */
class StudyFactory extends Factory
{
    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $chapter = fake()->numberBetween(1, 16);

        return [
            'ref' => "Romans {$chapter}",
            'title' => fake()->words(3, true),
            'passage' => "Romans {$chapter}:1–10",
            'meeting_date' => fake()->dateTimeBetween('-3 months', '+1 month')->format('Y-m-d'),
            'description' => fake()->sentence(),
            'sections' => Study::sanitizeSections([
                ['type' => 'text', 'heading' => 'Opening Thought', 'body' => fake()->paragraph()],
                ['type' => 'scripture', 'ref' => "Romans {$chapter}:1", 'text' => fake()->sentence(12)],
                ['type' => 'questions', 'heading' => 'Discussion Questions', 'items' => [fake()->sentence().'?']],
            ]),
            'status' => 'published',
            'published_at' => now()->subDays(2),
        ];
    }

    public function draft(): static
    {
        return $this->state(fn (): array => ['status' => 'draft', 'published_at' => null]);
    }
}
