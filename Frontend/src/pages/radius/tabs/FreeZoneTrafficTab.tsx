import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function FreeZoneTrafficTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>FreeZone Traffic</CardTitle>
        <CardDescription>Traffic in designated free zones</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">FreeZone traffic data will be displayed here</p>
      </CardContent>
    </Card>
  )
}
