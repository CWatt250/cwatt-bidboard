/**
 * Generate PWA icon PNGs from public/logo.svg.
 *
 * Run once:
 *   npx tsx scripts/generate-icons.ts
 *
 * Writes 5 sized PNGs to public/icons/:
 *   icon-512.png, icon-192.png, apple-touch-icon.png, favicon-32.png, favicon-16.png
 *
 * Re-run any time public/logo.svg changes.
 */

import { promises as fs } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const ROOT = path.resolve(__dirname, '..')
const SRC = path.join(ROOT, 'public', 'logo.svg')
const OUT_DIR = path.join(ROOT, 'public', 'icons')

const TARGETS: { name: string; size: number }[] = [
  { name: 'icon-512.png', size: 512 },
  { name: 'icon-192.png', size: 192 },
  { name: 'apple-touch-icon.png', size: 180 },
  { name: 'favicon-32.png', size: 32 },
  { name: 'favicon-16.png', size: 16 },
]

async function main() {
  const svg = await fs.readFile(SRC)
  await fs.mkdir(OUT_DIR, { recursive: true })

  for (const { name, size } of TARGETS) {
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
