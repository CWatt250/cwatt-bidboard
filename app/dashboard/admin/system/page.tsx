import pkg from '@/package.json'

export default function SystemPage() {
  return (
    <div className="space-y-6 max-w-lg">
      <div className="rounded-lg border p-4 space-y-1">
        <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">App Version</p>
        <p className="text-sm font-mono">{pkg.version}</p>
      </div>

      <div className="flex flex-col items-center justify-center py-16 text-center border rounded-lg">
        <p className="text-xl font-semibold text-muted-foreground">Coming Soon</p>
        <p className="text-sm text-muted-foreground mt-2">Additional system settings will be available in a future update.</p>
      </div>
    </div>
  )
}
