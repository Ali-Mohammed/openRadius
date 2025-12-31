import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useKeycloak } from '../contexts/KeycloakContext'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Label } from './ui/label'
import { Input } from './ui/input'
import { Button } from './ui/button'
import { usersApi } from '../lib/api'

interface EditProfileDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProfileUpdated?: () => void
}

export const EditProfileDialog = ({ open, onOpenChange, onProfileUpdated }: EditProfileDialogProps) => {
  const { t } = useTranslation()
  const { keycloak } = useKeycloak()
  const queryClient = useQueryClient()
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
  })

  // Fetch users to find current user
  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAllUsers,
    enabled: open && !!keycloak.token,
  })

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: usersApi.updateProfile,
    onSuccess: () => {
      // Invalidate queries to refetch updated data
      queryClient.invalidateQueries({ queryKey: ['users'] })
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      onOpenChange(false)
      if (onProfileUpdated) {
        onProfileUpdated()
      }
    },
    onError: (error) => {
      console.error('Error updating profile:', error)
    },
  })

  useEffect(() => {
    if (open && keycloak.tokenParsed) {
      const email = keycloak.tokenParsed?.email
      const user = users.find((u: any) => u.email === email)
      
      if (user) {
        setFormData({
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        })
      } else {
        // Fallback to token values if user not in database
        setFormData({
          email: keycloak.tokenParsed?.email || '',
          firstName: keycloak.tokenParsed?.given_name || '',
          lastName: keycloak.tokenParsed?.family_name || '',
        })
      }
    }
  }, [open, users, keycloak.tokenParsed])

  const handleSave = () => {
    updateProfileMutation.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{t('user.editProfile')}</DialogTitle>
          <DialogDescription>
            {t('user.editProfileDesc')}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="email">{t('user.email')}</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              disabled
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="firstName">{t('user.firstName')}</Label>
            <Input
              id="firstName"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="lastName">{t('user.lastName')}</Label>
            <Input
              id="lastName"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
          </div>
        </div>
        <DialogFooter className="pt-4 border-t border-gray-200 dark:border-gray-700">
          <div className="flex flex-col-reverse sm:flex-row w-full sm:w-auto gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              type="button"
              className="flex-1 sm:flex-none"
            >
              {t('user.cancel')}
            </Button>
            <Button 
              variant="default"
              onClick={handleSave} 
              disabled={updateProfileMutation.isPending}
              type="button"
              className="flex-1 sm:flex-none"
            >
              {updateProfileMutation.isPending ? t('common.loading') : t('user.saveChanges')}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
