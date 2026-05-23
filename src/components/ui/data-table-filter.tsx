"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useTransition } from "react"

interface DataTableFilterProps {
  paramKey: string
  title: string
  options: { label: string; value: string }[]
}

export function DataTableFilter({ paramKey, title, options }: DataTableFilterProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const currentValue = searchParams.get(paramKey) || "all"

  const handleValueChange = (value: string | null) => {
    if (!value) return
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "all") {
        params.set(paramKey, value)
      } else {
        params.delete(paramKey)
      }
      params.set("page", "1")
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  return (
    <div className={`flex items-center gap-2 ${isPending ? 'opacity-70' : ''}`}>
      <Select value={currentValue} onValueChange={handleValueChange}>
        <SelectTrigger className="w-[180px] shadow-sm bg-white">
          <SelectValue placeholder={title} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All {title}s</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
