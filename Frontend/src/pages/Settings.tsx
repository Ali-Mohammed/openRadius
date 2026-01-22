import { useTranslation } from 'react-i18next'
import { useTheme } from '../contexts/ThemeContext'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Label } from '../components/ui/label'
import { RadioGroup, RadioGroupItem } from '../components/ui/radio-group'
import { Button } from '../components/ui/button'
import { Progress } from '../components/ui/progress'
import { Moon, Sun, Palette, Layout, Tags, Loader2 } from 'lucide-react'
import { useState } from 'react'
import * as signalR from '@microsoft/signalr'
import { toast } from 'sonner'
import { apiClient } from '../lib/api'

interface TagSyncProgress {
  phase: string
  current: number
  total: number
  percentComplete: number
  message: string
}

export default function Settings() {
  const { t, i18n } = useTranslation()
  const { theme, toggleTheme, primaryColor, setPrimaryColor, layout, setLayout } = useTheme()
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState<TagSyncProgress | null>(null)

  const handleSyncTags = async () => {
    let connection: signalR.HubConnection | null = null
    
    try {
      setIsSyncing(true)
      setSyncProgress({
        phase: 'Starting',
        current: 0,
        total: 0,
        percentComplete: 0,
        message: 'Initializing tag sync...'
      })

      // Connect to SignalR hub for progress updates
      connection = new signalR.HubConnectionBuilder()
        .withUrl(`${import.meta.env.VITE_API_URL}/hubs/tagsync`)
        .withAutomaticReconnect()
        .build()

      connection.on('TagSyncProgress', (progress: TagSyncProgress) => {
        setSyncProgress(progress)
      })

      connection.on('TagSyncError', (error: { message: string }) => {
        toast.error(`Tag Sync Error: ${error.message}`)
      })

      await connection.start()

      const response = await apiClient.post('/api/radius/tags/sync')
      
      toast.success(`Tag Sync Complete: Processed ${response.data.usersProcessed} users. Assigned ${response.data.tagsAssigned} tags, removed ${response.data.tagsRemoved} tags.`)
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync tags')
    } finally {
      if (connection) {
        await connection.stop()
      }
      setIsSyncing(false)
      setSyncProgress(null)
    }
  }

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('language', lng)
    document.documentElement.dir = lng === 'ar' ? 'rtl' : 'ltr'
    document.documentElement.lang = lng
  }

  const colors = [
    { value: 'blue', label: 'Blue', class: 'bg-blue-500' },
    { value: 'green', label: 'Green', class: 'bg-green-500' },
    { value: 'purple', label: 'Purple', class: 'bg-purple-500' },
    { value: 'orange', label: 'Orange', class: 'bg-orange-500' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your application preferences</p>
      </div>

      <div className="grid gap-6">
        {/* Theme Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              {theme === 'dark' ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
              Theme
            </CardTitle>
            <CardDescription>Choose your preferred theme</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={theme} onValueChange={toggleTheme}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="light" id="light" />
                <Label htmlFor="light" className="flex items-center gap-2 cursor-pointer">
                  <Sun className="h-4 w-4" />
                  Light
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="dark" id="dark" />
                <Label htmlFor="dark" className="flex items-center gap-2 cursor-pointer">
                  <Moon className="h-4 w-4" />
                  Dark
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Primary Color */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Primary Color
            </CardTitle>
            <CardDescription>Choose your accent color</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={primaryColor} onValueChange={setPrimaryColor}>
              {colors.map((color) => (
                <div key={color.value} className="flex items-center space-x-2">
                  <RadioGroupItem value={color.value} id={color.value} />
                  <Label htmlFor={color.value} className="flex items-center gap-2 cursor-pointer">
                    <div className={`h-4 w-4 rounded-full ${color.class}`} />
                    {color.label}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Layout Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layout className="h-5 w-5" />
              Layout
            </CardTitle>
            <CardDescription>Choose your preferred layout style</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={layout} onValueChange={setLayout}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="full-width" id="full-width" />
                <Label htmlFor="full-width" className="cursor-pointer">Full Width</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="boxed" id="boxed" />
                <Label htmlFor="boxed" className="cursor-pointer">Boxed</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Language</CardTitle>
            <CardDescription>Choose your preferred language</CardDescription>
          </CardHeader>
          <CardContent>
            <RadioGroup value={i18n.language} onValueChange={changeLanguage}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="en" id="en" />
                <Label htmlFor="en" className="cursor-pointer">English</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="ar" id="ar" />
                <Label htmlFor="ar" className="cursor-pointer">العربية</Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Tag Sync */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tags className="h-5 w-5" />
              RADIUS Tag Sync
            </CardTitle>
            <CardDescription>
              Auto-assign tags to users based on their created date and expiration status
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                This will automatically assign tags like "New User", "Active", "Expired", and "Expiring Soon" 
                based on user creation dates and expiration status.
              </p>
              {syncProgress && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>{syncProgress.message}</span>
                    <span className="font-medium">{syncProgress.percentComplete}%</span>
                  </div>
                  <Progress value={syncProgress.percentComplete} className="h-2" />
                </div>
              )}
            </div>
            <Button 
              onClick={handleSyncTags} 
              disabled={isSyncing}
              className="w-full sm:w-auto"
            >
              {isSyncing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Syncing Tags...
                </>
              ) : (
                <>
                  <Tags className="mr-2 h-4 w-4" />
                  Sync Tags
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
