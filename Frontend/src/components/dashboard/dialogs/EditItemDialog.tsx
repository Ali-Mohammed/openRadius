import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../ui/select'
import type { DashboardItem, DashboardTab } from '../../../types/dashboard'

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
  const [configJson, setConfigJson] = useState('')

  useEffect(() => {
    if (item) {
      setTitle(item.title)
      setSelectedTabId(currentTabId)
      setConfigJson(JSON.stringify(item.config, null, 2))
    }
  }, [item, currentTabId])

  const handleSave = () => {
    if (!item) return

    try {
      const config = JSON.parse(configJson)
      const updates: Partial<DashboardItem> = {
        title,
        config,
      }

      const newTabId = selectedTabId !== currentTabId ? selectedTabId : undefined
      onSave(item.id, updates, newTabId)
      onClose()
    } catch (error) {
      alert('Invalid JSON configuration')
    }
  }

  if (!item) return null

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit {item.type} Widget</DialogTitle>
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

          <div className="space-y-2">
            <Label htmlFor="config">Configuration (JSON)</Label>
            <Textarea
              id="config"
              value={configJson}
              onChange={(e) => setConfigJson(e.target.value)}
              placeholder="Enter widget configuration as JSON"
              rows={15}
              className="font-mono text-sm"
            />
            <p className="text-xs text-gray-500">
              Edit the JSON configuration for this widget. Be careful to maintain valid JSON syntax.
            </p>
          </div>

          <div className="flex justify-end gap-2">
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
