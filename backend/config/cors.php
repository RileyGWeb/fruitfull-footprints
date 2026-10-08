<?php

return [

    // The browser reaches the API same-origin through the Next.js proxy, so no path answers
    // cross-origin requests: with no paths, HandleCors never adds Access-Control-* headers.
    'paths' => [],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
