<?php

namespace App\Http\Requests;

use App\Services\Settings;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdatePasswordRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(Settings $settings): array
    {
        return [
            'current_password' => ['bail', 'required', 'string', function (string $attribute, mixed $value, Closure $fail) use ($settings): void {
                if (! $settings->checkPassword($value)) {
                    $fail('That isn’t the current password.');
                }
            }],
            'password' => ['required', 'string', 'min:6', 'confirmed'],
        ];
    }

    /**
     * `password.min` and `password.confirmed` keep Laravel's wording: the Settings screen
     * (frontend/components/settings/form.ts) spots them by “least”/“min” and “confirm” to
     * show its own copy under the right field, so nothing else here may use those words.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'current_password.required' => 'Type the password you use now.',
            'current_password.string' => 'Type the password you use now.',
            'password.required' => 'Choose a new password.',
            'password.string' => 'This needs to be text.',
        ];
    }
}
