import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { QueryBuilder } from '../../QueryBuilder'
import type { DashboardItem, DashboardTab, ChartConfig, FilterGroup } from '../../../types/dashboard'

interface EditItemDialogProps {
  open: boolean
  onClose: () => void
  item: DashboardItem | null
  tabs: DashboardTab[]
  currentTabId: string
  onSave: (itemId: string, updates: Partial<DashboardItem>, newTabId?: string) => void
}

export function EditItemDialog({
  open,
  onClose,
  item,
  tabs,
  currentTabId,
  onSave,
}: EditItemDialogProps) {
  const [title, setTitle] = useState('')
  const [selectedTabId, setSelectedTabId] = useState('')
  
  // Chart-specific states
  const [chartType, setChartType] = useState<ChartConfig['chartType']>('bar')
  const [dataSource, setDataSource] = useState<ChartConfig['dataSource']>('radius-users')
  const [disaggregationField, setDisaggregationField] = useState<string>('none')
  const [aggregationType, setAggregationType] = useState<'count' | 'sum' | 'avg'>('count')
  const [valueField, setValueField] = useState<string>('balance')
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: 'root',
    logic: 'and',
    conditions: []
  })

  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setSelectedTabId(currentTabId)
      
      // Load chart-specific configuration
      if (item.type === 'chart') {
        const config = item.config as ChartConfig
        setChartType(config.chartType || 'bar')
        setDataSource(config.dataSource || 'radius-users')
        setDisaggregationField(config.disaggregationField || 'none')
        setAggregationType(config.aggregationType || 'count')
        setValueField(config.valueField || 'balance')
        setFilterGroup(config.filterGroup || { id: 'root', logic: 'and', conditions: [] })
      }
    }
  }, [item, currentTabId])

  const handleSave = () => {
    if (!item) return

    let config: any = item.config
    
    // Build chart configuration
    if (item.type === 'chart') {
      config = {
        chartType,
        dataSource,
        filterGroup: filterGroup.conditions.length > 0 ? filterGroup : undefined,
        disaggregationField: disaggregationField !== 'none' ? disaggregationField : undefined,
        aggregationType,
        valueField: aggregationType !== 'count' ? valueField : undefined,
        options: {},
      }
    }

    const updates: Partial<DashboardItem> = {
      title,
      config,
    }

    const newTabId = selectedTabId !== currentTabId ? selectedTabId : undefined
    onSave(item.id, updates, newTabId)
    onClose()
  }

  // Filter columns for RADIUS users
  const radiusUserFilterColumns = [
    { key: 'username', label: 'Username', type: 'text' as const },
    { key: 'profileId', label: 'Profile', type: 'select' as const, options: [] },
    { key: 'balance', label: 'Balance', type: 'number' as const },
    { key: 'status', label: 'Status', type: 'select' as const, options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]},
    { key: 'expiration', label: 'Expiration', type: 'date' as const },
    { key: 'tags', label: 'Tags', type: 'array' as const },
  ]

  const handleFilterChange = (group: FilterGroup) => {
    setFilterGroup(group)
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {item.type === 'chart' ? 'Chart' : item.type} Widget</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter widget title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tab">Tab</Label>
            <Select value={selectedTabId} onValueChange={setSelectedTabId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {tabs.map((tab) => (
                  <SelectItem key={tab.id} value={tab.id}>
                    {tab.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {item.type === 'chart' && (
            <>
              <div className="space-y-2">
                <Label htmlFor="dataSource">Data Source</Label>
                <Select value={dataSource} onValueChange={(v) => setDataSource(v as ChartConfig['dataSource'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="radius-users">RADIUS Users</SelectItem>
                    <SelectItem value="manual">Manual Data</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="chartType">Chart Type</Label>
                <Select value={chartType} onValueChange={(v) => setChartType(v as ChartConfig['chartType'])}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar Chart</SelectItem>
                    <SelectItem value="line">Line Chart</SelectItem>
                    <SelectItem value="pie">Pie Chart</SelectItem>
                    <SelectItem value="donut">Donut Chart</SelectItem>
                    <SelectItem value="area">Area Chart</SelectItem>
                    <SelectItem value="number">Number (Single Value)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {dataSource === 'radius-users' && (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="disaggregation">Group By (Disaggregation)</Label>
                    <Select value={disaggregationField} onValueChange={setDisaggregationField}>
                      <SelectTrigger>
                        <SelectValue placeholder="No grouping (single value)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No grouping</SelectItem>
                        <SelectItem value="profile">Profile</SelectItem>
                        <SelectItem value="status">Status</SelectItem>
                        <SelectItem value="tags">Tags</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="aggregation">Aggregation Type</Label>
                    <Select value={aggregationType} onValueChange={(v) => setAggregationType(v as 'count' | 'sum' | 'avg')}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="count">Count</SelectItem>
                        <SelectItem value="sum">Sum</SelectItem>
                        <SelectItem value="avg">Average</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {(aggregationType === 'sum' || aggregationType === 'avg') && (
                    <div className="space-y-2">
                      <Label htmlFor="valueField">Value Field</Label>
                      <Select value={valueField} onValueChange={setValueField}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="balance">Balance</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  <div className="space-y-2 border rounded-lg p-4">
                    <Label>Filter Criteria (Optional)</Label>
                    <p className="text-sm text-muted-foreground mb-2">
                      Add filters to narrow down which users are included in this chart
                    </p>
                    <QueryBuilder
                      filterGroup={filterGroup}
                      onChange={handleFilterChange}
                      columns={radiusUserFilterColumns}
                    />
                  </div>
                </>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSave}>
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
