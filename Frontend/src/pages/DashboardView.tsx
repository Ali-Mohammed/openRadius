import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Edit, Settings, Filter } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DashboardGrid } from '../components/dashboard/DashboardGrid'
import { GlobalFilters } from '../components/dashboard/GlobalFilters'
import { AddItemDialog } from '../components/dashboard/dialogs/AddItemDialog'
import { AddTabDialog } from '../components/dashboard/dialogs/AddTabDialog'
import type { Dashboard, DashboardItem, DashboardTab } from '../types/dashboard'
import { dashboardApi } from '../api/dashboardApi'
import { toast } from 'sonner'

export default function DashboardView() {
  const { id } = useParams()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showAddTabDialog, setShowAddTabDialog] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (id) {
      loadDashboard()
    }
  }, [id])

  const loadDashboard = async () => {
    try {
      setIsLoading(true)
      const data = await dashboardApi.getDashboard(id!)
      setDashboard(data)
      if (data.tabs.length > 0) {
        setActiveTabId(data.tabs[0].id)
      }
    } catch (error) {
      console.error('Error loading dashboard:', error)
      toast.error('Failed to load dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddItem = async (item: DashboardItem) => {
    if (!dashboard) return

    const updatedTabs = dashboard.tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, items: [...tab.items, item] } : tab
    )

    setDashboard({ ...dashboard, tabs: updatedTabs })
    toast.success('Item added successfully')
  }

  const handleDeleteItem = (itemId: string) => {
    if (!dashboard) return

    const updatedTabs = dashboard.tabs.map((tab) =>
      tab.id === activeTabId
        ? { ...tab, items: tab.items.filter((item) => item.id !== itemId) }
        : tab
    )

    setDashboard({ ...dashboard, tabs: updatedTabs })
    toast.success('Item removed successfully')
  }

  const handleLayoutChange = (updatedItems: DashboardItem[]) => {
    if (!dashboard) return

    const updatedTabs = dashboard.tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, items: updatedItems } : tab
    )

    setDashboard({ ...dashboard, tabs: updatedTabs })
  }

  const handleFilterChange = (filterId: string, value: any) => {
    if (!dashboard) return

    const updatedFilters = dashboard.globalFilters.map((filter) =>
      filter.id === filterId ? { ...filter, value } : filter
    )

    setDashboard({ ...dashboard, globalFilters: updatedFilters })
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">Loading dashboard...</p>
      </div>
    )
  }

  if (!dashboard) {
    return (
      <div className="p-6">
        <p className="text-gray-500 dark:text-gray-400">Dashboard not found</p>
      </div>
    )
  }

  const activeTab = dashboard.tabs.find((tab) => tab.id === activeTabId)

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {dashboard.name}
          </h1>
          {dashboard.description && (
            <p className="mt-2 text-gray-600 dark:text-gray-400">{dashboard.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="mr-2 h-4 w-4" />
            {showFilters ? 'Hide' : 'Show'} Filters
          </Button>
          <Button
            variant={isEditing ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsEditing(!isEditing)}
          >
            <Edit className="mr-2 h-4 w-4" />
            {isEditing ? 'Done Editing' : 'Edit'}
          </Button>
          {isEditing && (
            <Button size="sm" onClick={() => setShowAddItemDialog(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Item
            </Button>
          )}
        </div>
      </div>

      {showFilters && dashboard.globalFilters.length > 0 && (
        <GlobalFilters
          filters={dashboard.globalFilters}
          onFilterChange={handleFilterChange}
        />
      )}

      <Tabs value={activeTabId} onValueChange={setActiveTabId}>
        <div className="flex items-center gap-2">
          <TabsList>
            {dashboard.tabs.map((tab) => (
              <TabsTrigger key={tab.id} value={tab.id}>
                {tab.name}
              </TabsTrigger>
            ))}
          </TabsList>
          {isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddTabDialog(true)}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Tab
            </Button>
          )}
        </div>

        {dashboard.tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-6">
            {tab.items.length > 0 ? (
              <DashboardGrid
                items={tab.items}
                onLayoutChange={handleLayoutChange}
                onDeleteItem={handleDeleteItem}
                isEditing={isEditing}
              />
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg">
                <Settings className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
                  No items in this tab
                </h3>
                <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
                  Click "Add Item" to start building your dashboard
                </p>
                {isEditing && (
                  <Button className="mt-4" onClick={() => setShowAddItemDialog(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Item
                  </Button>
                )}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      <AddItemDialog
        open={showAddItemDialog}
        onClose={() => setShowAddItemDialog(false)}
        onAdd={handleAddItem}
      />

      <AddTabDialog
        open={showAddTabDialog}
        onClose={() => setShowAddTabDialog(false)}
        onAdd={handleAddTab}
      />
    </div>
  )
}
