'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[]
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt: () => Promise<void>
}

interface InstallAppButtonProps {
  /** Hide the text label when the sidebar is collapsed. */
  collapsed?: boolean
  /** Allow callers to apply additional styling. */
  className?: string
}

export function InstallAppButton({ collapsed = false, className }: InstallAppButtonProps) {
  const [stashed, setStashed] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)

  useEffect(() => {
    // Detect already-installed (standalone display) on mount — no need to show
    // the button if the user is already in the PWA.
    if (typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true)
    }

    function onBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      setStashed(e as BeforeInstallPromptEvent)
    }
    function onAppInstalled() {
      setInstalled(true)
      setStashed(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [])

  // Hide unless the browser has fired beforeinstallprompt — single-use event,
  // so once we've consumed or dismissed it the button stays hidden until the
  // browser decides to re-offer.
  if (installed || !stashed) return null

  async function handleClick() {
    if (!stashed) return
    await stashed.prompt()
    try {
      await stashed.userChoice
    } catch {
      // ignore — Chrome resolves even on dismissal
    }
    setStashed(null)
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleClick}
      className={className}
      title="Install BidWatt to your device"
      aria-label="Install BidWatt"
    >
      <Download className="size-4" />
      {!collapsed && <span>Install App</span>}
    </Button>
  )
}
