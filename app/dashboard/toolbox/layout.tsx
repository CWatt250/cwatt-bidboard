'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const tabs = [
  { href: '/dashboard/toolbox/mike-discount', label: 'MIKE Discount Calculator' },
  { href: '/dashboard/toolbox/material-price', label: 'Material Price Calculator' },
  { href: '/dashboard/toolbox/crew-size', label: 'Crew Size Calculator' },
  { href: '/dashboard/toolbox/jurisdiction-map', label: 'Jurisdiction Map' },
]

export default function ToolboxLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Toolbox</h1>
        <p className="text-sm text-muted-foreground mt-1">Calculators and estimating tools</p>
      </div>

      <div className="border-b flex gap-1">
        {tabs.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              pathname === href
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground/40'
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {children}
    </div>
  )
}
