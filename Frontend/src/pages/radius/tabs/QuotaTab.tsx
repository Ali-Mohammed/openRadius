import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function QuotaTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Quota Management</CardTitle>
        <CardDescription>User data and time quotas</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Quota information will be displayed here</p>
      </CardContent>
    </Card>
  )
}
