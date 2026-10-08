<?php

namespace Tests\Feature;

use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Testing\TestResponse;
use Tests\TestCase;

/**
 * The API is same-origin through the Next.js proxy: no CORS, and nothing it returns is kept in
 * the browser's HTTP cache (the service worker keeps its own offline copy).
 */
class ApiResponseHeadersTest extends TestCase
{
    use RefreshDatabase;

    private function assertPrivate(TestResponse $response): void
    {
        $response->assertHeader('Cache-Control', 'no-store, private')
            ->assertHeader('X-Content-Type-Options', 'nosniff')
            ->assertHeaderMissing('Access-Control-Allow-Origin');
    }

    public function test_public_and_unlocked_responses_are_never_cached(): void
    {
        $this->assertPrivate($this->withHeader('Origin', 'https://evil.example')->getJson('/api/group')->assertOk());
        $this->assertPrivate($this->unlocked()->getJson('/api/snapshot')->assertOk());
    }

    public function test_error_responses_carry_the_headers_too(): void
    {
        $this->assertPrivate($this->getJson('/api/snapshot')->assertUnauthorized());
        $this->assertPrivate($this->postJson('/api/unlock', ['password' => 'x'])->assertServiceUnavailable());

        $this->app['env'] = 'local'; // PreventRequestForgery stands aside in unit tests otherwise.
        $this->assertPrivate($this->postJson('/api/lock')->assertStatus(419));
    }

    public function test_a_cross_origin_preflight_is_not_approved(): void
    {
        $this->withHeaders([
            'Origin' => 'https://evil.example',
            'Access-Control-Request-Method' => 'PATCH',
            'Access-Control-Request-Headers' => 'content-type,x-xsrf-token',
        ])->options('/api/settings')
            ->assertHeaderMissing('Access-Control-Allow-Origin')
            ->assertHeaderMissing('Access-Control-Allow-Methods')
            ->assertHeaderMissing('Access-Control-Allow-Headers');
    }
}
