'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InstallInstructionsDialog } from '@/components/pwa/InstallInstructionsDialog'

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

/**
 * Detect "is already installed" both for Chromium-style PWAs (display-mode:
 * standalone) and for iOS Safari (navigator.standalone). Returns false during
 * SSR so the button renders by default on first paint.
 */
function isStandaloneInstalled(): boolean {
  if (typeof window === 'undefined') return false
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true
  const nav = navigator as Navigator & { standalone?: boolean }
  return nav.standalone === true
}

export function InstallAppButton({ collapsed = false, className }: InstallAppButtonProps) {
  const [stashed, setStashed] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)

  useEffect(() => {
    setInstalled(isStandaloneInstalled())

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

  // Hide only when the app is genuinely already installed. Otherwise render
  // the button regardless of beforeinstallprompt support — many browsers
  // (Edge in some configurations, every iOS browser) never fire it even when
  // the app is installable, so users were stuck without a button.
  if (installed) return null

  async function handleClick() {
    if (stashed) {
      // Native path: use Chrome's saved prompt event.
      await stashed.prompt()
      try {
        await stashed.userChoice
      } catch {
        // Chrome resolves even on dismissal; ignore unexpected errors.
      }
      setStashed(null)
      return
    }

    // Fallback: show platform-specific manual instructions.
    setHelpOpen(true)
  }

  return (
    <>
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
      <InstallInstructionsDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  )
}
