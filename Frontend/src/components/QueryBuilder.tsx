import { useState, useCallback, useMemo, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'
import { 
  Filter, Plus, X, Trash2, ChevronDown, Check, 
  Type, Hash, Calendar, ToggleLeft, List, AtSign,
  Copy, Parentheses, ArrowUp, ArrowDown
} from 'lucide-react'

// Filter condition types
export type FilterOperator = 
  | 'equals' | 'not_equals' 
  | 'contains' | 'not_contains' | 'starts_with' | 'ends_with'
  | 'is_empty' | 'is_not_empty'
  | 'greater_than' | 'less_than' | 'greater_equal' | 'less_equal'
  | 'between'
  | 'in' | 'not_in'
  | 'is_true' | 'is_false'
  | 'before' | 'after' | 'on_or_before' | 'on_or_after'

export type FilterLogic = 'and' | 'or'

export type ColumnType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'email' | 'array'

export interface FilterColumnOption {
  value: string
  label: string
  color?: string
  icon?: string
}

export interface FilterColumn {
  key: string
  label: string
  type: ColumnType
  options?: FilterColumnOption[]  // For select type
  suggestions?: string[]  // Dynamic suggestions
}

export interface FilterCondition {
  id: string
  column: string
  operator: FilterOperator
  value: string | string[] | number | boolean | null
  value2?: string | number | null  // For between operator
}

export interface FilterGroup {
  id: string
  logic: FilterLogic
  conditions: (FilterCondition | FilterGroup)[]
}

export interface SuggestionItem {
  value: string
  label: string
  color?: string
  icon?: string
}

export interface QueryBuilderProps {
  columns: FilterColumn[]
  value?: FilterGroup | null
  onChange?: (filters: FilterGroup | null) => void
  onApply?: (filters: FilterGroup | null) => void
  onFetchSuggestions?: (field: string, search?: string) => Promise<string[] | SuggestionItem[]>
  className?: string
  maxDepth?: number  // Maximum nesting depth for groups
  showGrouping?: boolean  // Allow creating nested groups
  placeholder?: string
  showLabel?: boolean  // Show "Filter" text label
}

// Operator definitions by column type
const operatorsByType: Record<ColumnType, { value: FilterOperator; label: string; icon?: React.ReactNode }[]> = {
  text: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'starts_with', label: 'starts with' },
    { value: 'ends_with', label: 'ends with' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  email: [
    { value: 'equals', label: 'equals' },
    { value: 'not_equals', label: 'does not equal' },
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  number: [
    { value: 'equals', label: '=' },
    { value: 'not_equals', label: '≠' },
    { value: 'greater_than', label: '>' },
    { value: 'less_than', label: '<' },
    { value: 'greater_equal', label: '≥' },
    { value: 'less_equal', label: '≤' },
    { value: 'between', label: 'between' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  boolean: [
    { value: 'is_true', label: 'is checked' },
    { value: 'is_false', label: 'is not checked' },
  ],
  date: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'before', label: 'is before' },
    { value: 'after', label: 'is after' },
    { value: 'on_or_before', label: 'is on or before' },
    { value: 'on_or_after', label: 'is on or after' },
    { value: 'between', label: 'is between' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  select: [
    { value: 'equals', label: 'is' },
    { value: 'not_equals', label: 'is not' },
    { value: 'in', label: 'is any of' },
    { value: 'not_in', label: 'is none of' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
  array: [
    { value: 'contains', label: 'contains' },
    { value: 'not_contains', label: 'does not contain' },
    { value: 'is_empty', label: 'is empty' },
    { value: 'is_not_empty', label: 'is not empty' },
  ],
}

// Column type icons
const typeIcons: Record<ColumnType, React.ReactNode> = {
  text: <Type className="h-3.5 w-3.5" />,
  number: <Hash className="h-3.5 w-3.5" />,
  boolean: <ToggleLeft className="h-3.5 w-3.5" />,
  date: <Calendar className="h-3.5 w-3.5" />,
  select: <List className="h-3.5 w-3.5" />,
  email: <AtSign className="h-3.5 w-3.5" />,
  array: <List className="h-3.5 w-3.5" />,
}

// Relative date options
const relativeDateOptions = [
  { value: 'now', label: 'Now' },
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'tomorrow', label: 'Tomorrow' },
  { value: '7_days_ago', label: '7 days ago' },
  { value: '30_days_ago', label: '30 days ago' },
  { value: '90_days_ago', label: '90 days ago' },
  { value: '1_year_ago', label: '1 year ago' },
  { value: '7_days_from_now', label: '7 days from now' },
  { value: '30_days_from_now', label: '30 days from now' },
  { value: '90_days_from_now', label: '90 days from now' },
  { value: '1_year_from_now', label: '1 year from now' },
  { value: 'start_of_month', label: 'Start of this month' },
  { value: 'end_of_month', label: 'End of this month' },
  { value: 'start_of_year', label: 'Start of this year' },
  { value: 'end_of_year', label: 'End of this year' },
]

// Generate unique ID
const generateId = () => Math.random().toString(36).substring(2, 9)

// Check if operator requires no value
const isNoValueOperator = (operator: FilterOperator) => 
  ['is_empty', 'is_not_empty', 'is_true', 'is_false'].includes(operator)

// Check if operator requires two values (between)
const isBetweenOperator = (operator: FilterOperator) => operator === 'between'

// Check if operator requires multiple values (in, not_in, equals, not_equals with select/suggestions)
const isMultiValueOperator = (operator: FilterOperator) => ['in', 'not_in'].includes(operator)

// Check if operator supports both single and multiple value selection
const isFlexibleValueOperator = (operator: FilterOperator) => ['equals', 'not_equals', 'in', 'not_in'].includes(operator)

interface ConditionRowProps {
  condition: FilterCondition
  columns: FilterColumn[]
  onChange: (condition: FilterCondition) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  canMoveUp: boolean
  canMoveDown: boolean
  isFirst: boolean
  logic: FilterLogic
  onLogicChange?: (logic: FilterLogic) => void
  onFetchSuggestions?: (field: string, search?: string) => Promise<string[] | SuggestionItem[]>
}

function ConditionRow({ 
  condition, 
  columns, 
  onChange, 
  onRemove, 
  onDuplicate,
  onMoveUp,
  onMoveDown,
  canMoveUp,
  canMoveDown,
  isFirst,
  logic,
  onLogicChange,
  onFetchSuggestions
}: ConditionRowProps) {
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [dynamicSuggestions, setDynamicSuggestions] = useState<(string | SuggestionItem)[]>([])
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const selectedColumn = columns.find(c => c.key === condition.column)
  const columnType = selectedColumn?.type || 'text'
  const operators = operatorsByType[columnType] || operatorsByType.text
  const suggestions = selectedColumn?.suggestions || []
  const selectOptions = selectedColumn?.options || []

  const handleColumnChange = (columnKey: string) => {
    const newColumn = columns.find(c => c.key === columnKey)
    const newType = newColumn?.type || 'text'
    const newOperators = operatorsByType[newType]
    const defaultOperator = newOperators[0]?.value || 'equals'
    
    onChange({
      ...condition,
      column: columnKey,
      operator: defaultOperator,
      value: null,
      value2: null,
    })
  }

  const handleOperatorChange = (operator: FilterOperator) => {
    onChange({
      ...condition,
      operator,
      value: isNoValueOperator(operator) ? null : condition.value,
      value2: isBetweenOperator(operator) ? condition.value2 : null,
    })
  }

  const handleValueChange = (value: string | string[] | number | boolean | null) => {
    onChange({ ...condition, value })
  }

  const handleValue2Change = (value2: string | number | null) => {
    onChange({ ...condition, value2 })
  }

  // Fetch suggestions when input changes or focus
  const fetchSuggestions = useCallback(async (searchValue?: string) => {
    if (!onFetchSuggestions || !condition.column) return
    
    // Only fetch for text-like columns with contains operator
    if (columnType !== 'text' && columnType !== 'email') return
    if (!['contains', 'equals', 'starts_with', 'ends_with'].includes(condition.operator)) return
    
    setIsLoadingSuggestions(true)
    try {
      const result = await onFetchSuggestions(condition.column, searchValue)
      setDynamicSuggestions(result)
    } catch (error) {
      console.error('Failed to fetch suggestions:', error)
    } finally {
      setIsLoadingSuggestions(false)
    }
  }, [onFetchSuggestions, condition.column, condition.operator, columnType])

  // Debounced fetch when value changes
  useEffect(() => {
    if (!showSuggestions || !onFetchSuggestions) return
    
    const timer = setTimeout(() => {
      fetchSuggestions(condition.value as string)
    }, 300)
    
    return () => clearTimeout(timer)
  }, [condition.value, showSuggestions, fetchSuggestions, onFetchSuggestions])

  const allSuggestions = useMemo(() => {
    // Combine static and dynamic suggestions
    const staticSuggs = suggestions || []
    const combined = [...dynamicSuggestions]
    
    // Add static suggestions that aren't in dynamic
    staticSuggs.forEach(s => {
      const sValue = typeof s === 'string' ? s : s
      if (!combined.some(d => (typeof d === 'string' ? d : (d as SuggestionItem).value) === sValue)) {
        combined.push(s)
      }
    })
    
    // Filter by current value
    if (!condition.value || typeof condition.value !== 'string') return combined.slice(0, 10)
    
    const searchValue = condition.value.toLowerCase()
    return combined.filter(s => {
      const val = typeof s === 'string' ? s : (s as SuggestionItem).label || (s as SuggestionItem).value
      return val.toLowerCase().includes(searchValue)
    }).slice(0, 10)
  }, [suggestions, dynamicSuggestions, condition.value])

  const renderValueInput = () => {
    if (isNoValueOperator(condition.operator)) {
      return null
    }

    if (columnType === 'boolean') {
      return null
    }

    // For select type with equals/not_equals or any flexible operator, show multi-select
    const hasSelectOptions = selectOptions.length > 0
    const shouldShowMultiSelect = (isMultiValueOperator(condition.operator) || 
      (isFlexibleValueOperator(condition.operator) && hasSelectOptions) || 
      columnType === 'array' || 
      columnType === 'select')

    if (shouldShowMultiSelect && hasSelectOptions) {
      const selectedValues = Array.isArray(condition.value) 
        ? condition.value 
        : (condition.value ? [condition.value as string] : [])
      return (
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs justify-start min-w-36">
              {selectedValues.length > 0 ? (
                <span className="truncate">{selectedValues.length} selected</span>
              ) : (
                <span className="text-muted-foreground">Select values...</span>
              )}
              <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-52 p-0 z-[9999]" align="start">
            <Command>
              <CommandInput placeholder="Search..." className="h-8 text-xs" />
              <CommandList>
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup>
                  {selectOptions.map(option => (
                    <CommandItem
                      key={option.value}
                      onSelect={() => {
                        const newValues = selectedValues.includes(option.value)
                          ? selectedValues.filter(v => v !== option.value)
                          : [...selectedValues, option.value]
                        handleValueChange(newValues)
                      }}
                    >
                      <div className={cn(
                        "mr-2 flex h-4 w-4 items-center justify-center rounded-sm border border-primary",
                        selectedValues.includes(option.value) ? "bg-primary text-primary-foreground" : "opacity-50"
                      )}>
                        {selectedValues.includes(option.value) && <Check className="h-3 w-3" />}
                      </div>
                      {option.color && (
                        <div 
                          className="mr-2 h-3 w-3 rounded-full shrink-0" 
                          style={{ backgroundColor: option.color }} 
                        />
                      )}
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      )
    }

    // Text/Number/Date input with suggestions
    const hasSuggestions = allSuggestions.length > 0 || isLoadingSuggestions
    const inputRect = inputRef.current?.getBoundingClientRect()
    
    // For date fields, add relative date options to suggestions
    const dateSuggestions = columnType === 'date' 
      ? [...relativeDateOptions.map(opt => ({ value: opt.value, label: opt.label })), ...allSuggestions]
      : allSuggestions
    
    const hasDateSuggestions = columnType === 'date' ? true : hasSuggestions
    
    return (
      <div className="relative">
        <Input
          ref={inputRef}
          type={columnType === 'number' ? 'number' : 'text'}
          value={condition.value as string || ''}
          onChange={(e) => handleValueChange(columnType === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          onFocus={() => {
            setShowSuggestions(true)
            if (onFetchSuggestions && dynamicSuggestions.length === 0) {
              fetchSuggestions(condition.value as string)
            }
          }}
          onBlur={() => setTimeout(() => setShowSuggestions(false), 300)}
          placeholder={columnType === 'date' ? 'Type or select date...' : 'Enter value...'}
          className={`h-8 text-xs ${columnType === 'date' ? 'w-[180px]' : 'w-36'}`}
        />
        {showSuggestions && hasDateSuggestions && inputRect && createPortal(
          <div 
            className="fixed bg-popover border rounded-md shadow-md max-h-52 overflow-auto"
            style={{
              top: inputRect.bottom + 4,
              left: inputRect.left,
              width: columnType === 'date' ? 200 : inputRect.width,
              zIndex: 99999,
            }}
          >
            {columnType === 'date' && relativeDateOptions.length > 0 && (
              <>
                <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b">
                  Relative Dates
                </div>
                {relativeDateOptions.map((option, idx) => (
                  <button
                    key={`rel-${idx}`}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent truncate flex items-center gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      console.log('Selected relative date:', option.value, option.label)
                      handleValueChange(option.value)
                      setTimeout(() => setShowSuggestions(false), 0)
                    }}
                  >
                    <Calendar className="h-3 w-3 text-muted-foreground" />
                    {option.label}
                  </button>
                ))}
                {allSuggestions.length > 0 && (
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-t border-b">
                    Suggestions
                  </div>
                )}
              </>
            )}
            {isLoadingSuggestions ? (
              <div className="px-3 py-2 text-xs text-muted-foreground">Loading...</div>
            ) : (
              allSuggestions.map((suggestion, idx) => {
                const suggestionValue = typeof suggestion === 'string' ? suggestion : (suggestion as SuggestionItem).value
                const suggestionLabel = typeof suggestion === 'string' ? suggestion : (suggestion as SuggestionItem).label || (suggestion as SuggestionItem).value
                const suggestionColor = typeof suggestion !== 'string' ? (suggestion as SuggestionItem).color : undefined
                return (
                  <button
                    key={idx}
                    className="w-full px-3 py-1.5 text-xs text-left hover:bg-accent truncate flex items-center gap-2"
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      handleValueChange(suggestionValue)
                      setTimeout(() => setShowSuggestions(false), 0)
                    }}
                  >
                    {suggestionColor && (
                      <div 
                        className="h-2.5 w-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: suggestionColor }} 
                      />
                    )}
                    {suggestionLabel}
                  </button>
                )
              })
            )}
          </div>,
          document.body
        )}
      </div>
    )
  }

  const renderValue2Input = () => {
    if (!isBetweenOperator(condition.operator)) return null

    return (
      <>
        <span className="text-xs text-muted-foreground px-1">and</span>
        <Input
          type={columnType === 'number' ? 'number' : 'text'}
          value={condition.value2 as string || ''}
          onChange={(e) => handleValue2Change(columnType === 'number' ? (e.target.value ? Number(e.target.value) : null) : e.target.value)}
          placeholder={columnType === 'date' ? 'Type or select date...' : 'End value...'}
          className={`h-8 text-xs ${columnType === 'date' ? 'w-[180px]' : 'w-36'}`}
        />
      </>
    )
  }

  return (
    <div className="flex items-center gap-2 group py-1.5 px-2 rounded-md hover:bg-muted/50 transition-colors">
      {/* Logic selector (AND/OR) */}
      <div className="w-[60px] flex-shrink-0">
        {isFirst ? (
          <span className="text-xs text-muted-foreground pl-2">Where</span>
        ) : (
          <Select value={logic} onValueChange={(value) => onLogicChange?.(value as FilterLogic)}>
            <SelectTrigger className="h-7 w-[56px] text-xs border-dashed">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[9999]">
              <SelectItem value="and">AND</SelectItem>
              <SelectItem value="or">OR</SelectItem>
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Column selector */}
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 w-[150px] justify-start text-xs">
            {selectedColumn && (
              <span className="mr-1.5 text-muted-foreground">{typeIcons[columnType]}</span>
            )}
            <span className="truncate">{selectedColumn?.label || 'Select field...'}</span>
            <ChevronDown className="ml-auto h-3 w-3 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[220px] p-0 z-[9999]" align="start">
          <Command>
            <CommandInput placeholder="Search fields..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty>No field found.</CommandEmpty>
              <CommandGroup>
                {columns.map(col => (
                  <CommandItem
                    key={col.key}
                    value={col.label}
                    onSelect={() => handleColumnChange(col.key)}
                    className="text-xs"
                  >
                    <span className="mr-2 text-muted-foreground">{typeIcons[col.type]}</span>
                    {col.label}
                    {condition.column === col.key && (
                      <Check className="ml-auto h-3 w-3" />
                    )}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {/* Operator selector */}
      <Select value={condition.operator} onValueChange={handleOperatorChange}>
        <SelectTrigger className="h-8 w-[150px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="z-[9999]">
          {operators.map(op => (
            <SelectItem key={op.value} value={op.value} className="text-xs">
              {op.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Value input */}
      {renderValueInput()}
      {renderValue2Input()}

      {/* Actions */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={onMoveUp}
          disabled={!canMoveUp}
          title="Move up"
        >
          <ArrowUp className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={onMoveDown}
          disabled={!canMoveDown}
          title="Move down"
        >
          <ArrowDown className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6"
          onClick={onDuplicate}
          title="Duplicate"
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={onRemove}
          title="Remove"
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </div>
  )
}

export function QueryBuilder({
  columns,
  value,
  onChange,
  onApply,
  onFetchSuggestions,
  className,
  maxDepth: _maxDepth = 2,
  showGrouping = true,
  placeholder = "No filters applied",
  showLabel = true
}: QueryBuilderProps) {
  // maxDepth can be used for nested group depth limiting
  void _maxDepth
  const [isOpen, setIsOpen] = useState(false)
  const [filters, setFilters] = useState<FilterGroup>(() => value || {
    id: generateId(),
    logic: 'and',
    conditions: []
  })

  // Sync external value changes
  useEffect(() => {
    if (value) {
      setFilters(value)
    }
  }, [value])

  const activeFilterCount = useMemo(() => {
    const countConditions = (group: FilterGroup): number => {
      return group.conditions.reduce((count, item) => {
        if ('conditions' in item) {
          return count + countConditions(item)
        }
        return count + 1
      }, 0)
    }
    return countConditions(filters)
  }, [filters])

  const handleAddCondition = useCallback(() => {
    const defaultColumn = columns[0]
    const defaultType = defaultColumn?.type || 'text'
    const defaultOperator = operatorsByType[defaultType][0]?.value || 'equals'
    
    const newCondition: FilterCondition = {
      id: generateId(),
      column: defaultColumn?.key || '',
      operator: defaultOperator,
      value: null,
    }

    const newFilters = {
      ...filters,
      conditions: [...filters.conditions, newCondition]
    }
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [columns, filters, onChange])

  const handleAddGroup = useCallback(() => {
    const newGroup: FilterGroup = {
      id: generateId(),
      logic: 'and',
      conditions: []
    }

    const newFilters = {
      ...filters,
      conditions: [...filters.conditions, newGroup]
    }
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleUpdateCondition = useCallback((conditionId: string, updated: FilterCondition) => {
    const updateInGroup = (group: FilterGroup): FilterGroup => ({
      ...group,
      conditions: group.conditions.map(item => {
        if ('conditions' in item) {
          return updateInGroup(item)
        }
        if (item.id === conditionId) {
          return updated
        }
        return item
      })
    })

    const newFilters = updateInGroup(filters)
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleRemoveCondition = useCallback((conditionId: string) => {
    const removeFromGroup = (group: FilterGroup): FilterGroup => ({
      ...group,
      conditions: group.conditions
        .filter(item => {
          if ('conditions' in item) {
            return true // Keep groups, will clean empty ones later
          }
          return item.id !== conditionId
        })
        .map(item => {
          if ('conditions' in item) {
            return removeFromGroup(item)
          }
          return item
        })
        .filter(item => {
          if ('conditions' in item) {
            return item.conditions.length > 0 // Remove empty groups
          }
          return true
        })
    })

    const newFilters = removeFromGroup(filters)
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleDuplicateCondition = useCallback((condition: FilterCondition) => {
    const newCondition: FilterCondition = {
      ...condition,
      id: generateId(),
    }

    const newFilters = {
      ...filters,
      conditions: [...filters.conditions, newCondition]
    }
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleMoveCondition = useCallback((id: string, direction: 'up' | 'down') => {
    const moveInGroup = (group: FilterGroup): FilterGroup => {
      const index = group.conditions.findIndex(c => c.id === id)
      if (index !== -1) {
        const newConditions = [...group.conditions]
        const newIndex = direction === 'up' ? index - 1 : index + 1
        if (newIndex >= 0 && newIndex < newConditions.length) {
          [newConditions[index], newConditions[newIndex]] = [newConditions[newIndex], newConditions[index]]
        }
        return { ...group, conditions: newConditions }
      }
      // Search in nested groups
      return {
        ...group,
        conditions: group.conditions.map(item => {
          if ('conditions' in item) {
            return moveInGroup(item)
          }
          return item
        })
      }
    }

    const newFilters = moveInGroup(filters)
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleLogicChange = useCallback((logic: FilterLogic) => {
    const newFilters = { ...filters, logic }
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters, onChange])

  const handleClearAll = useCallback(() => {
    const newFilters: FilterGroup = {
      id: filters.id,
      logic: 'and',
      conditions: []
    }
    setFilters(newFilters)
    onChange?.(newFilters)
  }, [filters.id, onChange])

  const handleApply = useCallback(() => {
    onApply?.(filters)
    setIsOpen(false)
  }, [filters, onApply])

  const renderConditions = (group: FilterGroup, depth: number = 0) => {
    return (
      <div className={cn(
        "space-y-1",
        depth > 0 && "ml-4 pl-3 border-l-2 border-dashed border-muted-foreground/30"
      )}>
        {group.conditions.map((item, index) => {
          if ('conditions' in item) {
            // Render nested group
            return (
              <div key={item.id} className="py-2">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className="text-xs">
                    <Parentheses className="h-3 w-3 mr-1" />
                    Group
                  </Badge>
                  <Select 
                    value={item.logic} 
                    onValueChange={(value) => {
                      const updateGroup = (g: FilterGroup): FilterGroup => ({
                        ...g,
                        conditions: g.conditions.map(c => {
                          if ('conditions' in c && c.id === item.id) {
                            return { ...c, logic: value as FilterLogic }
                          }
                          if ('conditions' in c) {
                            return updateGroup(c)
                          }
                          return c
                        })
                      })
                      const newFilters = updateGroup(filters)
                      setFilters(newFilters)
                      onChange?.(newFilters)
                    }}
                  >
                    <SelectTrigger className="h-6 w-[60px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="z-[9999]">
                      <SelectItem value="and">AND</SelectItem>
                      <SelectItem value="or">OR</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive hover:text-destructive"
                    onClick={() => handleRemoveCondition(item.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
                {renderConditions(item, depth + 1)}
              </div>
            )
          }

          // Render condition row
          return (
            <ConditionRow
              key={item.id}
              condition={item}
              columns={columns}
              onChange={(updated) => handleUpdateCondition(item.id, updated)}
              onRemove={() => handleRemoveCondition(item.id)}
              onDuplicate={() => handleDuplicateCondition(item)}
              onMoveUp={() => handleMoveCondition(item.id, 'up')}
              onMoveDown={() => handleMoveCondition(item.id, 'down')}
              canMoveUp={index > 0}
              canMoveDown={index < group.conditions.length - 1}
              isFirst={index === 0}
              logic={group.logic}
              onLogicChange={index === 1 ? handleLogicChange : undefined}
              onFetchSuggestions={onFetchSuggestions}
            />
          )
        })}
      </div>
    )
  }

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="sm" 
          className={cn(
            "h-9",
            showLabel && "gap-2",
            activeFilterCount > 0 && "border-primary text-primary",
            className
          )}
        >
          <Filter className="h-4 w-4" />
          {showLabel && <span>Filter</span>}
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="h-5 px-1.5 text-xs font-medium">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto min-w-[500px] max-w-[90vw] p-0" 
        align="center"
        sideOffset={8}
      >
        <div className="p-3 border-b bg-muted/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <span className="font-medium text-sm">Filters</span>
              {activeFilterCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {activeFilterCount} {activeFilterCount === 1 ? 'rule' : 'rules'}
                </Badge>
              )}
            </div>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-muted-foreground hover:text-foreground"
                onClick={handleClearAll}
              >
                Clear all
              </Button>
            )}
          </div>
        </div>

        <div className="p-3 max-h-[400px] overflow-auto">
          <div className="min-w-fit">
          {filters.conditions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Filter className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">{placeholder}</p>
              <p className="text-xs mt-1">Click "Add filter" to create your first rule</p>
            </div>
          ) : (
            renderConditions(filters)
          )}
          </div>
        </div>

        <Separator />

        <div className="p-3 flex items-center justify-between bg-muted/30">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 text-xs gap-1.5"
              onClick={handleAddCondition}
            >
              <Plus className="h-3.5 w-3.5" />
              Add filter
            </Button>
            {showGrouping && filters.conditions.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs gap-1.5 text-muted-foreground"
                onClick={handleAddGroup}
              >
                <Parentheses className="h-3.5 w-3.5" />
                Add group
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 text-xs"
              onClick={() => setIsOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="h-8 text-xs"
              onClick={handleApply}
            >
              Apply filters
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

// Helper function to convert FilterGroup to query string
export function filtersToQueryString(filters: FilterGroup): string {
  const buildCondition = (condition: FilterCondition): string => {
    const { column, operator, value, value2 } = condition
    
    if (isNoValueOperator(operator)) {
      return `${column}:${operator}`
    }
    
    if (isBetweenOperator(operator)) {
      return `${column}:${operator}:${value}:${value2}`
    }
    
    if (isMultiValueOperator(operator) && Array.isArray(value)) {
      return `${column}:${operator}:${value.join(',')}`
    }
    
    return `${column}:${operator}:${value}`
  }

  const buildGroup = (group: FilterGroup): string => {
    const parts = group.conditions.map(item => {
      if ('conditions' in item) {
        return `(${buildGroup(item)})`
      }
      return buildCondition(item)
    })
    
    return parts.join(` ${group.logic.toUpperCase()} `)
  }

  return buildGroup(filters)
}

// Helper function to parse query string back to FilterGroup
export function queryStringToFilters(query: string): FilterGroup | null {
  // This is a simplified parser - implement based on your needs
  if (!query) return null
  
  // Basic implementation - can be extended for more complex parsing
  return {
    id: generateId(),
    logic: 'and',
    conditions: []
  }
}

export default QueryBuilder
