import type { NextConfig } from 'next';

const BACKEND_URL = (process.env.BACKEND_URL || 'http://127.0.0.1:8110').replace(/\/$/, '');
const dev = process.env.NODE_ENV !== 'production';

/**
 * One id per `next build`, used as Next's build id and as the service worker's version
 * (components/pwa/ServiceWorker.tsx registers /sw.js?v=<id>), so every deploy installs a fresh worker
 * that saves the new build's pages and drops the old caches. Kept in the environment so Next's build
 * workers see the same id; set FF_BUILD_ID (e.g. to the commit sha) to choose it, as long as it
 * changes with every deploy. Ids containing “ad” are skipped, like Next's own (ad blockers).
 */
const BUILD_ID = (process.env.FF_BUILD_ID ||= (() => {
  let id;
  do id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  while (/ad/i.test(id));
  return id;
})());

/**
 * No script-src: without per-request nonces (which would force every page to render dynamically) it
 * couldn't stop inline scripts anyway. The rest keeps the app unframeable and same-origin only.
 */
const CSP = [
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${dev ? ' ws: wss:' : ''}`,
  "manifest-src 'self'",
  "worker-src 'self'",
].join('; ');

const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  generateBuildId: () => BUILD_ID,
  env: { NEXT_PUBLIC_BUILD_ID: BUILD_ID },
  // The browser only talks to Next; /api/* is proxied to Laravel so cookies stay same-origin.
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${BACKEND_URL}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: CSP },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'same-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=()' },
        ],
      },
      {
        source: '/sw.js',
        headers: [
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
          { key: 'Cache-Control', value: 'no-cache' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
    ];
  },
};

export default nextConfig;
