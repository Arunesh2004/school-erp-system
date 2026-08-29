"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface CsvExportButtonProps<T extends Record<string, unknown>> {
  data?: T[]
  filename: string
  columns: { header: string, key: string }[]
  /** When provided, clicking exports ALL records via this server action instead of the current-page `data` prop. */
  fetchAllAction?: () => Promise<T[]>
  label?: string
}

/** Sanitize a single cell: escape quotes, prevent formula injection */
function sanitizeCell(raw: unknown): string {
  let val = String(raw ?? "")
  // Prevent CSV/spreadsheet formula injection
  if (val.startsWith("=") || val.startsWith("+") || val.startsWith("-") || val.startsWith("@")) {
    val = "'" + val
  }
  return `"${val.replace(/"/g, '""')}"`
}

function buildCsv<T extends Record<string, unknown>>(rows: T[], columns: { header: string; key: string }[]): string {
  const headerRow = columns.map(col => sanitizeCell(col.header)).join(",")
  const dataRows = rows.map(row =>
    columns.map(col => {
      const val = col.key.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : ""), row)
      return sanitizeCell(val)
    }).join(",")
  )
  return [headerRow, ...dataRows].join("\n")
}

function triggerDownload(csvContent: string, filename: string) {
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.setAttribute("href", url)
  link.setAttribute("download", `${filename}_${new Date().toISOString().split("T")[0]}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

export function CsvExportButton<T extends Record<string, unknown>>({
  data,
  filename,
  columns,
  fetchAllAction,
  label = "Export CSV",
}: CsvExportButtonProps<T>) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    try {
      setLoading(true)
      let rows: T[]

      if (fetchAllAction) {
        rows = await fetchAllAction()
      } else {
        rows = data ?? []
      }

      if (!rows || rows.length === 0) {
        toast.error("No data available to export.")
        return
      }

      const csvContent = buildCsv(rows, columns)
      triggerDownload(csvContent, filename)
      toast.success(`Exported ${rows.length} records successfully!`)
    } catch (err) {
      console.error(err)
      toast.error("Failed to generate CSV.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="bg-white shadow-sm flex items-center gap-2 text-slate-600 hover:text-slate-900"
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
      {loading ? "Exporting..." : label}
    </Button>
  )
}
