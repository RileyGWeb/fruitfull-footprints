<?php

use App\Http\Middleware\ApiResponseHeaders;
use App\Http\Middleware\EnsureGroupUnlocked;
use App\Http\Middleware\EnsureLeader;
use App\Services\Viewer;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use Symfony\Component\HttpKernel\Exception\HttpExceptionInterface;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
        // The API is cookie-session based (no tokens), so it runs through the `web` group:
        // cookies, session, CSRF (PreventRequestForgery) and route model binding. The headers
        // middleware wraps the group so 419s and 429s get no-store / nosniff too.
        then: fn () => Route::middleware([ApiResponseHeaders::class, 'web'])->prefix('api')
            ->group(base_path('routes/api.php')),
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->alias([
            'group.unlocked' => EnsureGroupUnlocked::class,
            'leader' => EnsureLeader::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );

        // Every 403 (a policy, a form request, the `leader` gate) says the same plain thing.
        $exceptions->render(function (HttpExceptionInterface $e, Request $request) {
            if ($e->getStatusCode() === 403 && ($request->is('api/*') || $request->expectsJson())) {
                return response()->json(['message' => Viewer::FORBIDDEN], 403);
            }
        });
    })->create();
