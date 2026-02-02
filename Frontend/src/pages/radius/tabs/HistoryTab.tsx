import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function HistoryTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Activity History</CardTitle>
        <CardDescription>User activity and changes log</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Activity history will be displayed here</p>
      </CardContent>
    </Card>
  )
}
