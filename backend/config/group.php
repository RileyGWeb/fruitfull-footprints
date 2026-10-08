<?php

return [

    // Initial shared group password. `php artisan db:seed` hashes it into the settings table
    // when no password is set yet; change it later with `php artisan ff:password` or in the app.
    'password' => env('GROUP_PASSWORD'),

];
