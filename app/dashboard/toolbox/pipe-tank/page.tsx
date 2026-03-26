import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function PipeTankPage() {
  return (
    <div className="flex items-center justify-center py-16">
      <Card className="max-w-sm w-full text-center">
        <CardHeader>
          <CardTitle>Pipe &amp; Tank Wrap Calculator</CardTitle>
          <CardDescription>
            This calculator is under development and will be available in a future update.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <span className="inline-block rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            Coming Soon
          </span>
        </CardContent>
      </Card>
    </div>
  )
}
