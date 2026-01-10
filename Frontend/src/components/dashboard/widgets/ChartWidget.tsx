import ReactECharts from 'echarts-for-react'
import type { DashboardItem } from '../../../types/dashboard'

interface ChartWidgetProps {
  item: DashboardItem
}

export function ChartWidget({ item }: ChartWidgetProps) {
  const config = item.config as any

  const getChartOption = () => {
    // Sample data - in production, this would come from API
    const sampleData = {
      xAxis: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      series: [120, 200, 150, 80, 70, 110, 130],
    }

    const baseOption = {
      title: {
        text: item.title,
        left: 'center',
        top: 10,
      },
      tooltip: {
        trigger: 'axis',
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '60px',
        containLabel: true,
      },
    }

    switch (config.chartType) {
      case 'line':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: sampleData.xAxis,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: sampleData.series,
              type: 'line',
              smooth: true,
              areaStyle: {},
            },
          ],
        }

      case 'bar':
        return {
          ...baseOption,
          xAxis: {
            type: 'category',
            data: sampleData.xAxis,
          },
          yAxis: {
            type: 'value',
          },
          series: [
            {
              data: sampleData.series,
              type: 'bar',
            },
          ],
        }

      case 'pie':
        return {
          ...baseOption,
          tooltip: {
            trigger: 'item',
          },
          legend: {
            bottom: 10,
          },
          series: [
            {
              name: item.title,
              type: 'pie',
              radius: ['40%', '70%'],
              avoidLabelOverlap: false,
              itemStyle: {
                borderRadius: 10,
                borderColor: '#fff',
                borderWidth: 2,
              },
              label: {
                show: false,
                position: 'center',
              },
              emphasis: {
                label: {
                  show: true,
                  fontSize: 20,
                  fontWeight: 'bold',
                },
              },
              data: sampleData.xAxis.map((name, i) => ({
                value: sampleData.series[i],
                name,
              })),
            },
          ],
        }

      case 'gauge':
        return {
          ...baseOption,
          series: [
            {
              type: 'gauge',
              progress: {
                show: true,
                width: 18,
              },
              axisLine: {
                lineStyle: {
                  width: 18,
                },
              },
              axisTick: {
                show: false,
              },
              splitLine: {
                length: 15,
                lineStyle: {
                  width: 2,
                  color: '#999',
                },
              },
              axisLabel: {
                distance: 25,
                color: '#999',
                fontSize: 12,
              },
              anchor: {
                show: true,
                showAbove: true,
                size: 25,
                itemStyle: {
                  borderWidth: 10,
                },
              },
              detail: {
                valueAnimation: true,
                fontSize: 40,
                offsetCenter: [0, '70%'],
              },
              data: [
                {
                  value: 75,
                },
              ],
            },
          ],
        }

      default:
        return config.options || baseOption
    }
  }

  return (
    <ReactECharts
      option={getChartOption()}
      style={{ height: '100%', width: '100%' }}
      opts={{ renderer: 'svg' }}
    />
  )
}
