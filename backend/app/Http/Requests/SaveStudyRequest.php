<?php

namespace App\Http\Requests;

use App\Models\Study;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

/**
 * POST and PUT both send the whole study; `ref` and `title` are only required to publish.
 */
class SaveStudyRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'series' => ['nullable', 'string', 'max:120'],
            'ref' => ['nullable', 'required_if:status,published', 'string', 'max:120'],
            'title' => ['nullable', 'required_if:status,published', 'string', 'max:160'],
            'passage' => ['nullable', 'string', 'max:160'],
            'meeting_date' => ['required', 'date_format:Y-m-d', 'after_or_equal:1900-01-01', 'before_or_equal:2200-12-31'],
            'location' => ['nullable', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:2000'],
            'status' => ['required', Rule::in(['draft', 'published'])],
            'sections' => ['present', 'array', 'max:60'],
            'sections.*' => ['array'],
            'sections.*.id' => ['nullable', 'string', 'max:40'],
            'sections.*.type' => ['required', Rule::in(Study::SECTION_TYPES)],
            'sections.*.heading' => ['nullable', 'string', 'max:20000'],
            'sections.*.body' => ['nullable', 'string', 'max:20000'],
            'sections.*.ref' => ['nullable', 'string', 'max:20000'],
            'sections.*.text' => ['nullable', 'string', 'max:20000'],
            'sections.*.items' => ['nullable', 'array', 'max:40'],
            'sections.*.items.*' => ['nullable', 'string', 'max:20000'],
            'expected_updated_at' => ['nullable', 'date'],
        ];
    }

    /**
     * Some messages keep Laravel's wording on purpose: the editor (`friendly()` in
     * frontend/components/editor/draft.ts) spots “greater than N characters”, “more than
     * N items” and the ref/title “required” to show its own copy, and tells a meeting date
     * out of range from any other date problem by “between”. So every `max` and `required_if`
     * is left alone here, and only the range message may say “between”.
     *
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'string' => 'This needs to be text.',
            'meeting_date.required' => 'Pick the date we’ll meet.',
            'meeting_date.date_format' => 'Pick the date we’ll meet.',
            'meeting_date.after_or_equal' => 'Pick a date between 1900 and 2200.',
            'meeting_date.before_or_equal' => 'Pick a date between 1900 and 2200.',
            'status' => 'Save it as a draft or publish it.',
            'sections.present' => 'The sections didn’t come through — try saving again.',
            'sections.array' => 'The sections didn’t come through — try saving again.',
            'sections.*.array' => 'This section didn’t come through — try saving again.',
            'sections.*.type' => 'Pick a kind for this section.',
            'sections.*.items.array' => 'The questions didn’t come through — try saving again.',
            'expected_updated_at' => 'Reload the study and try again.',
        ];
    }

    /**
     * Drop blank question lines before validating, so the 40-question limit counts questions
     * rather than the editor's textarea lines.
     */
    protected function prepareForValidation(): void
    {
        $sections = $this->input('sections');

        if (! is_array($sections)) {
            return;
        }

        foreach ($sections as $key => $section) {
            if (is_array($section) && is_array($section['items'] ?? null)) {
                $sections[$key]['items'] = array_values(array_filter(
                    $section['items'],
                    fn (mixed $item): bool => $item !== null && (! is_string($item) || trim($item) !== ''),
                ));
            }
        }

        $this->merge(['sections' => $sections]);
    }

    /**
     * The validated study with its sections sanitised. Omitted optional fields come back as
     * null, because a save replaces the whole study.
     *
     * Sections are read from the (already validated) input: `validated()` rebuilds nested
     * arrays leaf by leaf, which reorders sections that lack an optional key such as `id`.
     *
     * @return array<string, mixed>
     */
    public function studyAttributes(): array
    {
        return [
            ...array_fill_keys(['series', 'ref', 'title', 'passage', 'location', 'description'], null),
            ...$this->safe()->except(['sections', 'expected_updated_at']),
            'sections' => Study::sanitizeSections($this->input('sections')),
        ];
    }

    /**
     * Whether the study changed after the client loaded it. A PUT may send back the
     * `updated_at` it loaded as `expected_updated_at`; without one the save simply overwrites.
     */
    public function isStaleFor(Study $study): bool
    {
        $expected = $this->validated('expected_updated_at');

        return $expected !== null && ! $study->updated_at?->equalTo(Carbon::parse($expected));
    }
}
