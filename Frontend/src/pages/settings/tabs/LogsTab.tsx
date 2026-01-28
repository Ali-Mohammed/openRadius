import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ExternalLink, Activity, Briefcase } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export default function LogsTab() {
  const { currentWorkspaceId } = useWorkspace()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Development Tools</CardTitle>
        <CardDescription>
          Access logging and background job monitoring tools
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3">
          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open('http://localhost:5341', '_blank')}
          >
            <Activity className="mr-2 h-4 w-4" />
            Seq Logs
            <ExternalLink className="ml-auto h-4 w-4 opacity-50" />
          </Button>
          <p className="text-sm text-muted-foreground -mt-2 ml-10">
            View structured application logs and diagnostics
          </p>

          <Button
            variant="outline"
            className="justify-start"
            onClick={() => window.open(`http://localhost:5000/hangfire/workspace/${currentWorkspaceId}`, '_blank')}
          >
            <Briefcase className="mr-2 h-4 w-4" />
            Hangfire Dashboard
            <ExternalLink className="ml-auto h-4 w-4 opacity-50" />
          </Button>
          <p className="text-sm text-muted-foreground -mt-2 ml-10">
            Monitor and manage background jobs and scheduled tasks
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
