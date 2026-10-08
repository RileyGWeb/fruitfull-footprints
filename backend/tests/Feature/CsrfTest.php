<?php

namespace Tests\Feature;

use Illuminate\Cookie\CookieValuePrefix;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The API runs through the `web` group, so writes need the XSRF token (or a same-origin
 * Sec-Fetch-Site header, which Laravel 13's PreventRequestForgery also accepts).
 */
class CsrfTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();

        // PreventRequestForgery stands aside while unit tests run; make it enforce.
        $this->app['env'] = 'local';

        $this->setGroupPassword('footprints');
    }

    public function test_a_write_without_a_token_is_rejected_with_419(): void
    {
        $this->postJson('/api/unlock', ['password' => 'footprints'])
            ->assertStatus(419)
            ->assertJsonPath('message', 'CSRF token mismatch.');

        $this->postJson('/api/lock')->assertStatus(419);
        $this->unlocked()->patchJson('/api/settings', ['group_name' => 'Hijacked'])->assertStatus(419);
    }

    public function test_a_cross_site_write_with_a_bad_token_is_rejected(): void
    {
        $this->withHeaders(['Sec-Fetch-Site' => 'cross-site', 'X-XSRF-TOKEN' => 'forged'])
            ->postJson('/api/unlock', ['password' => 'footprints'])
            ->assertStatus(419);
    }

    public function test_the_xsrf_cookie_from_get_group_authorises_writes(): void
    {
        $token = $this->xsrfToken($this->getJson('/api/group'));

        $this->withHeader('X-XSRF-TOKEN', $token)
            ->postJson('/api/unlock', ['password' => 'footprints'])
            ->assertOk();
    }

    public function test_a_same_origin_request_proxied_by_next_passes(): void
    {
        $token = $this->xsrfToken($this->getJson('/api/group'));

        $this->withHeaders([
            'Origin' => 'http://localhost:3110',
            'Referer' => 'http://localhost:3110/',
            'Sec-Fetch-Site' => 'same-origin',
            'X-Forwarded-For' => '192.0.2.10',
            'X-XSRF-TOKEN' => $token,
        ])->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
    }

    public function test_reads_never_need_a_token(): void
    {
        $this->getJson('/api/group')->assertOk();
        $this->unlocked()->getJson('/api/snapshot')->assertOk();
    }

    public function test_unlocking_and_locking_rotate_the_token(): void
    {
        $first = $this->xsrfToken($this->getJson('/api/group'));
        $unlocked = $this->xsrfToken(
            $this->withHeader('X-XSRF-TOKEN', $first)->postJson('/api/unlock', ['password' => 'footprints'])->assertOk()
        );

        $this->assertNotSame($this->decrypted($first), $this->decrypted($unlocked));
        $this->withHeader('X-XSRF-TOKEN', $first)->postJson('/api/lock')->assertStatus(419);

        $locked = $this->xsrfToken($this->withHeader('X-XSRF-TOKEN', $unlocked)->postJson('/api/lock')->assertNoContent());

        $this->withHeader('X-XSRF-TOKEN', $unlocked)->postJson('/api/unlock', ['password' => 'footprints'])->assertStatus(419);
        $this->withHeader('X-XSRF-TOKEN', $locked)->postJson('/api/unlock', ['password' => 'footprints'])->assertOk();
    }

    /**
     * The raw (encrypted) cookie value, which is exactly what a browser client echoes back.
     */
    private function xsrfToken(TestResponse $response): string
    {
        return $response->assertCookie('XSRF-TOKEN')->getCookie('XSRF-TOKEN', decrypt: false)->getValue();
    }

    private function decrypted(string $cookie): string
    {
        return CookieValuePrefix::remove(Crypt::decrypt($cookie, unserialize: false));
    }
}
