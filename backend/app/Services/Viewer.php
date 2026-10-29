<?php

namespace App\Services;

use App\Models\Member;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use LogicException;

/**
 * Who is making a request: someone in the group (a member or a leader), or the hidden super
 * admin, who has no profile and can do everything. Logins::viewerFor() works it out from the
 * session and the `group.unlocked` middleware keeps it on the request. What a viewer may do is
 * decided by the policies in app/Policies; `can()` and `authorize()` ask them.
 */
final class Viewer
{
    /** The 403 message, for a middleware or a policy alike (see bootstrap/app.php). */
    public const FORBIDDEN = 'You don’t have access to do that.';

    private function __construct(public readonly ?Member $member) {}

    public static function superAdmin(): self
    {
        return new self(null);
    }

    public static function asMember(Member $member): self
    {
        return new self($member);
    }

    /**
     * The viewer of a request that passed `group.unlocked`.
     */
    public static function from(Request $request): self
    {
        return self::tryFrom($request) ?? throw new LogicException('This request has no signed-in viewer; is `group.unlocked` on the route?');
    }

    public static function tryFrom(Request $request): ?self
    {
        $viewer = $request->attributes->get('viewer');

        return $viewer instanceof self ? $viewer : null;
    }

    public function isSuper(): bool
    {
        return $this->member === null;
    }

    /** Leaders, and the super admin, who is a leader of everything. */
    public function isLeader(): bool
    {
        return $this->member === null || $this->member->isLeader();
    }

    public function memberId(): ?int
    {
        return $this->member?->id;
    }

    /** Whether the viewer is this very person. The super admin is nobody's profile. */
    public function is(Member|int|null $other): bool
    {
        $id = $other instanceof Member ? $other->id : $other;

        return $id !== null && $id === $this->memberId();
    }

    /** `super`, `leader` or `member`. */
    public function role(): string
    {
        return $this->member === null ? 'super' : $this->member->role;
    }

    /**
     * @param  mixed  $arguments  The record (or model class) the policy looks at.
     */
    public function can(string $ability, mixed $arguments = []): bool
    {
        return Gate::forUser($this)->allows($ability, $arguments);
    }

    /**
     * Throws a 403 unless the viewer may do this.
     *
     * @param  mixed  $arguments  The record (or model class) the policy looks at.
     */
    public function authorize(string $ability, mixed $arguments = []): void
    {
        Gate::forUser($this)->authorize($ability, $arguments);
    }

    /**
     * @return array{role: string, member_id: int|null, name: string|null}
     */
    public function payload(): array
    {
        return ['role' => $this->role(), 'member_id' => $this->memberId(), 'name' => $this->member?->name];
    }
}
