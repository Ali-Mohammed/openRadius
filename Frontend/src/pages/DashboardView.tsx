import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Plus, Edit, Settings, Filter } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DashboardGrid } from '../components/dashboard/DashboardGrid'
import { GlobalFilters } from '../components/dashboard/GlobalFilters'
import { AddItemDialog } from '../components/dashboard/dialogs/AddItemDialog'
import type { Dashboard, DashboardItem, DashboardTab } from '../types/dashboard'
import { toast } from 'sonner'

export default function DashboardView() {
  const { id } = useParams()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [isEditing, setIsEditing] = useState(false)
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showFilters, setShowFilters] = useState(true)

  useEffect(() => {
    // Mock data - replace with actual API call
    const mockDashboard: Dashboard = {
      id: id || '1',
      name: 'Revenue Overview',
      description: 'Track revenue metrics and performance',
      tabs: [
        {
          id: 'tab-1',
          name: 'Overview',
          items: [
            {
              id: 'item-1',
              type: 'metric',
              title: 'Total Revenue',
              layout: { x: 0, y: 0, w: 6, h: 2 },
              config: {
                value: '$125,430',
                label: 'Total Revenue',
                trend: 12.5,
                trendDirection: 'up' as const,
              },
            },
            {
              id: 'item-2',
              type: 'metric',
              title: 'Active Users',
              layout: { x: 6, y: 0, w: 6, h: 2 },
              config: {
                value: '2,543',
                label: 'Active Users',
                trend: 8.2,
                trendDirection: 'up' as const,
              },
            },
            {
              id: 'item-3',
              type: 'metric',
              title: 'Conversion Rate',
              layout: { x: 12, y: 0, w: 6, h: 2 },
              config: {
                value: '3.24%',
                label: 'Conversion Rate',
                trend: 2.1,
                trendDirection: 'down' as const,
              },
            },
            {
              id: 'item-4',
              type: 'metric',
              title: 'Avg Order Value',
              layout: { x: 18, y: 0, w: 6, h: 2 },
              config: {
                value: '$48.30',
                label: 'Avg Order Value',
                trend: 5.3,
                trendDirection: 'up' as const,
              },
            },
            {
              id: 'item-5',
              type: 'chart',
              title: 'Revenue Trend',
              layout: { x: 0, y: 2, w: 16, h: 4 },
              config: {
                chartType: 'line' as const,
              },
            },
            {
              id: 'item-6',
              type: 'chart',
              title: 'Revenue by Category',
              layout: { x: 16, y: 2, w: 8, h: 4 },
              config: {
                chartType: 'pie' as const,
              },
            },
          ],
        },
        {
          id: 'tab-2',
          name: 'Details',
          items: [
            {
              id: 'item-7',
              type: 'table',
              title: 'Top Products',
              layout: { x: 0, y: 0, w: 24, h: 4 },
              config: {
                columns: [
                  { key: 'product', label: 'Product' },
                  { key: 'revenue', label: 'Revenue' },
                  { key: 'units', label: 'Units Sold' },
                ],
                data: [
                  { product: 'Product A', revenue: '$12,430', units: '245' },
                  { product: 'Product B', revenue: '$9,820', units: '189' },
                  { product: 'Product C', revenue: '$7,650', units: '156' },
                ],
              },
            },
          ],
        },
      ],
      globalFilters: [
        {
          id: 'filter-1',
          label: 'Date Range',
          type: 'date',
          value: new Date().toISOString(),
        },
        {
          id: 'filter-2',
          label: 'Region',
          type: 'select',
          value: 'all',
          options: [
            { label: 'All Regions', value: 'all' },
            { label: 'North America', value: 'na' },
            { label: 'Europe', value: 'eu' },
            { label: 'Asia', value: 'asia' },
          ],
        },
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    setDashboard(mockDashboard)
    setActiveTabId(mockDashboard.tabs[0]?.id || '')
  }, [id])

  const handleAddItem = (item: DashboardItem) => {
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

  if (!dashboard) {
    return <div className="p-6">Loading...</div>
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
        <TabsList>
          {dashboard.tabs.map((tab) => (
            <TabsTrigger key={tab.id} value={tab.id}>
              {tab.name}
            </TabsTrigger>
          ))}
        </TabsList>

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
    </div>
  )
}
