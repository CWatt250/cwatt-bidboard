/**
 * Generate PWA icon PNGs from the two SVG sources.
 *
 * Run once:
 *   npx tsx scripts/generate-icons.ts
 *
 * From public/logo.svg (full-bleed): icon-512, icon-192, apple-touch-icon,
 *   favicon-32, favicon-16.
 * From public/logo-maskable.svg (bolt shrunk to ~60% so Android's adaptive
 *   icon mask doesn't clip the bolt): icon-512-maskable, icon-192-maskable.
 *
 * Re-run any time either SVG changes.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(__dirname, '..')
const SRC_ANY = path.join(ROOT, 'public', 'logo.svg')
const SRC_MASKABLE = path.join(ROOT, 'public', 'logo-maskable.svg')
const OUT_DIR = path.join(ROOT, 'public', 'icons')

interface Target {
  src: string
  name: string
  size: number
}

const TARGETS: Target[] = [
  // Full-bleed icons (purpose: 'any')
  { src: SRC_ANY, name: 'icon-512.png', size: 512 },
  { src: SRC_ANY, name: 'icon-192.png', size: 192 },
  { src: SRC_ANY, name: 'apple-touch-icon.png', size: 180 },
  { src: SRC_ANY, name: 'favicon-32.png', size: 32 },
  { src: SRC_ANY, name: 'favicon-16.png', size: 16 },
  // Maskable variants (purpose: 'maskable')
  { src: SRC_MASKABLE, name: 'icon-512-maskable.png', size: 512 },
  { src: SRC_MASKABLE, name: 'icon-192-maskable.png', size: 192 },
]

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  // Cache SVG file reads so we don't re-read the same source per target.
  const svgCache = new Map<string, Buffer>()
  async function readSvg(p: string): Promise<Buffer> {
    const cached = svgCache.get(p)
    if (cached) return cached
    const buf = await fs.readFile(p)
    svgCache.set(p, buf)
    return buf
  }

  for (const { src, name, size } of TARGETS) {
    const svg = await readSvg(src)
    const out = path.join(OUT_DIR, name)
    await sharp(svg).resize(size, size, { fit: 'contain' }).png().toFile(out)
    const stat = await fs.stat(out)
    if (stat.size === 0) throw new Error(`Generated empty PNG: ${name}`)
    console.log(`✓ ${name} (${size}x${size}, ${stat.size} bytes)`)
  }
}

main().catch((err) => {
  console.error('Icon generation failed:', err)
  process.exit(1)
})
