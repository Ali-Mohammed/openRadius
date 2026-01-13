import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"

export interface ComboboxOption {
  value: string
  label: string
  searchKey?: string
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  className?: string
  disabled?: boolean
  onSearchChange?: (search: string) => void
  modal?: boolean
}

export function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select option...",
  searchPlaceholder = "Search...",
  emptyText = "No results found.",
  className,
  disabled = false,
  onSearchChange,
  modal = false,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")
  const containerRef = React.useRef<HTMLDivElement>(null)
  const searchInputRef = React.useRef<HTMLInputElement>(null)
  const buttonRef = React.useRef<HTMLButtonElement>(null)
  const dropdownRef = React.useRef<HTMLDivElement>(null)

  const selectedOption = options.find((option) => option.value === value)

  // Debounce server-side search
  React.useEffect(() => {
    if (onSearchChange) {
      const timer = setTimeout(() => {
        onSearchChange(search)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [search, onSearchChange])

  const filteredOptions = React.useMemo(() => {
    // If using server-side search, don't filter client-side
    if (onSearchChange) return options
    if (!search) return options
    return options.filter((option) => {
      const searchText = option.searchKey || option.label
      return searchText.toLowerCase().includes(search.toLowerCase())
    })
  }, [options, search, onSearchChange])

  React.useEffect(() => {
    if (open && searchInputRef.current) {
      // Focus the search input when dropdown opens with a longer delay
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.click()
      }, 100)
      return () => clearTimeout(timer)
    }
  }, [open])

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      
      // Check if click is inside button
      if (containerRef.current && containerRef.current.contains(target)) {
        return
      }
      
      // Check if click is inside dropdown
      if (dropdownRef.current && dropdownRef.current.contains(target)) {
        return
      }
      
      // Click is outside both, close the dropdown
      setOpen(false)
      setSearch("")
    }

    if (open) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [open])

  const handleSelect = (optionValue: string) => {
    onValueChange?.(optionValue)
    setOpen(false)
    setSearch("")
  }

  const dropdownContent = open ? (
    <div 
      ref={dropdownRef}
      className="absolute z-[99999] mt-1 w-full rounded-md border bg-popover shadow-lg"
    >
      <div className="flex items-center border-b px-3" onClick={(e) => e.stopPropagation()}>
        <input
          ref={searchInputRef}
          type="text"
          className="flex h-10 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
          placeholder={searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation()
            if (e.key === 'Escape') {
              e.preventDefault()
              setOpen(false)
              setSearch("")
            }
          }}
        />
      </div>
      <div 
        className="max-h-[300px] overflow-y-auto p-1"
        onClick={(e) => e.stopPropagation()}
      >
        {filteredOptions.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">
            {emptyText}
          </div>
        ) : (
          filteredOptions.map((option) => (
            <div
              key={option.value}
              onClick={() => handleSelect(option.value)}
              onMouseDown={(e) => e.preventDefault()}
              className={cn(
                "relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground",
                value === option.value && "bg-accent"
              )}
            >
              <span className="flex-1 truncate">{option.label}</span>
              {value === option.value && (
                <Check className="ml-2 h-4 w-4 shrink-0" />
              )}
            </div>
          ))
        )}
      </div>
    </div>
  ) : null

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen(!open)}
        disabled={disabled}
        className={cn(
          "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          !value && "text-muted-foreground"
        )}
      >
        <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </button>

      {dropdownContent}
    </div>
  )
}
