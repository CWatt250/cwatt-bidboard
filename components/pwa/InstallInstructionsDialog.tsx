'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export type Platform =
  | 'ios-safari'
  | 'android-chrome'
  | 'desktop-chrome'
  | 'desktop-edge'
  | 'desktop-safari'
  | 'firefox'
  | 'other'

/**
 * Detect the platform we're rendering on so we can show the matching install
 * instructions. UA sniffing is fine here — the W3C "platform detection" rabbit
 * hole isn't worth a dependency, and the only consumer is help text.
 */
export function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'other'
  const ua = navigator.userAgent
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream
  if (isIOS) return 'ios-safari' // iOS treats all browsers as Safari for PWA purposes
  if (/Android/.test(ua) && /Chrome/.test(ua)) return 'android-chrome'
  if (/Firefox/.test(ua)) return 'firefox'
  if (/Edg\//.test(ua)) return 'desktop-edge' // Edge has "Edg/" in UA
  if (/Chrome/.test(ua)) return 'desktop-chrome'
  if (/Safari/.test(ua)) return 'desktop-safari'
  return 'other'
}

interface InstructionContent {
  title: string
  steps?: string[]
  body?: string
  note?: string
}

const CONTENT: Record<Platform, InstructionContent> = {
  'ios-safari': {
    title: 'Install BidWatt on iPhone/iPad',
    steps: [
      'Tap the Share button (the square with an upward arrow) at the bottom of the screen.',
      'Scroll down and tap "Add to Home Screen".',
      'Tap "Add" in the top-right corner.',
    ],
    note: 'This must be done in Safari. Chrome and other browsers on iOS can\'t install apps to the home screen.',
  },
  'android-chrome': {
    title: 'Install BidWatt on Android',
    steps: [
      'Tap the three-dot menu (⋮) in the top-right corner.',
      'Tap "Install app" or "Add to Home screen".',
      'Tap "Install" to confirm.',
    ],
  },
  'desktop-chrome': {
    title: 'Install BidWatt on Chrome',
    steps: [
      'Click the three-dot menu (⋮) in the top-right corner of Chrome.',
      'Hover over "Cast, save, and share" or "Save and share".',
      'Click "Install BidWatt..." or "Create shortcut..."',
      'Click "Install" to confirm.',
    ],
    note: 'Alternative: Look for a small install icon (a monitor with a down arrow) on the right side of the address bar — click it to install.',
  },
  'desktop-edge': {
    title: 'Install BidWatt on Edge',
    steps: [
      'Click the three-dot menu (⋯) in the top-right corner of Edge.',
      'Hover over "Apps".',
      'Click "Install this site as an app".',
      'Click "Install" to confirm.',
    ],
  },
  'desktop-safari': {
    title: 'Install BidWatt on Safari (Mac)',
    steps: [
      'With BidWatt open, click the "File" menu in the menu bar.',
      'Click "Add to Dock...".',
      'Confirm the name and click "Add".',
    ],
    note: 'Requires macOS Sonoma (14) or later.',
  },
  firefox: {
    title: 'Install BidWatt on Firefox',
    body: 'Firefox doesn\'t currently support installing web apps on desktop. To install BidWatt, please use Chrome, Edge, or Safari. On Android, Firefox supports "Add to Home Screen" from the menu.',
  },
  other: {
    title: 'Install BidWatt',
    body: 'Your browser may not support installing this app. Try opening BidWatt in Chrome, Edge, or Safari, then come back and click Install App again.',
  },
}

interface InstallInstructionsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function InstallInstructionsDialog({ open, onOpenChange }: InstallInstructionsDialogProps) {
  const [platform, setPlatform] = useState<Platform>('other')

  // Run UA detection on mount only — navigator is unavailable during SSR.
  useEffect(() => {
    setPlatform(detectPlatform())
  }, [])

  const content = CONTENT[platform]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{content.title}</DialogTitle>
          {content.body && <DialogDescription>{content.body}</DialogDescription>}
        </DialogHeader>

        {content.steps && (
          <ol className="space-y-2 text-sm pl-5 list-decimal">
            {content.steps.map((step, i) => (
              <li key={i} className="leading-relaxed">{step}</li>
            ))}
          </ol>
        )}

        {content.note && (
          <p className="text-xs text-muted-foreground border-t pt-3 mt-1">
            {content.note}
          </p>
        )}

        <DialogFooter>
          <DialogClose render={<Button variant="outline" />}>Close</DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
