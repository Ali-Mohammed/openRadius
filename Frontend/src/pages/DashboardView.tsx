import { useState, useEffect } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Plus, Edit, Settings, Filter, GripVertical } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { DashboardGrid } from '../components/dashboard/DashboardGrid'
import { GlobalFilters } from '../components/dashboard/GlobalFilters'
import { AddItemDialog } from '../components/dashboard/dialogs/AddItemDialog'
import { AddTabDialog } from '../components/dashboard/dialogs/AddTabDialog'
import { EditItemDialog } from '../components/dashboard/dialogs/EditItemDialog'
import type { Dashboard, DashboardItem, DashboardTab } from '../types/dashboard'
import { dashboardApi } from '../api/dashboardApi'
import { toast } from 'sonner'

export default function DashboardView() {
  const { id } = useParams()
  const location = useLocation()
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [activeTabId, setActiveTabId] = useState<string>('')
  const [isEditing, setIsEditing] = useState(location.pathname.endsWith('/edit'))
  const [showAddItemDialog, setShowAddItemDialog] = useState(false)
  const [showAddTabDialog, setShowAddTabDialog] = useState(false)
  const [showEditItemDialog, setShowEditItemDialog] = useState(false)
  const [editingItem, setEditingItem] = useState<DashboardItem | null>(null)
  const [showFilters, setShowFilters] = useState(true)
  const [isLoading, setIsLoading] = useState(true)
  const [draggedTabIndex, setDraggedTabIndex] = useState<number | null>(null)
  const [originalDashboard, setOriginalDashboard] = useState<Dashboard | null>(null)

  useEffect(() => {
    if (id) {
      loadDashboard()
    }
  }, [id])

  // Save layout changes when exiting edit mode
  useEffect(() => {
    const handleEditModeChange = async () => {
      if (!isEditing && dashboard && originalDashboard) {
        await saveLayoutChanges()
        setOriginalDashboard(null)
      }
      if (isEditing && dashboard) {
        setOriginalDashboard(JSON.parse(JSON.stringify(dashboard)))
      }
    }
    handleEditModeChange()
  }, [isEditing])

  const saveLayoutChanges = async () => {
    if (!dashboard || !originalDashboard) return

    try {
      for (const tab of dashboard.tabs) {
        const originalTab = originalDashboard.tabs.find(t => t.id === tab.id)
        if (originalTab) {
          for (const item of tab.items) {
            const originalItem = originalTab.items.find(i => i.id === item.id)
            if (originalItem &&
                (originalItem.layout.x !== item.layout.x ||
                 originalItem.layout.y !== item.layout.y ||
                 originalItem.layout.w !== item.layout.w ||
                 originalItem.layout.h !== item.layout.h)) {
              await dashboardApi.updateItemLayout(dashboard.id, item.id, item.layout)
            }
          }
        }
      }
      toast.success('Layout saved successfully')
    } catch (error) {
      console.error('Error saving layout:', error)
      toast.error('Failed to save layout changes')
    }
  }

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

    try {
      // Find the active tab to get its numeric ID
      const activeTab = dashboard.tabs.find(tab => tab.id === activeTabId)
      if (!activeTab) return

      // Add item to backend
      const newItem = await dashboardApi.addItem(dashboard.id, {
        tabId: parseInt(activeTab.id),
        type: item.type,
        title: item.title,
        layout: item.layout,
        config: item.config,
      })

      // Update local state with the returned item
      const updatedTabs = dashboard.tabs.map((tab) =>
        tab.id === activeTabId ? { ...tab, items: [...tab.items, newItem] } : tab
      )

      setDashboard({ ...dashboard, tabs: updatedTabs })
      toast.success('Item added successfully')
    } catch (error) {
      console.error('Error adding item:', error)
      toast.error('Failed to add item')
    }
  }

  const handleAddTab = async (name: string) => {
    if (!dashboard) return

    try {
      // Create new tab locally
      const newTab: DashboardTab = {
        id: `tab-${Date.now()}`,
        name,
        items: [],
      }

      const updatedTabs = [...dashboard.tabs, newTab]
      
      // Update dashboard in backend
      await dashboardApi.updateDashboard(dashboard.id, {
        tabs: updatedTabs.map(t => ({ name: t.name })),
      })

      setDashboard({ ...dashboard, tabs: updatedTabs })
      setActiveTabId(newTab.id)
      toast.success('Tab added successfully')
    } catch (error) {
      console.error('Error adding tab:', error)
      toast.error('Failed to add tab')
    }
  }

  const handleEditItem = (item: DashboardItem) => {
    setEditingItem(item)
    setShowEditItemDialog(true)
  }

  const handleSaveItem = async (itemId: string, updates: Partial<DashboardItem>, newTabId?: string) => {
    if (!dashboard) return

    try {
      // If moving to a different tab
      if (newTabId && newTabId !== activeTabId) {
        // Remove from current tab and add to new tab
        const item = dashboard.tabs
          .find(tab => tab.id === activeTabId)
          ?.items.find(i => i.id === itemId)
        
        if (item) {
          const updatedItem = { ...item, ...updates }
          const updatedTabs = dashboard.tabs.map(tab => {
            if (tab.id === activeTabId) {
              return { ...tab, items: tab.items.filter(i => i.id !== itemId) }
            } else if (tab.id === newTabId) {
              return { ...tab, items: [...tab.items, updatedItem] }
            }
            return tab
          })
          setDashboard({ ...dashboard, tabs: updatedTabs })
          setActiveTabId(newTabId)
          toast.success('Item moved and updated successfully')
        }
      } else {
        // Update in current tab
        const updatedTabs = dashboard.tabs.map(tab =>
          tab.id === activeTabId
            ? {
                ...tab,
                items: tab.items.map(item =>
                  item.id === itemId ? { ...item, ...updates } : item
                ),
              }
            : tab
        )
        setDashboard({ ...dashboard, tabs: updatedTabs })
        toast.success('Item updated successfully')
      }
    } catch (error) {
      console.error('Error saving item:', error)
      toast.error('Failed to save item')
    }
  }

  const handleDeleteItem = async (itemId: string) => {
    if (!dashboard) return

    try {
      // Delete item from backend
      await dashboardApi.deleteItem(dashboard.id, itemId)

      // Update local state
      const updatedTabs = dashboard.tabs.map((tab) =>
        tab.id === activeTabId
          ? { ...tab, items: tab.items.filter((item) => item.id !== itemId) }
          : tab
      )

      setDashboard({ ...dashboard, tabs: updatedTabs })
      toast.success('Item removed successfully')
    } catch (error) {
      console.error('Error deleting item:', error)
      toast.error('Failed to delete item')
    }
  }

  const handleLayoutChange = async (updatedItems: DashboardItem[]) => {
    if (!dashboard || !isEditing) return

    // Update local state immediately for smooth UX
    const updatedTabs = dashboard.tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, items: updatedItems } : tab
    )

    setDashboard({ ...dashboard, tabs: updatedTabs })

    // Debounce backend save - only save after user stops dragging/resizing
    // The save will happen when user exits edit mode or changes tabs
  }

  const handleFilterChange = (filterId: string, value: any) => {
    if (!dashboard) return

    const updatedFilters = dashboard.globalFilters.map((filter) =>
      filter.id === filterId ? { ...filter, value } : filter
    )

    setDashboard({ ...dashboard, globalFilters: updatedFilters })
  }

  const handleTabDragStart = (index: number) => {
    setDraggedTabIndex(index)
  }

  const handleTabDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault()
    if (draggedTabIndex === null || draggedTabIndex === index) return
    
    if (!dashboard) return
    
    const newTabs = [...dashboard.tabs]
    const draggedTab = newTabs[draggedTabIndex]
    newTabs.splice(draggedTabIndex, 1)
    newTabs.splice(index, 0, draggedTab)
    
    setDashboard({ ...dashboard, tabs: newTabs })
    setDraggedTabIndex(index)
  }

  const handleTabDragEnd = async () => {
    if (draggedTabIndex === null || !dashboard) {
      setDraggedTabIndex(null)
      return
    }

    try {
      await dashboardApi.updateDashboard(dashboard.id, {
        tabs: dashboard.tabs.map(t => ({ name: t.name })),
      })
      toast.success('Tab order updated')
    } catch (error) {
      toast.error('Failed to update tab order')
      loadDashboard() // Reload to restore original order
    } finally {
      setDraggedTabIndex(null)
    }
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

  const handleToggleEdit = async () => {
    if (isEditing) {
      // Save changes before exiting edit mode
      await saveLayoutChanges()
    }
    setIsEditing(!isEditing)
  }

  const activeTab = dashboard.tabs.find((tab) => tab.id === activeTabId)

  return (
    <div className="p-4 space-y-4">
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
            onClick={handleToggleEdit}
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
            {dashboard.tabs.map((tab, index) => (
              <div
                key={tab.id}
                className="flex items-center gap-1 relative"
                draggable={isEditing}
                onDragStart={() => handleTabDragStart(index)}
                onDragOver={(e) => handleTabDragOver(e, index)}
                onDragEnd={handleTabDragEnd}
                style={{
                  cursor: isEditing ? 'move' : 'default',
                  opacity: draggedTabIndex === index ? 0.5 : 1,
                }}
              >
                {isEditing && (
                  <GripVertical className="h-4 w-4 text-gray-400 absolute left-1 top-1/2 -translate-y-1/2 pointer-events-none" />
                )}
                <TabsTrigger 
                  value={tab.id}
                  className={isEditing ? 'pl-6' : ''}
                >
                  {tab.name}
                </TabsTrigger>
              </div>
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
          <TabsContent key={tab.id} value={tab.id} className="mt-4">
            {tab.items.length > 0 ? (
              <DashboardGrid
                items={tab.items}
                onLayoutChange={handleLayoutChange}
                onEditItem={handleEditItem}
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

      <EditItemDialog
        open={showEditItemDialog}
        onClose={() => {
          setShowEditItemDialog(false)
          setEditingItem(null)
        }}
        item={editingItem}
        tabs={dashboard.tabs}
        currentTabId={activeTabId}
        onSave={handleSaveItem}
      />
    </div>
  )
}
