<?php

namespace App\Http\Requests;

use App\Models\MemberDate;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * POST creates (kind, date and recurring required); PATCH accepts any subset.
 *
 * `date` is a full `YYYY-MM-DD`, or `--MM-DD` for a recurring date kept without a year.
 */
class SaveMemberDateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $required = $this->isMethod('PATCH') ? ['sometimes', 'required'] : ['required'];

        return [
            'kind' => [...$required, Rule::in(MemberDate::KINDS)],
            'label' => ['nullable', 'string', 'max:160'],
            'date' => [...$required, ...($this->isYearless()
                ? [$this->yearlessDay(...)]
                : ['date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:2200-12-31'])],
            'recurring' => [...$required, 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'string' => 'This needs to be text.',
            'kind' => 'Pick a kind of date.',
            'label.max' => 'Keep it under 160 characters.',
            'date.required' => 'Pick a date.',
            'date.date_format' => 'That date isn’t on the calendar.',
            'date.after_or_equal' => 'Pick a date between 1900 and 2200.',
            'date.before_or_equal' => 'Pick a date between 1900 and 2200.',
            'recurring' => 'Choose whether to remember it every year.',
        ];
    }

    /**
     * A one-time date needs a year. Checked against the date as it will be saved: a PATCH may
     * send only `recurring` or only `date`, and the other half comes from the stored date.
     *
     * @return array<int, Closure(Validator): void>
     */
    public function after(): array
    {
        return [function (Validator $validator): void {
            if ($validator->errors()->hasAny(['date', 'recurring'])) {
                return;
            }

            $stored = $this->route('date');
            $stored = $stored instanceof MemberDate ? $stored : null;

            $year = $this->has('date') ? self::split($this->input('date'))[0] : $stored?->year;
            $recurring = $this->has('recurring') ? $this->boolean('recurring') : ($stored?->recurring ?? true);

            if (! $recurring && $year === null) {
                $validator->errors()->add('date', 'A one-time date needs a year.');
            }
        }];
    }

    /**
     * The validated input with `date` split into the stored month / day / year columns.
     *
     * @return array<string, mixed>
     */
    public function modelAttributes(): array
    {
        $attributes = $this->safe()->except('date');

        if ($this->has('date')) {
            [$attributes['year'], $attributes['month'], $attributes['day']] = self::split($this->validated('date'));
        }

        return $attributes;
    }

    private function isYearless(): bool
    {
        $date = $this->input('date');

        return is_string($date) && str_starts_with($date, '--');
    }

    /**
     * A yearless `--MM-DD` only has to exist in some year, so February 29 is fine.
     */
    private function yearlessDay(string $attribute, mixed $value, Closure $fail): void
    {
        if (preg_match('/^--(\d{2})-(\d{2})$/D', $value, $parts) !== 1 || ! checkdate((int) $parts[1], (int) $parts[2], 2000)) {
            $fail('That date isn’t on the calendar.');
        }
    }

    /**
     * A valid `YYYY-MM-DD` as [year, month, day], or a `--MM-DD` as [null, month, day].
     *
     * @return array{0: int|null, 1: int, 2: int}
     */
    private static function split(string $date): array
    {
        $parts = array_map(intval(...), explode('-', ltrim($date, '-')));

        return str_starts_with($date, '--') ? [null, ...$parts] : $parts;
    }
}
