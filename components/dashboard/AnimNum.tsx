'use client'

import { useEffect, useRef, useState } from 'react'

interface AnimNumProps {
  value: number
  format: (n: number) => string
  duration?: number
  className?: string
  style?: React.CSSProperties
}

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Count-up number that interpolates from the previous render's value to the
 * new value with a cubic ease-out. First mount animates from 0; subsequent
 * value changes animate from the prior value. Respects prefers-reduced-motion
 * by snapping straight to the target.
 */
export function AnimNum({ value, format, duration = 900, className, style }: AnimNumProps) {
  const [display, setDisplay] = useState<number>(() => (reducedMotion() ? value : 0))
  const prevRef = useRef<number>(reducedMotion() ? value : 0)
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    const from = prevRef.current
    const to = value

    if (rafRef.current != null) cancelAnimationFrame(rafRef.current)

    if (reducedMotion() || from === to) {
      setDisplay(to)
      prevRef.current = to
      return
    }

    const start = performance.now()
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - p, 3)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step)
      } else {
        prevRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(step)

    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
  }, [value, duration])

  return (
    <span className={className} style={style}>
      {format(display)}
    </span>
  )
}
