import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DollarSign, Users, Tags, Coins, FileText, Code } from 'lucide-react'
import { type FilterColumn } from '@/components/QueryBuilder'
import { settingsApi } from '@/api/settingsApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import CompanyInfoTab from './tabs/CompanyInfoTab'
import CashbackTab from './tabs/CashbackTab'
import TagSyncTab from './tabs/TagSyncTab'
import PaymentMethodsTab from './tabs/PaymentMethodsTab'
import LogsTab from './tabs/LogsTab'
import DeveloperTab from './tabs/DeveloperTab'

export default function GeneralSettings() {
  const { currentWorkspaceId, isLoading: isLoadingWorkspace } = useWorkspace()
  const [searchParams, setSearchParams] = useSearchParams()
  const [currency, setCurrency] = useState('USD')
  const [churnDays, setChurnDays] = useState(20)
  const [dateFormat, setDateFormat] = useState('MM/DD/YYYY')
  
  // Get current tab from URL or default to 'general'
  const currentTab = searchParams.get('tab') || 'general'
  
  // Handler to update tab in URL
  const handleTabChange = (value: string) => {
    setSearchParams({ tab: value })
  }

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['general-settings', currentWorkspaceId],
    queryFn: () => settingsApi.getGeneralSettings(currentWorkspaceId!),
    enabled: currentWorkspaceId !== null,
  })

  // Update local state when data changes
  useEffect(() => {
    if (settingsData) {
      setCurrency(settingsData.currency)
      setChurnDays(settingsData.churnDays)
      setDateFormat(settingsData.dateFormat)
    }
  }, [settingsData])

  // Filter columns for query builder
  const filterColumns: FilterColumn[] = useMemo(
    () => [
      { key: 'username', label: 'Username', type: 'string' },
      { key: 'groupname', label: 'Group', type: 'string' },
      { key: 'priority', label: 'Priority', type: 'number' },
      { key: 'framedipaddress', label: 'IP Address', type: 'string' },
      { key: 'callingstationid', label: 'MAC Address', type: 'string' },
    ],
    []
  )

  if (isLoadingWorkspace || isLoading) {
    return <div className="p-6">Loading...</div>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">General Settings</h1>
        <p className="text-muted-foreground">Configure general workspace preferences</p>
      </div>

      <Tabs value={currentTab} onValueChange={handleTabChange} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">
            <DollarSign className="h-4 w-4 mr-2" />
            General
          </TabsTrigger>
          <TabsTrigger value="radius-user">
            <Users className="h-4 w-4 mr-2" />
            Radius User
          </TabsTrigger>
          <TabsTrigger value="cashback">
            <Coins className="h-4 w-4 mr-2" />
            Cashback
          </TabsTrigger>
          <TabsTrigger value="tag-sync">
            <Tags className="h-4 w-4 mr-2" />
            Tag Sync
          </TabsTrigger>
          <TabsTrigger value="payment-methods">
            <Coins className="h-4 w-4 mr-2" />
            Payment Methods
          </TabsTrigger>
          <TabsTrigger value="logs">
            <FileText className="h-4 w-4 mr-2" />
            Logs
          </TabsTrigger>
          <TabsTrigger value="developer">
            <Code className="h-4 w-4 mr-2" />
            Developer
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <CompanyInfoTab
            currency={currency}
            churnDays={churnDays}
            dateFormat={dateFormat}
            onCurrencyChange={setCurrency}
            onChurnDaysChange={setChurnDays}
            onDateFormatChange={setDateFormat}
            currentWorkspaceId={currentWorkspaceId}
          />
        </TabsContent>

        <TabsContent value="radius-user" className="space-y-4">
          <CompanyInfoTab
            currency={currency}
            churnDays={churnDays}
            dateFormat={dateFormat}
            onCurrencyChange={setCurrency}
            onChurnDaysChange={setChurnDays}
            onDateFormatChange={setDateFormat}
            currentWorkspaceId={currentWorkspaceId}
          />
        </TabsContent>

        <TabsContent value="cashback" className="space-y-4">
          <CashbackTab />
        </TabsContent>

        <TabsContent value="tag-sync" className="space-y-4">
          <TagSyncTab
            currentWorkspaceId={currentWorkspaceId}
            filterColumns={filterColumns}
          />
        </TabsContent>

        <TabsContent value="payment-methods" className="space-y-4">
          <PaymentMethodsTab />
        </TabsContent>

        <TabsContent value="logs" className="space-y-4">
          <LogsTab />
        </TabsContent>

        <TabsContent value="developer" className="space-y-4">
          <DeveloperTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
