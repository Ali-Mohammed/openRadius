import { useEffect, useState } from 'react'
import ReactECharts from 'echarts-for-react'
import type { EChartsOption } from 'echarts'
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card'
import { Loader2 } from 'lucide-react'
import { apiClient } from '../../lib/api'
import type { ChartConfig } from '../../types/dashboard'

interface RadiusDashboardWidgetProps {
  title: string
  config: ChartConfig
}

interface DashboardData {
  name: string
  value: number
}

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316']

export function RadiusDashboardWidget({ title, config }: RadiusDashboardWidgetProps) {
  const [data, setData] = useState<DashboardData[] | { value: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchData()
  }, [config])

  const fetchData = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await apiClient.post('/api/dashboard/radius-data', {
        disaggregationField: config.disaggregationField || null,
        aggregationType: config.aggregationType || 'count',
        valueField: config.valueField || null,
        filterGroup: config.filterGroup || null,
      })

      setData(response.data)
    } catch (err) {
      console.error('Error fetching dashboard data:', err)
      setError('Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  const getChartOption = (): EChartsOption => {
    const chartData = Array.isArray(data) ? data : []
    
    const valueLabel = config.aggregationType === 'count' ? 'Count' :
                      config.aggregationType === 'sum' ? `Total ${config.valueField}` :
                      `Average ${config.valueField}`

    switch (config.chartType) {
      case 'bar':
        return {
          tooltip: {
            trigger: 'axis',
            axisPointer: { type: 'shadow' }
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: chartData.map(item => item.name),
            axisLabel: { interval: 0, rotate: 30 }
          },
          yAxis: {
            type: 'value'
          },
          series: [{
            name: valueLabel,
            type: 'bar',
            data: chartData.map(item => item.value),
            itemStyle: {
              color: COLORS[0]
            }
          }]
        }

      case 'line':
        return {
          tooltip: {
            trigger: 'axis'
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: chartData.map(item => item.name),
            boundaryGap: false
          },
          yAxis: {
            type: 'value'
          },
          series: [{
            name: valueLabel,
            type: 'line',
            data: chartData.map(item => item.value),
            smooth: true,
            itemStyle: {
              color: COLORS[0]
            },
            areaStyle: {
              opacity: 0.1
            }
          }]
        }

      case 'area':
        return {
          tooltip: {
            trigger: 'axis'
          },
          grid: {
            left: '3%',
            right: '4%',
            bottom: '3%',
            containLabel: true
          },
          xAxis: {
            type: 'category',
            data: chartData.map(item => item.name),
            boundaryGap: false
          },
          yAxis: {
            type: 'value'
          },
          series: [{
            name: valueLabel,
            type: 'line',
            data: chartData.map(item => item.value),
            smooth: true,
            itemStyle: {
              color: COLORS[0]
            },
            areaStyle: {
              color: COLORS[0],
              opacity: 0.5
            }
          }]
        }

      case 'pie':
      case 'donut':
        return {
          tooltip: {
            trigger: 'item',
            formatter: '{b}: {c} ({d}%)'
          },
          legend: {
            orient: 'vertical',
            left: 'left',
            top: 'middle'
          },
          series: [{
            name: valueLabel,
            type: 'pie',
            radius: config.chartType === 'donut' ? ['40%', '70%'] : '70%',
            center: ['60%', '50%'],
            data: chartData.map((item, index) => ({
              name: item.name,
              value: item.value,
              itemStyle: {
                color: COLORS[index % COLORS.length]
              }
            })),
            label: {
              formatter: '{b}: {d}%'
            },
            emphasis: {
              itemStyle: {
                shadowBlur: 10,
                shadowOffsetX: 0,
                shadowColor: 'rgba(0, 0, 0, 0.5)'
              }
            }
          }]
        }

      default:
        return {}
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <p className="text-sm text-destructive">{error}</p>
        </div>
      </div>
    )
  }

  // Single value display (no disaggregation)
  if (data && 'value' in data && config.chartType === 'number') {
    return (
      <div className="h-full flex flex-col">
        <div className="border-b px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
        <div className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <div className="text-5xl font-bold text-primary">{data.value.toLocaleString()}</div>
            <div className="text-sm text-muted-foreground mt-2">
              {config.aggregationType === 'count' ? 'Total Users' :
               config.aggregationType === 'sum' ? `Total ${config.valueField}` :
               `Average ${config.valueField}`}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Chart display (with disaggregation)
  const chartData = Array.isArray(data) ? data : []

  return (
    <div className="h-full flex flex-col">
      <div className="border-b px-4 py-3">
        <h3 className="text-sm font-semibold">{title}</h3>
      </div>
      <div className="flex-1 px-4 py-2">
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-sm text-muted-foreground">No data available</p>
          </div>
        ) : (
          <ReactECharts 
            option={getChartOption()} 
            style={{ height: '100%', width: '100%' }}
            opts={{ renderer: 'canvas' }}
            notMerge={true}
            lazyUpdate={true}
          />
        )}
      </div>
    </div>
  )
}
