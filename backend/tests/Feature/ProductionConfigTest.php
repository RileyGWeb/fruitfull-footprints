<?php

namespace Tests\Feature;

use Closure;
use PHPUnit\Framework\Attributes\DataProvider;
use Tests\TestCase;

class ProductionConfigTest extends TestCase
{
    /**
     * @return array<string, array{0: array<string, string>, 1: ?bool}>
     */
    public static function secureCookieCases(): array
    {
        return [
            'production' => [['APP_ENV' => 'production'], true],
            'production over plain http, on purpose' => [['APP_ENV' => 'production', 'SESSION_SECURE_COOKIE' => 'false'], false],
            'local follows the request scheme' => [['APP_ENV' => 'local'], null],
            'local, forced on' => [['APP_ENV' => 'local', 'SESSION_SECURE_COOKIE' => 'true'], true],
        ];
    }

    /**
     * @param  array<string, string>  $env
     */
    #[DataProvider('secureCookieCases')]
    public function test_session_cookies_are_secure_by_default_in_production(array $env, ?bool $secure): void
    {
        $this->assertSame($secure, $this->withEnvironment($env, fn (): mixed => (require config_path('session.php'))['secure']));
    }

    /**
     * Read a config file under the given environment variables (others of interest unset).
     *
     * @param  array<string, string>  $env
     */
    private function withEnvironment(array $env, Closure $read): mixed
    {
        $keys = ['APP_ENV', 'SESSION_SECURE_COOKIE'];
        $saved = array_map(fn (string $key): array => [$_SERVER[$key] ?? null, $_ENV[$key] ?? null, getenv($key)], array_combine($keys, $keys));

        $set = function (string $key, ?string $value): void {
            if ($value === null) {
                unset($_SERVER[$key], $_ENV[$key]);
                putenv($key);
            } else {
                $_SERVER[$key] = $_ENV[$key] = $value;
                putenv("{$key}={$value}");
            }
        };

        foreach ($keys as $key) {
            $set($key, $env[$key] ?? null);
        }

        try {
            return $read();
        } finally {
            foreach ($saved as $key => [$server, $environment, $process]) {
                $set($key, null);
                if ($server !== null) {
                    $_SERVER[$key] = $server;
                }
                if ($environment !== null) {
                    $_ENV[$key] = $environment;
                }
                if ($process !== false) {
                    putenv("{$key}={$process}");
                }
            }
        }
    }
}
