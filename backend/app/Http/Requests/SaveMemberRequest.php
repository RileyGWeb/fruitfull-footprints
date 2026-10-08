<?php

namespace App\Http\Requests;

use App\Models\Member;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

/**
 * POST creates (name required); PATCH accepts any subset. Repeated gifts are kept once.
 */
class SaveMemberRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $patch = $this->isMethod('PATCH');

        return [
            'name' => [...($patch ? ['sometimes'] : []), 'required', 'string', 'max:120'],
            'tone' => [$patch ? 'sometimes' : 'nullable', Rule::in(Member::TONES)],
            'gifts' => ['sometimes', 'list', 'max:14'],
            'gifts.*' => ['string', Rule::in(Member::GIFTS)],
            'line' => ['nullable', 'string', 'max:280'],
            'family' => ['nullable', 'string', 'max:1000'],
            'interests' => ['nullable', 'string', 'max:1000'],
            'good_to_know' => ['nullable', 'string', 'max:1000'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'string' => 'This needs to be text.',
            'name.required' => 'Add their name.',
            'name.max' => 'Keep it under 120 characters.',
            'tone' => 'Pick one of the three colors.',
            'gifts' => 'Pick gifts from the list.',
            'gifts.max' => 'Pick up to 14 gifts.',
            'gifts.*.string' => 'Pick gifts from the list.',
            'gifts.*.in' => 'Pick gifts from the list.',
            'line.max' => 'Keep it under 280 characters.',
            'family.max' => 'Keep it under 1,000 characters.',
            'interests.max' => 'Keep it under 1,000 characters.',
            'good_to_know.max' => 'Keep it under 1,000 characters.',
        ];
    }

    /**
     * Drop repeated gifts (first one wins) so a double-tapped toggle can't fail the save.
     */
    protected function prepareForValidation(): void
    {
        $gifts = $this->input('gifts');

        if (is_array($gifts) && array_is_list($gifts) && collect($gifts)->every(fn (mixed $gift): bool => is_string($gift))) {
            $this->merge(['gifts' => array_values(array_unique($gifts))]);
        }
    }
}
