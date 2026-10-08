<?php

namespace App\Console\Commands;

use App\Services\Settings;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

use function Laravel\Prompts\password;

#[Signature('ff:password {--password= : The new group password (prompted for when omitted)}')]
#[Description('Set the shared group password; every unlocked device will need it again')]
class SetGroupPassword extends Command
{
    public function handle(Settings $settings): int
    {
        $password = $this->option('password') ?? password(
            label: 'New group password',
            required: true,
            validate: fn (string $value): ?string => mb_strlen($value) < 6 ? 'Use at least 6 characters.' : null,
        );

        if (mb_strlen($password) < 6) {
            $this->components->error('Use at least 6 characters.');

            return self::FAILURE;
        }

        $version = $settings->changePassword($password);

        $this->components->info("Group password set (version {$version}). Other devices will need to unlock again.");

        return self::SUCCESS;
    }
}
