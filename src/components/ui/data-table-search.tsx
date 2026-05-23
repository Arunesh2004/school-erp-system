"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Input } from "@/components/ui/input"
import { Search } from "lucide-react"
import { useTransition, useState, useEffect } from "react"

export function DataTableSearch({ placeholder = "Search..." }: { placeholder?: string }) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()
  
  const initialQuery = searchParams.get("q") || ""
  const [query, setQuery] = useState(initialQuery)

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (query === initialQuery) return
      
      startTransition(() => {
        const params = new URLSearchParams(searchParams.toString())
        if (query) {
          params.set("q", query)
        } else {
          params.delete("q")
        }
        // Reset page to 1 when searching
        params.set("page", "1")
        router.push(`${pathname}?${params.toString()}`)
      })
    }, 300) // 300ms debounce

    return () => clearTimeout(timeoutId)
  }, [query, pathname, router, searchParams, initialQuery])

  return (
    <div className="relative w-full md:w-80">
      <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-400">
        <Search className="h-4 w-4" />
      </div>
      <Input
        type="search"
        placeholder={placeholder}
        className={`pl-9 shadow-sm ${isPending ? 'opacity-70' : ''}`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
    </div>
  )
}
