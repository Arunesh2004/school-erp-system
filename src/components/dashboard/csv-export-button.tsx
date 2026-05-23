"use client"

import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"
import { toast } from "sonner"

interface CsvExportButtonProps<T> {
  data: T[]
  filename: string
  columns: { header: string, key: string }[]
}

export function CsvExportButton<T>({ data, filename, columns }: CsvExportButtonProps<T>) {
  const handleExport = () => {
    try {
      if (!data || data.length === 0) {
        toast.error("No data available to export.")
        return
      }

      // Generate CSV Header
      const headerRow = columns.map(col => `"${col.header.replace(/"/g, '""')}"`).join(',')
      
      // Generate CSV Rows
      const rows = data.map(row => {
        return columns.map(col => {
          // Nested object access using dot notation
          const val = String(col.key.split('.').reduce((o: unknown, i) => (o && typeof o === 'object' ? (o as Record<string, unknown>)[i] : ""), row) ?? "")
          return `"${val.replace(/"/g, '""')}"`
        }).join(',')
      })

      const csvContent = [headerRow, ...rows].join('\n')
      
      // Create Blob and Download Link
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.setAttribute('href', url)
      link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
      toast.success("Exported CSV successfully!")
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate CSV.")
    }
  }

  return (
    <Button 
      variant="outline" 
      size="sm" 
      onClick={handleExport}
      className="bg-white shadow-sm flex items-center gap-2 text-slate-600 hover:text-slate-900"
    >
      <Download className="h-4 w-4" />
      Export CSV
    </Button>
  )
}
