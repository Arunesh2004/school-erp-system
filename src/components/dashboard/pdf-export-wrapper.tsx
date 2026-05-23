"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Loader2, Printer } from "lucide-react"
import { toast } from "sonner"
import html2canvas from "html2canvas"
import jsPDF from "jspdf"

interface PdfExportWrapperProps {
  children: React.ReactNode
  filename?: string
  targetId?: string
}

export function PdfExportWrapper({ 
  children, 
  filename = "document.pdf",
  targetId = "pdf-content"
}: PdfExportWrapperProps) {
  const [isExporting, setIsExporting] = useState(false)

  const handleExportPDF = async () => {
    const element = document.getElementById(targetId)
    if (!element) {
      toast.error("Could not find the document to export.")
      return
    }

    try {
      setIsExporting(true)
      toast.loading("Generating High-Resolution PDF...", { id: "pdf-export" })

      // Temporarily add a class to force print styles if needed, 
      // but html2canvas usually captures what's on screen.
      // For better quality, we scale up the canvas.
      const canvas = await html2canvas(element, {
        scale: 2, // 2x resolution
        useCORS: true,
        logging: false,
        backgroundColor: "#ffffff",
      })

      const imgData = canvas.toDataURL('image/jpeg', 1.0)
      
      // Calculate PDF dimensions (A4 size: 210x297mm)
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
      })

      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight)
      pdf.save(filename)

      toast.success("PDF Downloaded successfully!", { id: "pdf-export" })
    } catch (error) {
      console.error(error)
      toast.error("An error occurred during PDF generation.", { id: "pdf-export" })
    } finally {
      setIsExporting(false)
    }
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      <div className="flex justify-end gap-3 print:hidden">
        <Button 
          variant="outline"
          className="bg-white"
          onClick={handlePrint}
          disabled={isExporting}
        >
          <Printer className="h-4 w-4 mr-2" />
          Print
        </Button>
        <Button 
          className="bg-slate-900 text-white hover:bg-slate-800"
          onClick={handleExportPDF}
          disabled={isExporting}
        >
          {isExporting ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Download className="h-4 w-4 mr-2" />
          )}
          Download PDF
        </Button>
      </div>

      <div id={targetId}>
        {children}
      </div>
    </div>
  )
}
