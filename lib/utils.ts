import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Parse a free-form date string into ISO (YYYY-MM-DD).
 * Accepts "M/D", "MM/DD", "M/D/YY", "M/D/YYYY". If year is omitted, uses the current year.
 * Returns '' when the input cannot be parsed.
 */
export function parseLooseDate(input: string): string {
  const t = input.trim()
  if (!t) return ''
  // Already ISO — leave alone
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t
  const parts = t.split('/')
  if (parts.length < 2 || parts.length > 3) return ''
  const [mRaw, dRaw, yRaw] = parts
  const m = parseInt(mRaw, 10)
  const d = parseInt(dRaw, 10)
  if (!Number.isFinite(m) || !Number.isFinite(d)) return ''
  if (m < 1 || m > 12 || d < 1 || d > 31) return ''
  let year: number
  if (parts.length === 2) {
    year = new Date().getFullYear()
  } else {
    const yNum = parseInt(yRaw, 10)
    if (!Number.isFinite(yNum)) return ''
    year = yRaw.length === 2 ? 2000 + yNum : yNum
  }
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}
