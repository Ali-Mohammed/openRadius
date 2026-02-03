import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Combobox } from '@/components/ui/combobox'
import { Users, Settings, List, Tag, Plus, Trash2 } from 'lucide-react'
import * as LucideIcons from 'lucide-react'
import { radiusUserApi } from '@/api/radiusUserApi'
import { radiusProfileApi } from '@/api/radiusProfileApi'
import { radiusGroupApi } from '@/api/radiusGroupApi'
import { radiusTagApi } from '@/api/radiusTagApi'
import { radiusCustomAttributeApi, type RadiusCustomAttribute, type CreateRadiusCustomAttributeRequest } from '@/api/radiusCustomAttributeApi'
import { zoneApi, type Zone } from '@/services/zoneApi'
import { formatApiError } from '@/utils/errorHandler'
import { useWorkspace } from '@/contexts/WorkspaceContext'

export function EditTab() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { t, i18n } = useTranslation()
  const queryClient = useQueryClient()
  const { currentWorkspaceId } = useWorkspace()
  const [zoneSearchQuery, setZoneSearchQuery] = useState('')

  const [formData, setFormData] = useState({
    username: '',
    password: '',
    firstname: '',
    lastname: '',
    email: '',
    phone: '',
    city: '',
    profileId: '',
    expiration: '',
    enabled: true,
    staticIp: '',
    company: '',
    address: '',
    contractId: '',
    notes: '',
    deviceSerialNumber: '',
    gpsLat: '',
    gpsLng: '',
    simultaneousSessions: '1',
    zoneId: '',
    groupId: '',
  })

  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [customAttributes, setCustomAttributes] = useState<Array<{ id?: number; attributeName: string; attributeValue: string; enabled: boolean }>>([])

  // Check if id is a UUID (has dashes) or numeric ID
  const isUuid = id?.includes('-')

  // Fetch user data
  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ['radius-user', currentWorkspaceId, id],
    queryFn: async () => {
      if (!id) throw new Error('Missing user ID')
      return isUuid 
        ? radiusUserApi.getByUuid(id)
        : radiusUserApi.getById(Number(id))
    },
    enabled: !!id,
  })

  // Fetch profiles
  const { data: profilesData } = useQuery({
    queryKey: ['radius-profiles', currentWorkspaceId],
    queryFn: () => radiusProfileApi.getAll(),
  })

  const profiles = profilesData?.data || []

  // Fetch zones
  const { data: zonesData } = useQuery({
    queryKey: ['zones', currentWorkspaceId],
    queryFn: () => zoneApi.getAll(),
  })

  const flatZones: (Zone & { level: number })[] = []
  const flattenZones = (zones: Zone[], level = 0) => {
    zones?.forEach((zone) => {
      flatZones.push({ ...zone, level })
      if (zone.children && zone.children.length > 0) {
        flattenZones(zone.children, level + 1)
      }
    })
  }
  if (zonesData?.data) {
    flattenZones(zonesData.data)
  }

  const filteredFlatZones = zoneSearchQuery
    ? flatZones.filter((zone) => zone.name.toLowerCase().includes(zoneSearchQuery.toLowerCase()))
    : flatZones

  // Fetch groups
  const { data: groupsData } = useQuery({
    queryKey: ['radius-groups', currentWorkspaceId],
    queryFn: () => radiusGroupApi.getAll(),
  })

  // Fetch tags
  const { data: tagsData } = useQuery({
    queryKey: ['radius-tags', currentWorkspaceId],
    queryFn: () => radiusTagApi.getAll(),
  })

  const tags = tagsData?.data || []

  // Fetch custom attributes - use user.id once user is loaded
  const { data: customAttributesData } = useQuery({
    queryKey: ['radius-custom-attributes', currentWorkspaceId, user?.id],
    queryFn: async () => {
      if (!user?.id) return []
      return radiusCustomAttributeApi.getByUserId(user.id)
    },
    enabled: !!user?.id,
  })

  // Populate form when user data loads
  useEffect(() => {
    if (user) {
      setFormData({
        username: user.username || '',
        password: '',
        firstname: user.firstname || '',
        lastname: user.lastname || '',
        email: user.email || '',
        phone: user.phone || '',
        city: user.city || '',
        profileId: user.profileId?.toString() || '',
        expiration: user.expiration ? new Date(user.expiration).toISOString().split('T')[0] : '',
        enabled: user.enabled ?? true,
        staticIp: user.staticIp || '',
        company: user.company || '',
        address: user.address || '',
        contractId: user.contractId || '',
        notes: user.notes || '',
        deviceSerialNumber: user.deviceSerialNumber || '',
        gpsLat: user.gpsLat || '',
        gpsLng: user.gpsLng || '',
        simultaneousSessions: user.simultaneousSessions?.toString() || '1',
        zoneId: user.zoneId?.toString() || '',
        groupId: user.groupId?.toString() || '',
      })

      if (user.tags) {
        setSelectedTagIds(user.tags.map(tag => tag.id))
      }
    }
  }, [user])

  // Populate custom attributes
  useEffect(() => {
    if (customAttributesData) {
      setCustomAttributes(
        customAttributesData.map((attr: RadiusCustomAttribute) => ({
          id: attr.id,
          attributeName: attr.attributeName,
          attributeValue: attr.attributeValue,
          enabled: attr.enabled ?? true,
        }))
      )
    }
  }, [customAttributesData])

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      if (!id) throw new Error('Missing user ID')
      return isUuid
        ? radiusUserApi.updateByUuid(id, data)
        : radiusUserApi.update(Number(id), data)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['radius-users', currentWorkspaceId] })
      queryClient.invalidateQueries({ queryKey: ['radius-user', currentWorkspaceId, id] })
      toast.success(t('radiusUsers.updateSuccess'))
    },
    onError: (error: any) => {
      toast.error(formatApiError(error) || t('radiusUsers.updateError'))
    },
  })

  const handleSave = async () => {
    if (!formData.username) {
      toast.error('Username is required')
      return
    }

    const payload: any = {
      username: formData.username,
      firstname: formData.firstname || null,
      lastname: formData.lastname || null,
      email: formData.email || null,
      phone: formData.phone || null,
      city: formData.city || null,
      profileId: formData.profileId ? Number(formData.profileId) : null,
      expiration: formData.expiration || null,
      enabled: formData.enabled,
      company: formData.company || null,
      address: formData.address || null,
      contractId: formData.contractId || null,
      notes: formData.notes || null,
      deviceSerialNumber: formData.deviceSerialNumber || null,
      gpsLat: formData.gpsLat || null,
      gpsLng: formData.gpsLng || null,
      simultaneousSessions: formData.simultaneousSessions ? Number(formData.simultaneousSessions) : null,
      zoneId: formData.zoneId ? Number(formData.zoneId) : null,
      groupId: formData.groupId ? Number(formData.groupId) : null,
      tagIds: selectedTagIds,
    }

    if (formData.password) {
      payload.password = formData.password
    }

    // Handle custom attributes
    const attributesToCreate: CreateRadiusCustomAttributeRequest[] = []
    const attributesToUpdate: RadiusCustomAttribute[] = []

    customAttributes.forEach((attr) => {
      if (!attr.attributeName || !attr.attributeValue || !user?.id) return

      if (attr.id) {
        attributesToUpdate.push({
          id: attr.id,
          userId: user.id,
          attributeName: attr.attributeName,
          attributeValue: attr.attributeValue,
          enabled: attr.enabled,
        })
      } else {
        attributesToCreate.push({
          userId: user.id,
          attributeName: attr.attributeName,
          attributeValue: attr.attributeValue,
          enabled: attr.enabled,
        })
      }
    })

    try {
      await updateMutation.mutateAsync(payload)

      // Update custom attributes
      for (const attr of attributesToUpdate) {
        await radiusCustomAttributeApi.update(attr.id!, attr)
      }
      for (const attr of attributesToCreate) {
        await radiusCustomAttributeApi.create(attr)
      }

      queryClient.invalidateQueries({ queryKey: ['radius-custom-attributes', currentWorkspaceId, user?.id] })
    } catch (error) {
      console.error('Error saving user:', error)
    }
  }

  if (isLoadingUser) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded" />
            <div className="h-8 bg-muted animate-pulse rounded" />
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Users className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Basic Information</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">{t('radiusUsers.username')} <span className="text-destructive">*</span></Label>
                <Input
                  id="username"
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g., john.doe"
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password (leave empty to keep current)</Label>
                <Input
                  id="password"
                  type="text"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Enter new password"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email">{t('radiusUsers.email')}</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="e.g., john@example.com"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">{t('radiusUsers.phone')}</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="e.g., +1234567890"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="firstname">{t('radiusUsers.firstName')}</Label>
                <Input
                  id="firstname"
                  value={formData.firstname}
                  onChange={(e) => setFormData({ ...formData, firstname: e.target.value })}
                  placeholder="e.g., John"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="lastname">{t('radiusUsers.lastName')}</Label>
                <Input
                  id="lastname"
                  value={formData.lastname}
                  onChange={(e) => setFormData({ ...formData, lastname: e.target.value })}
                  placeholder="e.g., Doe"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="city">{t('radiusUsers.city')}</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  placeholder="e.g., New York"
                />
              </div>
              <div className="grid gap-2"></div>
            </div>
          </div>

          {/* Service Configuration */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Settings className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Service Configuration</h3>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="profileId">{t('radiusUsers.profileId')}</Label>
                <Combobox
                  options={profiles.map((profile) => ({
                    value: profile.id?.toString() || '',
                    label: profile.name || ''
                  }))}
                  value={formData.profileId}
                  onValueChange={(value) => setFormData({ ...formData, profileId: value })}
                  placeholder={t('radiusUsers.selectProfile')}
                  searchPlaceholder={t('radiusUsers.searchProfile') || "Search profile..."}
                  emptyText={t('radiusUsers.noProfilesFound') || "No profiles found."}
                  modal={true}
                  disabled
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="simultaneousSessions">{t('radiusUsers.sessions')}</Label>
                <Input
                  id="simultaneousSessions"
                  type="number"
                  value={formData.simultaneousSessions}
                  onChange={(e) => setFormData({ ...formData, simultaneousSessions: e.target.value })}
                  placeholder="e.g., 1"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zoneId">{t('radiusUsers.zone')}</Label>
                <Select
                  value={formData.zoneId}
                  onValueChange={(value) => {
                    setFormData({ ...formData, zoneId: value })
                    setZoneSearchQuery('')
                  }}
                >
                  <SelectTrigger id="zoneId">
                    <SelectValue placeholder={t('radiusUsers.selectZone')} />
                  </SelectTrigger>
                  <SelectContent>
                    <div className="px-2 py-1.5 sticky top-0 bg-white dark:bg-slate-950 border-b z-10">
                      <Input
                        type="text"
                        placeholder={t('radiusUsers.searchZone') || 'Search zone...'}
                        value={zoneSearchQuery}
                        onChange={(e) => setZoneSearchQuery(e.target.value)}
                        className="h-8"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    <SelectItem value="0">{t('radiusUsers.noZone')}</SelectItem>
                    {filteredFlatZones.map((zone) => (
                      <SelectItem key={zone.id} value={zone.id.toString()}>
                        <div className="flex items-center gap-2">
                          <span style={{ marginLeft: `${zone.level * 16}px` }}>
                            {zone.level > 0 && '↳ '}
                          </span>
                          <div
                            className="h-3 w-3 rounded-full flex-shrink-0"
                            style={{ backgroundColor: zone.color || '#3b82f6' }}
                          />
                          <span>{zone.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                    {filteredFlatZones.length === 0 && zoneSearchQuery && (
                      <div className="px-2 py-6 text-center text-sm text-muted-foreground">
                        {t('radiusUsers.noZonesFound') || 'No zones found'}
                      </div>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="groupId">{t('radiusUsers.group')}</Label>
                <Select
                  value={formData.groupId}
                  onValueChange={(value) => setFormData({ ...formData, groupId: value })}
                >
                  <SelectTrigger id="groupId">
                    <SelectValue placeholder={t('radiusUsers.selectGroup') || 'Select Group'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">{t('radiusUsers.noGroup') || 'No Group'}</SelectItem>
                    {groupsData?.data?.map((group) => (
                      <SelectItem key={group.id} value={group.id.toString()}>
                        {group.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="expiration">{t('radiusUsers.expirationDate')}</Label>
                <Input
                  id="expiration"
                  type="date"
                  value={formData.expiration}
                  onChange={(e) => setFormData({ ...formData, expiration: e.target.value })}
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="staticIp">{t('radiusUsers.staticIp')}</Label>
              <Input
                id="staticIp"
                value={formData.staticIp}
                disabled
                className="bg-muted cursor-not-allowed"
                placeholder="Managed from IP Reservations"
              />
              <p className="text-xs text-muted-foreground">
                Static IP is managed from the IP Reservations page
              </p>
            </div>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <List className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Additional Information</h3>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="company">{t('radiusUsers.company')}</Label>
                <Input
                  id="company"
                  value={formData.company}
                  onChange={(e) => setFormData({ ...formData, company: e.target.value })}
                  placeholder="e.g., Acme Corp"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="address">{t('radiusUsers.address')}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="e.g., 123 Main St"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="contractId">{t('radiusUsers.contractId')}</Label>
                  <Input
                    id="contractId"
                    value={formData.contractId}
                    onChange={(e) => setFormData({ ...formData, contractId: e.target.value })}
                    placeholder="e.g., CONTRACT-2024-001"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="deviceSerialNumber">Device Serial Number</Label>
                  <Input
                    id="deviceSerialNumber"
                    value={formData.deviceSerialNumber}
                    onChange={(e) => setFormData({ ...formData, deviceSerialNumber: e.target.value })}
                    placeholder="e.g., SN123456789"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="notes">Notes</Label>
                <Input
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="e.g., Additional notes about the user"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="gpsLat">Latitude</Label>
                  <Input
                    id="gpsLat"
                    value={formData.gpsLat}
                    onChange={(e) => setFormData({ ...formData, gpsLat: e.target.value })}
                    placeholder="e.g., 32.5202391247401"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gpsLng">Longitude</Label>
                  <Input
                    id="gpsLng"
                    value={formData.gpsLng}
                    onChange={(e) => setFormData({ ...formData, gpsLng: e.target.value })}
                    placeholder="e.g., 45.79654097557068"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Custom Attributes Section */}
          <div className="space-y-4 pt-4 border-t">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Custom RADIUS Attributes</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCustomAttributes([...customAttributes, { attributeName: '', attributeValue: '', enabled: true }])
                }}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Attribute
              </Button>
            </div>
            {customAttributes.length > 0 && (
              <div className="space-y-3">
                {customAttributes.map((attr, index) => (
                  <div key={index} className="grid grid-cols-[2fr_2fr_auto_auto] gap-2 items-center p-3 border rounded-lg">
                    <div className="space-y-2">
                      <Label className="text-xs">Attribute Name</Label>
                      <Input
                        value={attr.attributeName}
                        onChange={(e) => {
                          const updated = [...customAttributes]
                          updated[index].attributeName = e.target.value
                          setCustomAttributes(updated)
                        }}
                        placeholder="e.g., Alc-SLA-Prof-Str"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">Value</Label>
                      <Input
                        value={attr.attributeValue}
                        onChange={(e) => {
                          const updated = [...customAttributes]
                          updated[index].attributeValue = e.target.value
                          setCustomAttributes(updated)
                        }}
                        placeholder="e.g., P1"
                      />
                    </div>
                    <div className="flex flex-col items-center gap-1 pt-6">
                      <Switch
                        checked={attr.enabled}
                        onCheckedChange={(checked) => {
                          const updated = [...customAttributes]
                          updated[index].enabled = checked
                          setCustomAttributes(updated)
                        }}
                      />
                      <Label className="text-xs">Enabled</Label>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="mt-6"
                      onClick={() => {
                        setCustomAttributes(customAttributes.filter((_, i) => i !== index))
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Tags & Status */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b">
              <Tag className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">Tags & Status</h3>
            </div>
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="tags">Tags</Label>
                <div className="border rounded-md p-3 space-y-2 max-h-40 overflow-y-auto bg-muted/30">
                  {tags.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No tags available</p>
                  ) : (
                    tags.filter(tag => tag.status === 'active').map((tag) => {
                      const IconComponent = (LucideIcons as any)[tag.icon] || Tag
                      return (
                        <div key={tag.id} className="flex items-center space-x-2 hover:bg-muted/50 p-1.5 rounded transition-colors">
                          <input
                            type="checkbox"
                            id={`tag-${tag.id}`}
                            checked={selectedTagIds.includes(tag.id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedTagIds([...selectedTagIds, tag.id])
                              } else {
                                setSelectedTagIds(selectedTagIds.filter(id => id !== tag.id))
                              }
                            }}
                            className="rounded border-gray-300"
                          />
                          <label
                            htmlFor={`tag-${tag.id}`}
                            className="text-sm font-medium leading-none cursor-pointer flex items-center gap-2 flex-1"
                          >
                            <IconComponent className="h-4 w-4" style={{ color: tag.color }} />
                            {tag.title}
                          </label>
                        </div>
                      )
                    })
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg bg-muted/30">
                <div className="space-y-0.5">
                  <Label htmlFor="enabled" className="text-sm font-medium">{t('radiusUsers.enabled')}</Label>
                  <p className="text-xs text-muted-foreground">Enable or disable user access</p>
                </div>
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
              </div>
            </div>
          </div>

          {/* Save Button */}
          <div className="flex justify-end pt-4 border-t">
            <Button
              onClick={handleSave}
              disabled={!formData.username || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : t('radiusUsers.update')}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
