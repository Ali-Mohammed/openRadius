import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function EditTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Edit User</CardTitle>
        <CardDescription>Modify user information</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Edit functionality will be implemented here</p>
      </CardContent>
    </Card>
  )
}
