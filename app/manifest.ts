import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'BidWatt',
    short_name: 'BidWatt',
    description: 'Mechanical insulation bid management',
    start_url: '/dashboard',
    display: 'standalone',
    background_color: '#0F2340',
    theme_color: '#0F2340',
    orientation: 'any',
    // Split into separate 'any' and 'maskable' entries. The full-bleed icons
    // are rendered as-is on Windows desktop / taskbar; the maskable variants
    // (bolt shrunk to ~60% inside the safe zone) are used by Android adaptive
    // icon masks so the bolt isn't cropped.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-192-maskable.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  }
}
