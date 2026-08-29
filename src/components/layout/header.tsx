"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { LogOut, User as UserIcon, BellRing } from "lucide-react"
import { logout } from "@/app/(auth)/login/actions"
import { MobileNav } from "./mobile-nav"

export function Header({ userName, role, academicSession, schoolName, isClassTeacher, unreadAlertsCount = 0 }: { userName: string | null, role: "ADMIN" | "TEACHER" | "STUDENT", academicSession: string, schoolName: string, isClassTeacher?: boolean, unreadAlertsCount?: number }) {
  const handleLogout = async () => {
    await logout()
  }

  const alertHref = `/${role.toLowerCase()}/alerts`

  return (
    <header className="flex h-16 items-center gap-4 border-b bg-white/95 backdrop-blur-md px-4 lg:px-8 justify-between sticky top-0 z-50 shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
      <div className="flex flex-1 items-center gap-4">
        <MobileNav role={role} schoolName={schoolName} isClassTeacher={isClassTeacher} />
        <h1 className="hidden sm:block text-lg font-bold tracking-tight text-slate-800 capitalize">{role.toLowerCase()} Portal</h1>
        <div className="hidden md:flex items-center px-3 py-1.5 rounded-md bg-blue-50/50 border border-blue-100/50 text-[11px] font-semibold text-blue-700 tracking-wider uppercase shadow-sm">
          Session: {academicSession}
        </div>
      </div>
      <div className="flex items-center gap-4 sm:gap-6">
        <Link href={alertHref} className="relative p-2 text-slate-400 hover:text-slate-700 transition-colors bg-slate-50 hover:bg-slate-100 rounded-full">
          <BellRing className="h-[18px] w-[18px]" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </Link>
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-semibold leading-none text-slate-800">{userName || "User"}</span>
            <span className="text-xs text-slate-500 capitalize mt-1.5 font-medium">{role.toLowerCase()}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200 shadow-sm">
            <UserIcon className="h-4 w-4 text-slate-500" />
          </div>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" className="text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-full">
          <LogOut className="h-[18px] w-[18px]" />
          <span className="sr-only">Log out</span>
        </Button>
      </div>
    </header>
  )
}
