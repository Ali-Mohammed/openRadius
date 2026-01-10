import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../ui/dialog'
import { Button } from '../../ui/button'
import { Input } from '../../ui/input'
import { Label } from '../../ui/label'
import { Textarea } from '../../ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select'
import { PREDEFINED_COLORS, AVAILABLE_ICONS, getIconComponent } from '../../../utils/iconColorHelper'

interface CreateDashboardDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (name: string, description: string, icon: string, color: string) => void
}

export function CreateDashboardDialog({
  open,
  onClose,
  onCreate,
}: CreateDashboardDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [icon, setIcon] = useState('LayoutDashboard')
  const [color, setColor] = useState('#3b82f6')
  const [iconPopoverOpen, setIconPopoverOpen] = useState(false)

  const handleCreate = () => {
    onCreate(name, description, icon, color)
    onClose()
    setName('')
    setDescription('')
    setIcon('LayoutDashboard')
    setColor('#3b82f6')
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create New Dashboard</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name">Dashboard Name</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter dashboard name"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Enter dashboard description"
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="color">Color</Label>
              <Select value={color} onValueChange={setColor}>
                <SelectTrigger>
                  <div className="flex items-center gap-2">
                    <div
                      className="w-4 h-4 rounded-full border"
                      style={{ backgroundColor: color }}
                    />
                    <span>
                      {PREDEFINED_COLORS.find(c => c.value === color)?.label || 'Select Color'}
                    </span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {PREDEFINED_COLORS.map((colorOption) => (
                    <SelectItem key={colorOption.value} value={colorOption.value}>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: colorOption.value }}
                        />
                        {colorOption.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icon">Icon</Label>
              <div className="relative">
                <Button 
                  variant="outline" 
                  className="w-full justify-start" 
                  type="button"
                  onClick={() => setIconPopoverOpen(!iconPopoverOpen)}
                >
                  {(() => {
                    const IconComponent = getIconComponent(icon)
                    return <IconComponent className="w-4 h-4 mr-2" />
                  })()}
                  {icon}
                </Button>
                {iconPopoverOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full bg-white dark:bg-gray-800 border rounded-md shadow-lg z-50">
                    <div className="grid grid-cols-6 gap-1 p-2 max-h-[300px] overflow-y-auto">
                      {AVAILABLE_ICONS.map((iconData) => {
                        const IconComponent = iconData.icon
                        const isSelected = icon === iconData.name
                        return (
                          <button
                            key={iconData.name}
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setIcon(iconData.name)
                              setIconPopoverOpen(false)
                            }}
                            className={`p-2 rounded flex items-center justify-center ${
                              isSelected
                                ? 'bg-blue-500 text-white' 
                                : 'bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                            title={iconData.name}
                          >
                            <IconComponent className="w-4 h-4" />
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name}>
              Create Dashboard
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
