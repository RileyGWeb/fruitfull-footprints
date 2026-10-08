<?php

return [

    // Next.js proxies /api from the same machine, so loopback is trusted and the client IP is the
    // rightmost untrusted X-Forwarded-For entry (the unlock throttle keys on it). Next forwards
    // the browser's X-Forwarded-For verbatim and adds none, so in production a reverse proxy in
    // front of Next must append the socket address (nginx $proxy_add_x_forwarded_for, Caddy's
    // default); without one, clients choose their own address. Add hosts with TRUSTED_PROXIES:
    // Next on another machine, or a CDN / load balancer in front of that reverse proxy.
    'proxies' => array_values(array_filter(array_merge(
        ['127.0.0.1', '::1'],
        array_map(trim(...), explode(',', (string) env('TRUSTED_PROXIES', ''))),
    ))),

];
