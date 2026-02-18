import { useState, useEffect, useRef } from 'react'
import { useParams, useLocation } from 'react-router-dom'
import { Plus, Edit, Settings, Filter, GripVertical, Download, Upload } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs'
import { DashboardGrid } from '../../components/dashboard/DashboardGrid'
import { GlobalFilters } from '../../components/dashboard/GlobalFilters'
import { AddItemDialog } from '../../components/dashboard/dialogs/AddItemDialog'
import { AddTabDialog } from '../../components/dashboard/dialogs/AddTabDialog'
import { EditItemDialog } from '../../components/dashboard/dialogs/EditItemDialog'
import type { Dashboard, DashboardItem, DashboardTab } from '../../types/dashboard'
import { dashboardApi } from '../../api/dashboardApi'
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
  const originalDashboardRef = useRef<Dashboard | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleExportDashboard = async () => {
    if (!id) return
    try {
      const exportData = await dashboardApi.exportDashboard(id)
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dashboard-${dashboard?.name?.replace(/\s+/g, '-').toLowerCase() || id}.json`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success('Dashboard exported successfully')
    } catch (error) {
      console.error('Error exporting dashboard:', error)
      toast.error('Failed to export dashboard')
    }
  }

  const handleImportDashboard = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const importData = JSON.parse(text)

      if (!importData.dashboard) {
        toast.error('Invalid dashboard file: missing dashboard data')
        return
      }

      const result = await dashboardApi.importDashboard(importData)
      toast.success(`Dashboard "${result.name}" imported successfully`)
      // Navigate to the newly imported dashboard
      window.location.href = `/dashboards/${result.id}`
    } catch (error) {
      console.error('Error importing dashboard:', error)
      if (error instanceof SyntaxError) {
        toast.error('Invalid JSON file')
      } else {
        toast.error('Failed to import dashboard')
      }
    } finally {
      // Reset file input so the same file can be imported again
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  useEffect(() => {
    if (id) {
      loadDashboard()
    }
  }, [id])

  // Capture snapshot when entering edit mode
  useEffect(() => {
    if (isEditing && dashboard) {
      console.log('Capturing dashboard snapshot for edit mode')
      originalDashboardRef.current = JSON.parse(JSON.stringify(dashboard))
    } else if (!isEditing) {
      console.log('Exited edit mode, clearing snapshot')
      originalDashboardRef.current = null
    }
  }, [isEditing])

  const saveLayoutChanges = async () => {
    const originalDashboard = originalDashboardRef.current
    
    if (!dashboard || !originalDashboard) {
      console.log('No dashboard or originalDashboard to save', { dashboard: !!dashboard, originalDashboard: !!originalDashboard })
      return
    }

    console.log('Saving layout changes...')
    console.log('Current dashboard:', dashboard)
    console.log('Original dashboard:', originalDashboard)
    let changeCount = 0

    try {
      for (const tab of dashboard.tabs) {
        const originalTab = originalDashboard.tabs.find(t => t.id === tab.id)
        if (originalTab) {
          console.log(`Checking tab ${tab.id} with ${tab.items.length} items`)
          for (const item of tab.items) {
            const originalItem = originalTab.items.find(i => i.id === item.id)
            if (originalItem) {
              console.log(`Item ${item.id} - Current layout:`, item.layout, 'Original layout:', originalItem.layout)
              if (originalItem.layout.x !== item.layout.x ||
                  originalItem.layout.y !== item.layout.y ||
                  originalItem.layout.w !== item.layout.w ||
                  originalItem.layout.h !== item.layout.h) {
                console.log(`Updating layout for item ${item.id}:`, item.layout)
                await dashboardApi.updateItemLayout(dashboard.id, item.id, item.layout)
                changeCount++
              }
            }
          }
        }
      }
      if (changeCount > 0) {
        console.log(`Saved ${changeCount} layout changes`)
        toast.success(`Layout saved successfully (${changeCount} items updated)`)
      } else {
        console.log('No layout changes to save')
      }
      originalDashboardRef.current = null
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
    if (!dashboard) return

    console.log('DashboardView handleLayoutChange called with updatedItems:', updatedItems.map(i => ({ id: i.id, layout: i.layout })))

    // Update local state immediately for smooth UX
    const updatedTabs = dashboard.tabs.map((tab) =>
      tab.id === activeTabId ? { ...tab, items: updatedItems } : tab
    )

    console.log('Setting dashboard with updated tabs')
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
    <div className="p-2">
      <Tabs value={activeTabId} onValueChange={setActiveTabId}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <TabsList>
              {dashboard.tabs.map((tab, index) => (
                <div
                  key={tab.id}
                  draggable={isEditing}
                  onDragStart={() => handleTabDragStart(index)}
                  onDragOver={(e) => handleTabDragOver(e, index)}
                  onDrop={() => handleTabDrop(index)}
                  className={isEditing ? 'cursor-move' : ''}
                >
                  <TabsTrigger value={tab.id} className="flex items-center gap-2">
                    {isEditing && <GripVertical className="h-3 w-3" />}
                    {tab.name}
                  </TabsTrigger>
                </div>
              ))}
            </TabsList>
            {isEditing && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAddTabDialog(true)}
              >
                <Plus className="h-4 w-4" />
              </Button>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportDashboard}
              title="Export dashboard as JSON"
            >
              <Download className="mr-2 h-4 w-4" />
              Export
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              title="Import dashboard from JSON"
            >
              <Upload className="mr-2 h-4 w-4" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportDashboard}
            />
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

        {dashboard.tabs.map((tab) => (
          <TabsContent key={tab.id} value={tab.id} className="mt-2">
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
