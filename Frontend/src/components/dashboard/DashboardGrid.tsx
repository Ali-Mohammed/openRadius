import { useState, useEffect, useRef } from 'react'
import GridLayout from 'react-grid-layout'
import type { Layout } from 'react-grid-layout'
import type { DashboardItem } from '../../types/dashboard'
import { ChartWidget } from './widgets/ChartWidget'
import { TextWidget } from './widgets/TextWidget'
import { MetricWidget } from './widgets/MetricWidget'
import { TableWidget } from './widgets/TableWidget'
import { Button } from '../ui/button'
import { Pencil, Trash2, GripVertical } from 'lucide-react'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

interface DashboardGridProps {
  items: DashboardItem[]
  onLayoutChange?: (items: DashboardItem[]) => void
  onEditItem?: (item: DashboardItem) => void
  onDeleteItem?: (itemId: string) => void
  isEditing?: boolean
}

export function DashboardGrid({
  items,
  onLayoutChange,
  onEditItem,
  onDeleteItem,
  isEditing = false,
}: DashboardGridProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(1200)

  useEffect(() => {
    const updateWidth = () => {
      if (containerRef.current) {
        setWidth(containerRef.current.offsetWidth)
      }
    }
    
    updateWidth()
    window.addEventListener('resize', updateWidth)
    return () => window.removeEventListener('resize', updateWidth)
  }, [])

  const layout: Layout[] = items.map((item) => ({
    i: item.id,
    x: item.layout.x,
    y: item.layout.y,
    w: item.layout.w,
    h: item.layout.h,
  }))

  const handleLayoutChange = (newLayout: Layout[]) => {
    if (onLayoutChange) {
      const updatedItems = items.map((item) => {
        const layoutItem = newLayout.find((l) => l.i === item.id)
        if (layoutItem) {
          return {
            ...item,
            layout: {
              x: layoutItem.x,
              y: layoutItem.y,
              w: layoutItem.w,
              h: layoutItem.h,
            },
          }
        }
        return item
      })
      onLayoutChange(updatedItems)
    }
  }

  const renderWidget = (item: DashboardItem) => {
    switch (item.type) {
      case 'chart':
        return <ChartWidget item={item} />
      case 'text':
        return <TextWidget item={item} />
      case 'metric':
        return <MetricWidget item={item} />
      case 'table':
        return <TableWidget item={item} />
      default:
        return null
    }
  }

  return (
    <div ref={containerRef} style={{ width: '100%' }}>
      <GridLayout
        key={`grid-24-${width}`}
        className={isEditing ? 'layout dashboard-grid-editing' : 'layout'}
        layout={layout}
        cols={24}
        rowHeight={60}
        width={width}
        onLayoutChange={handleLayoutChange}
        isDraggable={isEditing}
        isResizable={isEditing}
        compactType="vertical"
        preventCollision={false}
        resizeHandles={['se', 's', 'e', 'sw', 'ne', 'nw', 'n', 'w']}
        margin={[10, 10]}
        containerPadding={[10, 10]}
      >
        {items.map((item) => (
          <div
            key={item.id}
            className="relative bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm"
          >
            {isEditing && (
              <div className="absolute top-2 right-2 z-10 flex gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0 cursor-move"
                >
                  <GripVertical className="h-4 w-4" />
                </Button>
                {onEditItem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0"
                    onClick={() => onEditItem(item)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                )}
                {onDeleteItem && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                    onClick={() => onDeleteItem(item.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            )}
            <div className="h-full w-full p-4 overflow-auto">{renderWidget(item)}</div>
          </div>
        ))}
      </GridLayout>
    </div>
  )
}
