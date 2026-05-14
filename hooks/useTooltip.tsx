'use client'

import { useCallback, useState } from 'react'
import type { ReactNode } from 'react'

interface TooltipState {
  visible: boolean
  content: ReactNode
  x: number
  y: number
}

interface UseTooltipResult {
  state: TooltipState
  show: (content: ReactNode, x: number, y: number) => void
  hide: () => void
}

const INITIAL: TooltipState = { visible: false, content: null, x: 0, y: 0 }

export function useTooltip(): UseTooltipResult {
  const [state, setState] = useState<TooltipState>(INITIAL)

  const show = useCallback((content: ReactNode, x: number, y: number) => {
    setState({ visible: true, content, x, y })
  }, [])

  const hide = useCallback(() => {
    setState((prev) => ({ ...prev, visible: false }))
  }, [])

  return { state, show, hide }
}

interface TooltipProps {
  state: TooltipState
}

/**
 * Fixed-position floating tooltip that follows the cursor. Render once per
 * page; multiple useTooltip hosts each get their own instance. Pair with
 * useTooltip's { state } return value.
 */
export function FloatingTooltip({ state }: TooltipProps) {
  if (state.content == null) return null
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed',
        left: state.x + 14,
        top: state.y + 14,
        zIndex: 100,
        pointerEvents: 'none',
        background: '#0d1226',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8,
        padding: '8px 12px',
        fontSize: 12,
        color: '#e6ecff',
        fontFamily: 'var(--font-sans), "Plus Jakarta Sans", sans-serif',
        boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
        opacity: state.visible ? 1 : 0,
        transition: 'opacity 200ms ease',
        maxWidth: 320,
        whiteSpace: 'nowrap',
      }}
    >
      {state.content}
    </div>
  )
}
