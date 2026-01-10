import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import type { DashboardItem } from '../../../types/dashboard'

interface AddItemDialogProps {
  open: boolean
  onClose: () => void
  onAdd: (item: DashboardItem) => void
}

export function AddItemDialog({ open, onClose, onAdd }: AddItemDialogProps) {
  const [itemType, setItemType] = useState<DashboardItem['type']>('chart')
  const [title, setTitle] = useState('')
  const [chartType, setChartType] = useState('line')

  const handleAdd = () => {
    const newItem: DashboardItem = {
      id: `item-${Date.now()}`,
      type: itemType,
      title,
      layout: {
        x: 0,
        y: 0,
        w: 6,
        h: 4,
      },
      config: getDefaultConfig(),
    }

    onAdd(newItem)
    onClose()
    setTitle('')
  }

  const getDefaultConfig = () => {
    switch (itemType) {
      case 'chart':
        return {
          chartType,
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

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
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
            <div className="space-y-2">
              <Label htmlFor="chartType">Chart Type</Label>
              <Select value={chartType} onValueChange={setChartType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="line">Line Chart</SelectItem>
                  <SelectItem value="bar">Bar Chart</SelectItem>
                  <SelectItem value="pie">Pie Chart</SelectItem>
                  <SelectItem value="area">Area Chart</SelectItem>
                  <SelectItem value="gauge">Gauge</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
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
