import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Fruitfull Footprints',
    short_name: 'Footprints',
    description: 'A private home for our small group.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#f5ead8',
    theme_color: '#f5ead8',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
