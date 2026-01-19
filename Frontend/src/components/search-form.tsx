import { Search } from "lucide-react"

import { Label } from "@/components/ui/label"
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from "@/components/ui/sidebar"

interface SearchFormProps extends Omit<React.ComponentProps<"form">, 'onSubmit'> {
  searchQuery: string
  onSearchChange: (query: string) => void
  onSearchClick?: () => void
}

export function SearchForm({ searchQuery, onSearchChange, onSearchClick, ...props }: SearchFormProps) {
  return (
    <form onSubmit={(e) => e.preventDefault()} {...props}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="search"
            placeholder="Search..."
            className="pl-8 pr-12"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            onClick={onSearchClick}
          />
          <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none" />
          <kbd className="pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground opacity-70">
            ⌘J
          </kbd>
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
