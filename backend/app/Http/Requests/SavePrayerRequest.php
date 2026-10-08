<?php

namespace App\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * POST creates (member_id and body required); PATCH accepts any subset, plus `answer`.
 * `member_id` may arrive as a numeric string (from a select); `numeric` stops the looser
 * `integer` rule from accepting `true`.
 */
class SavePrayerRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $patch = $this->isMethod('PATCH');
        $required = $patch ? ['sometimes', 'required'] : ['required'];

        return [
            'member_id' => [...$required, 'integer', 'numeric', 'exists:members,id'],
            'body' => [...$required, 'string', 'max:2000'],
            ...($patch ? ['answer' => ['nullable', 'string', 'max:2000']] : []),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'string' => 'This needs to be text.',
            'member_id' => 'Pick someone from the group.',
            'body.required' => 'Add a few words about the request.',
            'body.max' => 'Keep it under 2,000 characters.',
            'answer.max' => 'Keep it under 2,000 characters.',
        ];
    }
}
