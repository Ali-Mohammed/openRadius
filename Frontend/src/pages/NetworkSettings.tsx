import { useState } from 'react'
import { Plus, Trash2, Edit2, Check, X } from 'lucide-react'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs'
import { Badge } from '../components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select'
import { toast } from 'sonner'

interface OltDevice {
  id: number
  name: string
  status: 'active' | 'inactive' | 'maintenance'
}

export default function NetworkSettings() {
  const [activeTab, setActiveTab] = useState('olt-devices')
  const [devices, setDevices] = useState<OltDevice[]>([
    { id: 1, name: 'OLT-Main-01', status: 'active' },
    { id: 2, name: 'OLT-Main-02', status: 'active' },
    { id: 3, name: 'OLT-Backup-01', status: 'inactive' },
  ])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    status: 'active' as OltDevice['status'],
  })

  const handleAdd = () => {
    if (!formData.name.trim()) {
      toast.error('Device name is required')
      return
    }

    const newDevice: OltDevice = {
      id: Math.max(0, ...devices.map(d => d.id)) + 1,
      name: formData.name,
      status: formData.status,
    }

    setDevices([...devices, newDevice])
    toast.success('OLT device added successfully')
    setIsAddDialogOpen(false)
    setFormData({ name: '', status: 'active' })
  }

  const handleEdit = (device: OltDevice) => {
    setEditingId(device.id)
    setFormData({ name: device.name, status: device.status })
  }

  const handleSave = (id: number) => {
    if (!formData.name.trim()) {
      toast.error('Device name is required')
      return
    }

    setDevices(devices.map(d => 
      d.id === id 
        ? { ...d, name: formData.name, status: formData.status }
        : d
    ))
    toast.success('Device updated successfully')
    setEditingId(null)
    setFormData({ name: '', status: 'active' })
  }

  const handleCancel = () => {
    setEditingId(null)
    setFormData({ name: '', status: 'active' })
  }

  const handleDelete = (id: number) => {
    setDevices(devices.filter(d => d.id !== id))
    toast.success('Device deleted successfully')
  }

  const getStatusBadge = (status: OltDevice['status']) => {
    const variants = {
      active: { variant: 'default' as const, label: 'Active' },
      inactive: { variant: 'secondary' as const, label: 'Inactive' },
      maintenance: { variant: 'outline' as const, label: 'Maintenance' },
    }
    const { variant, label } = variants[status]
    return <Badge variant={variant}>{label}</Badge>
  }

  return (
    <div className="flex-1 space-y-6 p-8 pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Network Settings</h2>
          <p className="text-muted-foreground">
            Manage network devices and configurations
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="olt-devices">OLT Device Names</TabsTrigger>
          <TabsTrigger value="fdt-config">FDT Configuration</TabsTrigger>
          <TabsTrigger value="fat-config">FAT Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="olt-devices" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>OLT Device Names</CardTitle>
                  <CardDescription>
                    Manage OLT device names and their operational status
                  </CardDescription>
                </div>
                <Button onClick={() => setIsAddDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Device
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device Name</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No devices found. Click "Add Device" to create one.
                      </TableCell>
                    </TableRow>
                  ) : (
                    devices.map((device) => (
                      <TableRow key={device.id}>
                        <TableCell>
                          {editingId === device.id ? (
                            <Input
                              value={formData.name}
                              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                              placeholder="Device name"
                              className="max-w-xs"
                            />
                          ) : (
                            <span className="font-medium">{device.name}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {editingId === device.id ? (
                            <Select
                              value={formData.status}
                              onValueChange={(value) => setFormData({ ...formData, status: value as OltDevice['status'] })}
                            >
                              <SelectTrigger className="w-[180px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="active">Active</SelectItem>
                                <SelectItem value="inactive">Inactive</SelectItem>
                                <SelectItem value="maintenance">Maintenance</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : (
                            getStatusBadge(device.status)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {editingId === device.id ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleSave(device.id)}
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={handleCancel}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            </div>
                          ) : (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEdit(device)}
                              >
                                <Edit2 className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDelete(device.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fdt-config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FDT Configuration</CardTitle>
              <CardDescription>
                Configure Fiber Distribution Terminal settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">FDT configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fat-config" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>FAT Configuration</CardTitle>
              <CardDescription>
                Configure Fiber Access Terminal settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">FAT configuration coming soon...</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Add Device Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add OLT Device</DialogTitle>
            <DialogDescription>
              Enter the device name and select its operational status.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="deviceName">Device Name</Label>
              <Input
                id="deviceName"
                placeholder="e.g., OLT-Main-03"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => setFormData({ ...formData, status: value as OltDevice['status'] })}
              >
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                  <SelectItem value="maintenance">Maintenance</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd}>Add Device</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
