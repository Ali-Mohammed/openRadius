import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { RefreshCw } from 'lucide-react'
import ReactECharts from 'echarts-for-react'
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

  const { data: trafficData, isLoading, error, refetch, isFetching } = useQuery({
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
        <CardContent className="space-y-6">
          {/* Filters Skeleton */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-10 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-10 w-full" />
            </div>
          </div>

          {/* Tabs Skeleton */}
          <div className="space-y-4">
            <Skeleton className="h-10 w-full" />
            <div className="space-y-4">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-[350px] w-full" />
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-[350px] w-full" />
            </div>
          </div>
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
  const chartLabels = hasData
    ? trafficData.rx
        .map((rx, index) => {
          const rxNum = Number(rx) || 0
          const txNum = Number(trafficData.tx[index]) || 0
          const period = index + 1
          const label = reportType === 'daily' ? `Day ${period}` : monthNames[period - 1]
          
          // For monthly, show all months. For daily, filter empty days
          if (reportType === 'daily' && rxNum === 0 && txNum === 0) return null
          return label
        })
        .filter(val => val !== null) as string[]
    : []

  const downloadData = hasData
    ? trafficData.rx
        .map((rx, index) => {
          const rxNum = Number(rx) || 0
          const txNum = Number(trafficData.tx[index]) || 0
          // For monthly, show all months. For daily, filter empty days
          if (reportType === 'daily' && rxNum === 0 && txNum === 0) return null
          return Number((rxNum / (1024 * 1024 * 1024)).toFixed(2))
        })
        .filter(val => val !== null) as number[]
    : []

  const uploadData = hasData
    ? trafficData.tx
        .map((tx, index) => {
          const txNum = Number(tx) || 0
          const rxNum = Number(trafficData.rx[index]) || 0
          // For monthly, show all months. For daily, filter empty days
          if (reportType === 'daily' && rxNum === 0 && txNum === 0) return null
          return Number((txNum / (1024 * 1024 * 1024)).toFixed(2))
        })
        .filter(val => val !== null) as number[]
    : []

  // Bar Chart Options
  const barChartOptions = {
    tooltip: {
      trigger: 'axis',
      axisPointer: {
        type: 'shadow'
      },
      formatter: (params: any) => {
        let result = `<strong>${params[0].axisValue}</strong><br/>`
        params.forEach((param: any) => {
          result += `${param.marker} ${param.seriesName}: <strong>${param.value} GB</strong><br/>`
        })
        return result
      }
    },
    legend: {
      data: ['Download', 'Upload'],
      top: 0,
      textStyle: {
        fontSize: 12
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    toolbox: {
      feature: {
        saveAsImage: { title: 'Save' },
        dataZoom: { title: { zoom: 'Zoom', back: 'Reset' } },
        restore: { title: 'Restore' }
      },
      right: 20
    },
    dataZoom: [
      {
        type: 'slider',
        show: chartLabels.length > 10,
        start: 0,
        end: 100,
        height: 20,
        bottom: 5
      }
    ],
    xAxis: {
      type: 'category',
      data: chartLabels,
      axisLabel: {
        rotate: chartLabels.length > 15 ? 45 : 0,
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: 'Traffic (GB)',
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: {
        formatter: '{value} GB'
      }
    },
    series: [
      {
        name: 'Download',
        type: 'bar',
        data: downloadData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#60a5fa' },
              { offset: 1, color: '#3b82f6' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: '#2563eb'
          }
        }
      },
      {
        name: 'Upload',
        type: 'bar',
        data: uploadData,
        itemStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: '#34d399' },
              { offset: 1, color: '#10b981' }
            ]
          },
          borderRadius: [4, 4, 0, 0]
        },
        emphasis: {
          itemStyle: {
            color: '#059669'
          }
        }
      }
    ],
    animationDuration: 1000,
    animationEasing: 'cubicOut'
  }

  // Line Chart Options
  const lineChartOptions = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        let result = `<strong>${params[0].axisValue}</strong><br/>`
        params.forEach((param: any) => {
          result += `${param.marker} ${param.seriesName}: <strong>${param.value} GB</strong><br/>`
        })
        return result
      }
    },
    legend: {
      data: ['Download', 'Upload'],
      top: 0,
      textStyle: {
        fontSize: 12
      }
    },
    grid: {
      left: '3%',
      right: '4%',
      bottom: '10%',
      top: '15%',
      containLabel: true
    },
    toolbox: {
      feature: {
        saveAsImage: { title: 'Save' },
        dataZoom: { title: { zoom: 'Zoom', back: 'Reset' } },
        restore: { title: 'Restore' }
      },
      right: 20
    },
    dataZoom: [
      {
        type: 'slider',
        show: chartLabels.length > 10,
        start: 0,
        end: 100,
        height: 20,
        bottom: 5
      }
    ],
    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: chartLabels,
      axisLabel: {
        rotate: chartLabels.length > 15 ? 45 : 0,
        fontSize: 11
      }
    },
    yAxis: {
      type: 'value',
      name: 'Traffic (GB)',
      nameLocation: 'middle',
      nameGap: 50,
      axisLabel: {
        formatter: '{value} GB'
      }
    },
    series: [
      {
        name: 'Download',
        type: 'line',
        smooth: true,
        data: downloadData,
        lineStyle: {
          color: '#3b82f6',
          width: 3
        },
        itemStyle: {
          color: '#3b82f6'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(59, 130, 246, 0.3)' },
              { offset: 1, color: 'rgba(59, 130, 246, 0.05)' }
            ]
          }
        },
        emphasis: {
          focus: 'series'
        }
      },
      {
        name: 'Upload',
        type: 'line',
        smooth: true,
        data: uploadData,
        lineStyle: {
          color: '#10b981',
          width: 3
        },
        itemStyle: {
          color: '#10b981'
        },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(16, 185, 129, 0.3)' },
              { offset: 1, color: 'rgba(16, 185, 129, 0.05)' }
            ]
          }
        },
        emphasis: {
          focus: 'series'
        }
      }
    ],
    animationDuration: 1000,
    animationEasing: 'cubicOut'
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle>Traffic Usage</CardTitle>
            <CardDescription>
              View {reportType} traffic data for user
            </CardDescription>
          </div>
          
          {/* Filters */}
          <div className="flex items-center gap-2">
            <Select value={reportType} onValueChange={(value: 'daily' | 'monthly') => setReportType(value)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily">Daily</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedMonth.toString()} onValueChange={(value) => setSelectedMonth(Number(value))}>
              <SelectTrigger className="w-[120px]">
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

            <Select value={selectedYear.toString()} onValueChange={(value) => setSelectedYear(Number(value))}>
              <SelectTrigger className="w-[100px]">
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

            <Button
              variant="outline"
              size="icon"
              onClick={() => refetch()}
              disabled={isFetching}
            >
              <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
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
                <h3 className="text-sm font-medium mb-2">Traffic Overview</h3>
                <ReactECharts 
                  option={barChartOptions} 
                  style={{ height: '350px' }}
                  opts={{ renderer: 'svg' }}
                />
              </div>

              {/* Line Chart */}
              <div>
                <h3 className="text-sm font-medium mb-2">Traffic Trend</h3>
                <ReactECharts 
                  option={lineChartOptions} 
                  style={{ height: '350px' }}
                  opts={{ renderer: 'svg' }}
                />
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
                    const rx = Number(trafficData.rx[index]) || 0
                    const tx = Number(trafficData.tx[index]) || 0
                    const total = Number(trafficData.total[index]) || 0
                    const totalReal = Number(trafficData.total_real[index]) || 0
                    const freeTraffic = Number(trafficData.free_traffic[index]) || 0

                    // Skip periods with no data (only for daily)
                    if (reportType === 'daily' && rx === 0 && tx === 0 && total === 0) return null

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
