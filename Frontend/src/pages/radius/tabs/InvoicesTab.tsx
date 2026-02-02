import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function InvoicesTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Invoices</CardTitle>
        <CardDescription>User billing invoices</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Invoice list will be displayed here</p>
      </CardContent>
    </Card>
  )
}
