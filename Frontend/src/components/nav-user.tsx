import { useKeycloak } from "@/contexts/KeycloakContext"
import { useQuery, useMutation } from "@tanstack/react-query"
import { usersApi } from "@/lib/api"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar"
import { ChevronsUpDown, LogOut, User, Settings, KeyRound, UserCog, Users, ShieldAlert } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { appConfig } from "@/config/app.config"
import { hasRole } from "@/utils/keycloak-helper"
import { ImpersonateUserDialog } from "@/components/impersonate-user-dialog"
import { useState, useEffect } from "react"
import { useToast } from "@/hooks/use-toast"
import { Badge } from "@/components/ui/badge"

export function NavUser() {
  const { keycloak, authenticated } = useKeycloak()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { toast } = useToast()
  const [showImpersonateDialog, setShowImpersonateDialog] = useState(false)
  const [impersonationData, setImpersonationData] = useState<any>(null)

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: authenticated && !!keycloak.token,
  })

  const exitImpersonationMutation = useMutation({
    mutationFn: usersApi.exitImpersonation,
    onSuccess: () => {
      sessionStorage.removeItem('impersonation')
      toast({
        title: "Impersonation Ended",
        description: "You have returned to your account",
      })
      window.location.reload()
    },
  })

  useEffect(() => {
    // Check if in impersonation mode
    const impersonationStr = sessionStorage.getItem('impersonation')
    if (impersonationStr) {
      try {
        setImpersonationData(JSON.parse(impersonationStr))
      } catch (e) {
        sessionStorage.removeItem('impersonation')
      }
    }
  }, [])

  const email = keycloak.tokenParsed?.email
  const dbUser = users.find((u: any) => u.email === email)
  const isAdmin = authenticated && hasRole(keycloak, 'admin')
  const isImpersonating = !!impersonationData

  const getProfileImage = () => {
    // Try to get picture from token claims or attributes
    return keycloak.tokenParsed?.picture || null
  }

  const getUserInitials = () => {
    if (dbUser) {
      return `${dbUser.firstName[0]}${dbUser.lastName[0]}`.toUpperCase()
    }
    const name = keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || 'U'
    return name
      .split(' ')
      .map((n: string) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const getDisplayName = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return `${impersonationData.impersonatedUser.firstName} ${impersonationData.impersonatedUser.lastName}`
    }
    if (dbUser) {
      return `${dbUser.firstName} ${dbUser.lastName}`
    }
    return keycloak.tokenParsed?.name || keycloak.tokenParsed?.preferred_username || t('user.profile')
  }

  const getDisplayEmail = () => {
    if (isImpersonating && impersonationData?.impersonatedUser) {
      return impersonationData.impersonatedUser.email
    }
    return email
  }

  const handleLogout = () => {
    keycloak.logout()
  }

  const handleManageAccount = () => {
    // Open Keycloak account management page
    const accountUrl = `${appConfig.keycloak.url}/realms/${appConfig.keycloak.realm}/account`
    window.open(accountUrl, '_blank')
  }

  const handleExitImpersonation = () => {
    exitImpersonationMutation.mutate()
  }

  if (!authenticated) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="h-8 w-8 rounded-lg">
                <AvatarImage src={getProfileImage() || undefined} alt={getDisplayName()} />
                <AvatarFallback className="rounded-lg">
                  {getUserInitials()}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{getDisplayName()}</span>
                <span className="truncate text-xs">{email}</span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            side="bottom"
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="h-8 w-8 rounded-lg">
                  <AvatarImage src={getProfileImage() || undefined} alt={getDisplayName()} />
                  <AvatarFallback className="rounded-lg">
                    {getUserInitials()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{getDisplayName()}</span>
                  <span className="truncate text-xs">{email}</span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => navigate('/profile')}>
              <User className="mr-2 h-4 w-4" />
              {t('user.profile')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleManageAccount}>
              <UserCog className="mr-2 h-4 w-4" />
              Manage Account
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              {t('user.logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
