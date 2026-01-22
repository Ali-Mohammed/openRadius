import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import { QueryBuilder } from '../../QueryBuilder'
import type { DashboardItem, ChartConfig, FilterGroup, FilterCondition } from '../../../types/dashboard'

interface AddItemDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (item: DashboardItem) => void
}

export function AddItemDialog({ open, onClose, onAdd }: AddItemDialogProps) {
  const [itemType, setItemType] = useState<DashboardItem['type']>('chart')
  const [title, setTitle] = useState('')
  const [chartType, setChartType] = useState<ChartConfig['chartType']>('bar')
  const [dataSource, setDataSource] = useState<ChartConfig['dataSource']>('radius-users')
  const [disaggregationField, setDisaggregationField] = useState<string>('')
  const [aggregationType, setAggregationType] = useState<'count' | 'sum' | 'avg'>('count')
  const [valueField, setValueField] = useState<string>('balance')
  const [filterGroup, setFilterGroup] = useState<FilterGroup>({
    id: 'root',
    logic: 'and',
    conditions: []
  })

  const handleAdd = () => {
    const newItem: DashboardItem = {
      id: `item-${Date.now()}`,
      type: itemType,
      title,
      layout: {
        x: 0,
        y: 0,
        w: itemType === 'chart' ? 6 : itemType === 'metric' ? 3 : 6,
        h: itemType === 'chart' ? 4 : itemType === 'metric' ? 2 : 4,
      },
      config: getDefaultConfig(),
    }

    onAdd(newItem)
    handleClose()
  }

  const handleClose = () => {
    onClose()
    // Reset form
    setTitle('')
    setChartType('bar')
    setDataSource('radius-users')
    setDisaggregationField('')
    setAggregationType('count')
    setValueField('balance')
    setFilterGroup({ id: 'root', logic: 'and', conditions: [] })
  }

  const getDefaultConfig = () => {
    switch (itemType) {
      case 'chart':
        return {
          chartType,
          dataSource,
          filterGroup: filterGroup.conditions.length > 0 ? filterGroup : undefined,
          disaggregationField: disaggregationField || undefined,
          aggregationType,
          valueField: aggregationType !== 'count' ? valueField : undefined,
          options: {},
        }
      case 'text':
        return {
          content: 'Enter your text here...',
          fontSize: 14,
          alignment: 'left' as const,
        }
      case 'metric':
        return {
          value: 0,
          label: 'Metric',
        }
      case 'table':
        return {
          columns: [
            { key: 'name', label: 'Name' },
            { key: 'value', label: 'Value' },
          ],
          data: [
            { name: 'Item 1', value: '100' },
            { name: 'Item 2', value: '200' },
          ],
        }
      default:
        return {}
    }
  }

  // Filter columns for RADIUS users
  const radiusUserFilterColumns = [
    { key: 'username', label: 'Username', type: 'text' as const },
    { key: 'profileId', label: 'Profile', type: 'select' as const, options: [] }, // Will be populated from API
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

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Dashboard Item</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter item title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Item Type</Label>
            <Select value={itemType} onValueChange={(v) => setItemType(v as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="chart">Chart</SelectItem>
                <SelectItem value="metric">Metric</SelectItem>
                <SelectItem value="text">Text</SelectItem>
                <SelectItem value="table">Table</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {itemType === 'chart' && (
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
                        <SelectItem value="">No grouping</SelectItem>
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
            <Button variant="outline" onClick={handleClose}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={!title}>
              Add Item
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
