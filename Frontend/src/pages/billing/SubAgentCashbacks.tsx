import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Pencil, Trash2, Users, DollarSign } from 'lucide-react'
import { Button } from '../../components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../../components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../../components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { toast } from 'sonner'
import { subAgentCashbackApi, type SubAgentCashback, type SubAgent } from '../../api/subAgentCashbackApi'
import { billingProfilesApi, type BillingProfile } from '../../api/billingProfiles'

export default function SubAgentCashbacks() {
  const queryClient = useQueryClient()
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [selectedSubAgent, setSelectedSubAgent] = useState<number | null>(null)
  const [selectedBillingProfile, setSelectedBillingProfile] = useState<number | null>(null)
  const [amount, setAmount] = useState('')
  const [notes, setNotes] = useState('')
  const [editingCashback, setEditingCashback] = useState<SubAgentCashback | null>(null)
  const [deleteId, setDeleteId] = useState<number | null>(null)

  // Queries
  const { data: cashbacks = [], isLoading } = useQuery({
    queryKey: ['sub-agent-cashbacks'],
    queryFn: subAgentCashbackApi.getAll
  })

  const { data: subAgents = [] } = useQuery({
    queryKey: ['sub-agents'],
    queryFn: subAgentCashbackApi.getSubAgents
  })

  const { data: billingProfiles = [] } = useQuery<BillingProfile[]>({
    queryKey: ['billing-profiles'],
    queryFn: billingProfilesApi.getAll
  })

  // Mutations
  const createMutation = useMutation({
    mutationFn: subAgentCashbackApi.createOrUpdate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-cashbacks'] })
      toast.success(editingCashback ? 'Sub-agent cashback updated successfully' : 'Sub-agent cashback created successfully')
      closeDialog()
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to save sub-agent cashback')
    }
  })

  const deleteMutation = useMutation({
    mutationFn: subAgentCashbackApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sub-agent-cashbacks'] })
      toast.success('Sub-agent cashback deleted successfully')
      setDeleteId(null)
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.error || 'Failed to delete sub-agent cashback')
    }
  })

  const closeDialog = () => {
    setIsAddDialogOpen(false)
    setEditingCashback(null)
    setSelectedSubAgent(null)
    setSelectedBillingProfile(null)
    setAmount('')
    setNotes('')
  }

  const openAddDialog = () => {
    closeDialog()
    setIsAddDialogOpen(true)
  }

  const openEditDialog = (cashback: SubAgentCashback) => {
    setEditingCashback(cashback)
    setSelectedSubAgent(cashback.subAgentId)
    setSelectedBillingProfile(cashback.billingProfileId)
    setAmount(cashback.amount.toString())
    setNotes(cashback.notes || '')
    setIsAddDialogOpen(true)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSubAgent || !selectedBillingProfile || !amount) {
      toast.error('Please fill in all required fields')
      return
    }

    createMutation.mutate({
      subAgentId: selectedSubAgent,
      billingProfileId: selectedBillingProfile,
      amount: parseFloat(amount),
      notes: notes || undefined
    })
  }

  const handleDelete = (id: number) => {
    setDeleteId(id)
  }

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId)
    }
  }

  // Group cashbacks by sub-agent
  const cashbacksBySubAgent = cashbacks.reduce((acc, cashback) => {
    const key = cashback.subAgentId
    if (!acc[key]) {
      acc[key] = {
        subAgent: {
          id: cashback.subAgentId,
          email: cashback.subAgentEmail || '',
          name: cashback.subAgentName || cashback.subAgentUsername || 'Unknown',
          username: cashback.subAgentUsername || ''
        },
        cashbacks: []
      }
    }
    acc[key].cashbacks.push(cashback)
    return acc
  }, {} as Record<number, { subAgent: { id: number; email: string; name: string; username: string }; cashbacks: SubAgentCashback[] }>)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sub-Agent Cashback</h1>
          <p className="text-gray-500 mt-1">
            Manage cashback amounts for your sub-agents
          </p>
        </div>
        <Button onClick={openAddDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Cashback
        </Button>
      </div>

      {Object.keys(cashbacksBySubAgent).length === 0 ? (
        <div className="text-center py-12 border-2 border-dashed rounded-lg">
          <Users className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold mb-2">No sub-agent cashbacks yet</h3>
          <p className="text-gray-500 mb-4">
            Start by adding cashback amounts for your sub-agents
          </p>
          <Button onClick={openAddDialog}>
            <Plus className="h-4 w-4 mr-2" />
            Add First Cashback
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(cashbacksBySubAgent).map(({ subAgent, cashbacks: subAgentCashbacks }) => (
            <div key={subAgent.id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{subAgent.name}</h3>
                  <p className="text-sm text-gray-500">{subAgent.email}</p>
                </div>
                <div className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-600" />
                  <span className="text-lg font-semibold">
                    {subAgentCashbacks.reduce((sum, c) => sum + c.amount, 0).toFixed(2)} Total
                  </span>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Billing Profile</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subAgentCashbacks.map((cashback) => (
                    <TableRow key={cashback.id}>
                      <TableCell className="font-medium">
                        {cashback.billingProfileName || `Profile #${cashback.billingProfileId}`}
                      </TableCell>
                      <TableCell>
                        <span className="font-semibold text-green-600">
                          ${cashback.amount.toFixed(2)}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {cashback.notes || '-'}
                      </TableCell>
                      <TableCell>
                        {new Date(cashback.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openEditDialog(cashback)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cashback.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingCashback ? 'Edit Sub-Agent Cashback' : 'Add Sub-Agent Cashback'}
            </DialogTitle>
            <DialogDescription>
              Set cashback amount for a sub-agent and billing profile
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="sub-agent">Sub-Agent *</Label>
              <Select
                value={selectedSubAgent?.toString()}
                onValueChange={(value) => setSelectedSubAgent(parseInt(value))}
                disabled={!!editingCashback}
              >
                <SelectTrigger id="sub-agent">
                  <SelectValue placeholder="Select sub-agent" />
                </SelectTrigger>
                <SelectContent>
                  {subAgents.map((agent) => (
                    <SelectItem key={agent.id} value={agent.id.toString()}>
                      {agent.name} ({agent.email})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="billing-profile">Billing Profile *</Label>
              <Select
                value={selectedBillingProfile?.toString()}
                onValueChange={(value) => setSelectedBillingProfile(parseInt(value))}
                disabled={!!editingCashback}
              >
                <SelectTrigger id="billing-profile">
                  <SelectValue placeholder="Select billing profile" />
                </SelectTrigger>
                <SelectContent>
                  {billingProfiles.map((profile) => (
                    <SelectItem key={profile.id} value={profile.id.toString()}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Cashback Amount *</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                placeholder="Optional notes..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={3}
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : editingCashback ? 'Update' : 'Create'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Sub-Agent Cashback</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this cashback configuration? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDelete}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
