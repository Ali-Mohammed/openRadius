import type { GlobalFilter } from '../../types/dashboard'
import { Input } from '../ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { Calendar } from '../ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { CalendarIcon } from 'lucide-react'
import { format } from 'date-fns'

interface GlobalFiltersProps {
  filters: GlobalFilter[]
  onFilterChange: (filterId: string, value: any) => void
}

export function GlobalFilters({ filters, onFilterChange }: GlobalFiltersProps) {
  if (filters.length === 0) return null

  return (
    <div className="flex flex-wrap gap-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
      {filters.map((filter) => (
        <div key={filter.id} className="flex flex-col gap-1.5">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            {filter.label}
          </label>
          {filter.type === 'text' && (
            <Input
              value={filter.value || ''}
              onChange={(e) => onFilterChange(filter.id, e.target.value)}
              placeholder={`Filter by ${filter.label.toLowerCase()}`}
              className="w-48"
            />
          )}
          {filter.type === 'select' && (
            <Select
              value={filter.value}
              onValueChange={(value) => onFilterChange(filter.id, value)}
            >
              <SelectTrigger className="w-48">
                <SelectValue placeholder={`Select ${filter.label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                {filter.options?.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {filter.type === 'date' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-48 justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {filter.value ? format(new Date(filter.value), 'PPP') : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={filter.value ? new Date(filter.value) : undefined}
                  onSelect={(date) => onFilterChange(filter.id, date)}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      ))}
    </div>
  )
}
