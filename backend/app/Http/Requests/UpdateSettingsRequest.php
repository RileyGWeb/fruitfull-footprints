<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSettingsRequest extends FormRequest
{
    public const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'group_name' => ['sometimes', 'required', 'string', 'max:120'],
            'tagline' => ['sometimes', 'nullable', 'string', 'max:280'],
            'meeting_day' => ['sometimes', 'required', Rule::in(self::WEEKDAYS)],
            'meeting_time' => ['sometimes', 'required', 'string', 'max:40'],
            'meeting_place' => ['sometimes', 'required', 'string', 'max:160'],
            'since_year' => ['sometimes', 'required', 'integer', 'between:1900,2100'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'string' => 'This needs to be text.',
            'group_name.required' => 'The group needs a name.',
            'group_name.max' => 'Keep it under 120 characters.',
            'tagline.max' => 'Keep it under 280 characters.',
            'meeting_day' => 'Pick the day you usually meet.',
            'meeting_time.required' => 'Add a time, like 7pm.',
            'meeting_time.max' => 'Keep it under 40 characters.',
            'meeting_place.required' => 'Add where you usually meet.',
            'meeting_place.max' => 'Keep it under 160 characters.',
            'since_year' => 'Add the year you started, like 2023.',
            'since_year.between' => 'Pick a year between 1900 and 2100.',
        ];
    }

    /**
     * The validated settings, typed the way they are stored.
     *
     * @return array<string, string|int>
     */
    public function settings(): array
    {
        return collect($this->validated())
            ->map(fn (mixed $value, string $key): string|int => $key === 'since_year' ? (int) $value : (string) $value)
            ->all();
    }
}
