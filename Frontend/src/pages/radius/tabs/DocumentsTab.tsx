import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export function DocumentsTab() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Documents</CardTitle>
        <CardDescription>User-related documents and files</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground">Documents will be displayed here</p>
      </CardContent>
    </Card>
  )
}
