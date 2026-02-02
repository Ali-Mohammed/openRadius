import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function PaymentsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Payment History</CardTitle>
        <CardDescription>User payment transactions</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Payment history will be displayed here</p>
      </CardContent>
    </Card>
  )
}
