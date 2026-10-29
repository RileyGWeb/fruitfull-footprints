<?php

namespace App\Console\Commands;

use App\Models\Member;
use App\Services\Logins;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;

#[Signature('ff:login
    {member : The person, by id or full name}
    {--role= : Make them a member or a leader}
    {--password= : Their new password (asked for when left out, unless only the role changes)}
    {--remove : Take their login away}')]
#[Description('Give someone a login, change their role, or take their login away (for when no leader can)')]
class SetLogin extends Command
{
    public function handle(Logins $logins): int
    {
        $member = $this->findMember((string) $this->argument('member'));

        if ($member === null) {
            return self::FAILURE;
        }

        $role = $this->option('role');

        if ($role !== null && ! in_array($role, Member::ROLES, true)) {
            $this->components->error('The role is member or leader.');

            return self::FAILURE;
        }

        if ($this->option('remove')) {
            if ($role !== null || $this->option('password') !== null) {
                $this->components->error('--remove can’t be combined with --role or --password.');

                return self::FAILURE;
            }

            $logins->removePassword($member);
            $this->components->info("{$member->name} can no longer sign in.");

            return self::SUCCESS;
        }

        $newPassword = $this->option('password')
            ?? ($role === null ? password(label: "New password for {$member->name}", required: true) : null);

        if ($newPassword !== null && ($problem = $logins->passwordProblem($newPassword, $member)) !== null) {
            $this->components->error($problem);

            return self::FAILURE;
        }

        if ($role !== null) {
            $member->forceFill(['role' => $role])->save();
            $this->components->info("{$member->name} is now a {$role}.");
        }

        if ($newPassword !== null) {
            $logins->setPassword($member, $newPassword);
            $this->components->info("{$member->name} can sign in with the new password. Their other devices will need it again.");
        }

        return self::SUCCESS;
    }

    private function findMember(string $who): ?Member
    {
        $matches = ctype_digit($who)
            ? Member::query()->whereKey((int) $who)->get()
            : Member::query()->whereRaw('lower(name) = ?', [mb_strtolower(trim($who))])->get();

        if ($matches->count() > 1) {
            $this->components->error('More than one person has that name; use their id instead.');
        } elseif ($matches->isEmpty()) {
            $this->components->error("No one in the group matches “{$who}”.");
        }

        return $matches->count() === 1 ? $matches->first() : null;
    }
}
