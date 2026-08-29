"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sidebar } from "./sidebar"

interface MobileNavProps {
  role: "ADMIN" | "TEACHER" | "STUDENT"
  schoolName: string
  isClassTeacher?: boolean
}

export function MobileNav({ role, schoolName, isClassTeacher }: MobileNavProps) {
  const [open, setOpen] = useState(false)

  if (!open) {
    return (
      <Button 
        variant="ghost" 
        size="icon" 
        className="md:hidden mr-2 -ml-2" 
        onClick={() => setOpen(true)}
      >
        <Menu className="h-6 w-6 text-slate-700" />
      </Button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm" 
        onClick={() => setOpen(false)} 
      />
      <div className="relative flex w-[80%] max-w-[300px] flex-col bg-slate-900 h-full shadow-2xl">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute right-4 top-4 z-50 text-slate-400 hover:text-white"
          onClick={() => setOpen(false)}
        >
          <X className="h-6 w-6" />
        </Button>
        <div className="flex-1 overflow-y-auto" onClick={() => setOpen(false)}>
          <Sidebar role={role} schoolName={schoolName} isClassTeacher={isClassTeacher} />
        </div>
      </div>
    </div>
  )
}
