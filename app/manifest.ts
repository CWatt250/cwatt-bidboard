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
    // Next's Manifest type narrows `purpose` to a single value, but the W3C
    // PWA spec accepts space-separated combinations. Cast the array literal
    // so the rendered manifest serves the icons as both `any` and `maskable`.
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' },
    ] as unknown as MetadataRoute.Manifest['icons'],
  }
}
