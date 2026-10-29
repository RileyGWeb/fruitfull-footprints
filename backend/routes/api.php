<?php

use App\Http\Controllers\Api\GroupController;
use App\Http\Controllers\Api\MemberController;
use App\Http\Controllers\Api\MemberDateController;
use App\Http\Controllers\Api\PrayerController;
use App\Http\Controllers\Api\PrayerUpdateController;
use App\Http\Controllers\Api\SettingsController;
use App\Http\Controllers\Api\SnapshotController;
use App\Http\Controllers\Api\StudyController;
use Illuminate\Support\Facades\Route;

/*
| Loaded under /api with the `web` middleware group (see bootstrap/app.php): cookie session +
| CSRF. Everything except the three group routes needs someone signed in (`group.unlocked`).
| Routes in the `leader` group are for leaders only; the rest are open to every signed-in
| person, and the policies in app/Policies narrow them (your own profile, requests about you,
| published studies).
*/

Route::patterns(array_fill_keys(['member', 'date', 'prayer', 'update', 'study'], '[0-9]{1,18}'));

Route::get('group', [GroupController::class, 'show']);
Route::post('unlock', [GroupController::class, 'unlock'])->middleware('throttle:unlock');
Route::post('lock', [GroupController::class, 'lock']);

Route::middleware('group.unlocked')->group(function (): void {
    Route::get('snapshot', SnapshotController::class);

    Route::middleware('leader')->group(function (): void {
        Route::patch('settings', [SettingsController::class, 'update']);

        Route::post('members', [MemberController::class, 'store']);
        Route::delete('members/{member}', [MemberController::class, 'destroy']);
        Route::delete('members/{member}/login', [MemberController::class, 'destroyLogin']);

        Route::post('studies', [StudyController::class, 'store']);
        Route::put('studies/{study}', [StudyController::class, 'update']);
        Route::delete('studies/{study}', [StudyController::class, 'destroy']);
    });

    Route::patch('members/{member}', [MemberController::class, 'update']);

    Route::post('members/{member}/dates', [MemberDateController::class, 'store']);
    Route::patch('dates/{date}', [MemberDateController::class, 'update']);
    Route::delete('dates/{date}', [MemberDateController::class, 'destroy']);

    Route::post('prayers', [PrayerController::class, 'store']);
    Route::patch('prayers/{prayer}', [PrayerController::class, 'update']);
    Route::delete('prayers/{prayer}', [PrayerController::class, 'destroy']);
    Route::post('prayers/{prayer}/answer', [PrayerController::class, 'answer']);
    Route::post('prayers/{prayer}/reopen', [PrayerController::class, 'reopen']);

    Route::post('prayers/{prayer}/updates', [PrayerUpdateController::class, 'store']);
    Route::delete('prayer-updates/{update}', [PrayerUpdateController::class, 'destroy']);

    Route::get('studies/{study}', [StudyController::class, 'show']);
});
