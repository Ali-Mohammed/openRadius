import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, LayoutDashboard, Pencil, Trash2 } from 'lucide-react'
import { Button } from '../components/ui/button'
import { CreateDashboardDialog } from '../components/dashboard/dialogs/CreateDashboardDialog'
import type { Dashboard } from '../types/dashboard'
import { dashboardApi } from '../api/dashboardApi'
import { toast } from 'sonner'

export default function Dashboards() {
  const navigate = useNavigate()
  const [dashboards, setDashboards] = useState<Dashboard[]>([])
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    loadDashboards()
  }, [])

  const loadDashboards = async () => {
    try {
      setIsLoading(true)
      const data = await dashboardApi.getDashboards()
      setDashboards(data)
    } catch (error) {
      console.error('Error loading dashboards:', error)
      toast.error('Failed to load dashboards')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateDashboard = async (name: string, description: string) => {
    try {
      const newDashboard = await dashboardApi.createDashboard({
        name,
        description,
        tabs: [{ name: 'Overview' }],
      })
      toast.success('Dashboard created successfully')
      navigate(`/dashboards/${newDashboard.id}`)
    } catch (error) {
      console.error('Error creating dashboard:', error)
      toast.error('Failed to create dashboard')
    }
  }

  const handleDeleteDashboard = async (id: string) => {
    try {
      await dashboardApi.deleteDashboard(id)
      setDashboards(dashboards.filter((d) => d.id !== id))
      toast.success('Dashboard deleted successfully')
    } catch (error) {
      console.error('Error deleting dashboard:', error)
      toast.error('Failed to delete dashboard')
    }
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboards</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Create and manage your custom dashboards
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Dashboard
        </Button>
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Loading dashboards...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {dashboards.map((dashboard) => (
          <div
            key={dashboard.id}
            className="group relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => navigate(`/dashboards/${dashboard.id}`)}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <LayoutDashboard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {dashboard.name}
                  </h3>
                </div>
                {dashboard.description && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    {dashboard.description}
                  </p>
                )}
                <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                  <span>{dashboard.tabCount ?? dashboard.tabs?.length ?? 0} tabs</span>
                  <span>
                    {dashboard.itemCount ?? dashboard.tabs?.reduce((acc, tab) => acc + tab.items.length, 0) ?? 0} items
                  </span>
                </div>
              </div>
              <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    navigate(`/dashboards/${dashboard.id}/edit`)
                  }}
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 p-0 text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteDashboard(dashboard.id)
                  }}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          ))}

          {dashboards.length === 0 && (
          <div className="col-span-full text-center py-12">
            <LayoutDashboard className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
              No dashboards yet
            </h3>
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              Get started by creating your first dashboard
            </p>
            <Button className="mt-4" onClick={() => setShowCreateDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Dashboard
            </Button>
          </div>
          )}
        </div>
      )}

      <CreateDashboardDialog
        open={showCreateDialog}
        onClose={() => setShowCreateDialog(false)}
        onCreate={handleCreateDashboard}
      />
    </div>
  )
}
