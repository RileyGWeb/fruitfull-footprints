<?php

return [

    // Bcrypt hash of the hidden super admin's password, from the server's environment. The super
    // admin is not a member: signing in with this password gives full access and no profile.
    // Make a hash with `php artisan tinker --execute 'echo bcrypt("the password");'` and put it
    // in single quotes in .env, since it contains `$`. Changing it signs the super admin out
    // everywhere. Leave it empty for no super admin.
    'super_admin_hash' => env('SUPER_ADMIN_PASSWORD_HASH'),

];
