<?php

namespace App\Http\Requests;

use App\Models\Member;
use App\Services\Logins;
use App\Services\Viewer;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Support\Arr;
use Illuminate\Validation\Rule;

/**
 * POST creates (name required); PATCH accepts any subset. Repeated gifts are kept once.
 *
 * Leaders add people and edit anyone; a member edits only their own profile. `role` and
 * `password` (the person's login) are for leaders: a member who sends either is refused.
 */
class SaveMemberRequest extends FormRequest
{
    public function authorize(): bool
    {
        $viewer = Viewer::from($this);
        $member = $this->route('member');

        $allowed = $member instanceof Member ? $viewer->can('update', $member) : $viewer->can('create', Member::class);

        return $allowed && ($viewer->isLeader() || ! $this->hasAny(['role', 'password']));
    }

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
            'role' => ['sometimes', Rule::in(Member::ROLES), $this->notSteppingDown(...)],
            'password' => ['sometimes', 'nullable', $this->usablePassword(...)],
        ];
    }

    /**
     * The profile fields only: what anyone allowed to edit this person may change.
     *
     * @return array<string, mixed>
     */
    public function profile(): array
    {
        return Arr::except($this->validated(), ['role', 'password']);
    }

    /**
     * A leader can't take their own leadership away: someone else has to, so the group is
     * never left without one by accident.
     */
    private function notSteppingDown(string $attribute, mixed $value, Closure $fail): void
    {
        $member = $this->route('member');

        if ($member instanceof Member && $member->isLeader() && $value !== 'leader' && Viewer::from($this)->is($member)) {
            $fail('You can’t step down yourself. Ask another leader.');
        }
    }

    /**
     * Long enough, not a common one, and not already someone else's: the password alone says
     * who signs in, so no two people can share one.
     */
    private function usablePassword(string $attribute, mixed $value, Closure $fail): void
    {
        $member = $this->route('member');
        $problem = app(Logins::class)->passwordProblem($value, $member instanceof Member ? $member : null);

        if ($problem !== null) {
            $fail($problem);
        }
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
            'role.in' => 'Pick member or leader.',
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
