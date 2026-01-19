import { useState, useEffect } from "react"

// Hook for using command palette with keyboard shortcut
export function useCommandPalette() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      // Command+J (Mac) or Ctrl+J (Windows/Linux)
      if (e.key === "j" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
      // Also support Command+K as alternative
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((open) => !open)
      }
    }

    document.addEventListener("keydown", down)
    return () => document.removeEventListener("keydown", down)
  }, [])

  return { open, setOpen }
}
