import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function SessionsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>User Sessions</CardTitle>
        <CardDescription>Active and historical session information</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Session history will be displayed here</p>
      </CardContent>
    </Card>
  )
}
