import { useState } from "react"
import { useQuery, useMutation } from "@tanstack/react-query"
import { usersApi } from "@/lib/api"
import { useKeycloak } from "@/contexts/KeycloakContext"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Input } from "@/components/ui/input"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Search, UserCog, AlertTriangle } from "lucide-react"
import { toast } from "sonner"

interface ImpersonateUserDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

interface User {
  id: number
  email: string
  firstName: string
  lastName: string
}

export function ImpersonateUserDialog({ open, onOpenChange }: ImpersonateUserDialogProps) {
  const { keycloak } = useKeycloak()
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  const currentUserEmail = keycloak.tokenParsed?.email

  const { data: users = [], isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: open,
  })

  const impersonateMutation = useMutation({
    mutationFn: (userId: number) => usersApi.impersonateUser(userId),
    onSuccess: (data) => {
      toast.success(`Now impersonating ${data.impersonatedUser.firstName} ${data.impersonatedUser.lastName}`)
      
      // Store impersonation context in sessionStorage
      sessionStorage.setItem('impersonation', JSON.stringify({
        originalAdmin: data.originalAdmin,
        impersonatedUser: data.impersonatedUser,
        startedAt: new Date().toISOString(),
      }))

      // Reload the page to refresh all contexts with impersonated user
      window.location.reload()
    },
    onError: (error: unknown) => {
      const err = error as { response?: { data?: { message?: string } } }
      const errorMessage = err?.response?.data?.message || "Failed to impersonate user"
      toast.error(errorMessage)
    },
  })

  const filteredUsers = users.filter((user: User) => {
    // Don't show current user
    if (user.email === currentUserEmail) return false
    
    const query = searchQuery.toLowerCase()
    return (
      user.firstName.toLowerCase().includes(query) ||
      user.lastName.toLowerCase().includes(query) ||
      user.email.toLowerCase().includes(query)
    )
  })

  const handleUserSelect = (user: User) => {
    setSelectedUser(user)
    setShowConfirmDialog(true)
  }

  const handleConfirmImpersonation = () => {
    if (selectedUser) {
      impersonateMutation.mutate(selectedUser.id)
      setShowConfirmDialog(false)
      onOpenChange(false)
    }
  }

  const getUserInitials = (user: User) => {
    return `${user.firstName[0]}${user.lastName[0]}`.toUpperCase()
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserCog className="h-5 w-5" />
              Impersonate User
            </DialogTitle>
            <DialogDescription>
              Select a user to impersonate. You will be able to see and interact with the system as that user.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search users by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="border rounded-lg max-h-100 overflow-y-auto">
              {isLoading ? (
                <div className="p-8 text-center text-muted-foreground">
                  Loading users...
                </div>
              ) : filteredUsers.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  {searchQuery ? "No users found matching your search" : "No users available"}
                </div>
              ) : (
                <div className="divide-y">
                  {filteredUsers.map((user: User) => (
                    <button
                      key={user.id}
                      onClick={() => handleUserSelect(user)}
                      className="w-full p-4 flex items-center gap-3 hover:bg-accent transition-colors text-left"
                    >
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {getUserInitials(user)}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {user.firstName} {user.lastName}
                        </div>
                        <div className="text-sm text-muted-foreground truncate">
                          {user.email}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm User Impersonation
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                You are about to impersonate:
              </p>
              {selectedUser && (
                <div className="p-3 bg-accent rounded-lg">
                  <div className="font-semibold">
                    {selectedUser.firstName} {selectedUser.lastName}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {selectedUser.email}
                  </div>
                </div>
              )}
              <p className="text-sm">
                This action will be logged. You will see and interact with the system as this user.
                To exit impersonation, use the "Exit Impersonation" option in your profile menu.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmImpersonation}
              disabled={impersonateMutation.isPending}
              className="bg-primary"
            >
              {impersonateMutation.isPending ? "Starting..." : "Start Impersonation"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
