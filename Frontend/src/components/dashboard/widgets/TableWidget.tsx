import type { DashboardItem, TableConfig } from '../../../types/dashboard'

interface TableWidgetProps {
  item: DashboardItem
}

export function TableWidget({ item }: TableWidgetProps) {
  const config = item.config as TableConfig

  return (
    <div className="h-full flex flex-col">
      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
      <div className="flex-1 overflow-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-gray-200 dark:border-gray-700">
            <tr>
              {config.columns.map((col) => (
                <th key={col.key} className="text-left p-2 font-medium">
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {config.data.map((row, i) => (
              <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
                {config.columns.map((col) => (
                  <td key={col.key} className="p-2">
                    {row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
