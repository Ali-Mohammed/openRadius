import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { sasRadiusApi } from '@/api/sasRadiusApi'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface TrafficTabProps {
  userId: string
}

export function TrafficTab({ userId }: TrafficTabProps) {
  const { currentWorkspaceId } = useWorkspace()
  const currentDate = new Date()
  const currentMonth = currentDate.getMonth() + 1
  const currentYear = currentDate.getFullYear()

  const [reportType, setReportType] = useState<'daily' | 'monthly'>('daily')
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [selectedYear, setSelectedYear] = useState(currentYear)

  const { data: trafficData, isLoading, error } = useQuery({
    queryKey: ['radius-user-traffic', userId, selectedMonth, selectedYear, reportType],
    queryFn: () => sasRadiusApi.getUserTraffic(currentWorkspaceId, userId, selectedMonth, selectedYear, reportType),
    enabled: !!userId && !!currentWorkspaceId,
  })

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Generate year options (current year and 2 years back)
  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - i)

  // Month names
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ]

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Traffic Usage</CardTitle>
          <CardDescription>Loading traffic data...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Traffic Usage</CardTitle>
          <CardDescription>Error loading traffic data</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-destructive">Failed to load traffic data. Please try again later.</p>
        </CardContent>
      </Card>
    )
  }

  const hasData = trafficData && trafficData.rx.length > 0

  // Prepare chart data
  const chartData = hasData
    ? trafficData.rx.map((_, index) => {
        const period = index + 1
        const rx = trafficData.rx[index] || 0
        const tx = trafficData.tx[index] || 0
        
        return {
          name: reportType === 'daily' ? `Day ${period}` : monthNames[period - 1],
          download: Number((rx / (1024 * 1024 * 1024)).toFixed(2)), // Convert to GB
          upload: Number((tx / (1024 * 1024 * 1024)).toFixed(2)), // Convert to GB
        }
      }).filter(item => item.download > 0 || item.upload > 0)
    : []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Traffic Usage</CardTitle>
        <CardDescription>
          View {reportType} traffic data for user
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters */}
        <div className="grid grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Report Type</Label>
            <Select value={reportType} onValueChange={(value: 'daily' | 'monthly') => setReportType(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Month</Label>
            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((month, index) => (
                  <SelectItem key={index + 1} value={(index + 1).toString()}>
                    {month}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Year</Label>
            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Chart and Table Tabs */}
        {!hasData ? (
          <p className="text-muted-foreground">No traffic data available for this period.</p>
        ) : (
          <Tabs defaultValue="chart" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="chart">Chart View</TabsTrigger>
              <TabsTrigger value="table">Table View</TabsTrigger>
            </TabsList>

            <TabsContent value="chart" className="space-y-4">
              {/* Bar Chart */}
              <div>
                <h3 className="text-sm font-medium mb-2">Traffic Overview (GB)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="download" fill="#3b82f6" name="Download (GB)" />
                    <Bar dataKey="upload" fill="#10b981" name="Upload (GB)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Line Chart */}
              <div>
                <h3 className="text-sm font-medium mb-2">Traffic Trend (GB)</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Line type="monotone" dataKey="download" stroke="#3b82f6" strokeWidth={2} name="Download (GB)" />
                    <Line type="monotone" dataKey="upload" stroke="#10b981" strokeWidth={2} name="Upload (GB)" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </TabsContent>

            <TabsContent value="table">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{reportType === 'daily' ? 'Day' : 'Month'}</TableHead>
                    <TableHead className="text-right">Download (RX)</TableHead>
                    <TableHead className="text-right">Upload (TX)</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">Total Real</TableHead>
                    <TableHead className="text-right">Free Traffic</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trafficData.rx.map((_, index) => {
                    const period = index + 1
                    const rx = trafficData.rx[index] || 0
                    const tx = trafficData.tx[index] || 0
                    const total = trafficData.total[index] || 0
                    const totalReal = trafficData.total_real[index] || 0
                    const freeTraffic = trafficData.free_traffic[index] || 0

                    // Skip periods with no data
                    if (rx === 0 && tx === 0 && total === 0) return null

                    return (
                      <TableRow key={period}>
                        <TableCell className="font-medium">
                          {reportType === 'daily' ? period : monthNames[period - 1]}
                        </TableCell>
                        <TableCell className="text-right">{formatBytes(rx)}</TableCell>
                        <TableCell className="text-right">{formatBytes(tx)}</TableCell>
                        <TableCell className="text-right">{formatBytes(total)}</TableCell>
                        <TableCell className="text-right">{formatBytes(totalReal)}</TableCell>
                        <TableCell className="text-right">{formatBytes(freeTraffic)}</TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  )
}
