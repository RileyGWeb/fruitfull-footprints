<?php

namespace Tests;

use App\Models\Member;
use App\Services\Logins;
use Illuminate\Foundation\Testing\TestCase as BaseTestCase;
use Illuminate\Support\Facades\Hash;

abstract class TestCase extends BaseTestCase
{
    /** The test super admin's password (the hash is put in config by useSuperAdmin()). */
    protected const SUPER_PASSWORD = 'super-admin-test-password';

    /**
     * Make the following requests from the super admin's device: signed in, no profile, allowed
     * to do anything. The simplest way through the gate for tests that aren't about who is asking.
     */
    protected function unlocked(): static
    {
        return $this->withSession(['ff_unlocked' => true, 'ff_super' => $this->useSuperAdmin()]);
    }

    /**
     * Configure a super admin and return the fingerprint a signed-in session carries.
     */
    protected function useSuperAdmin(string $password = self::SUPER_PASSWORD): string
    {
        config(['group.super_admin_hash' => Hash::make($password)]);

        return app(Logins::class)->superAdminFingerprint();
    }

    /**
     * Make the following requests from a device where this person is signed in. They get a
     * login first if they have none.
     */
    protected function signedInAs(Member $member): static
    {
        if (! $member->hasLogin()) {
            app(Logins::class)->setPassword($member, 'sign-in-'.$member->id.'-'.fake()->unique()->numerify('######'));
        }

        return $this->withSession([
            'ff_unlocked' => true,
            'ff_member_id' => $member->id,
            'ff_auth_version' => $member->auth_version,
        ]);
    }

    /**
     * Requests from a new leader (or the one given).
     */
    protected function asLeader(?Member $leader = null): static
    {
        return $this->signedInAs($leader ?? Member::factory()->leader()->create());
    }

    /**
     * Requests from a new regular member (or the one given).
     */
    protected function asMember(?Member $member = null): static
    {
        return $this->signedInAs($member ?? Member::factory()->create());
    }
}
