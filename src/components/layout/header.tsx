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
    <header className="flex h-16 items-center gap-4 border-b bg-white/80 backdrop-blur-md px-4 lg:px-8 justify-between sticky top-0 z-50 shadow-sm">
      <div className="flex flex-1 items-center gap-4">
        <MobileNav role={role} schoolName={schoolName} isClassTeacher={isClassTeacher} />
        <h1 className="hidden sm:block text-xl font-bold tracking-tight text-slate-800 capitalize">{role.toLowerCase()} Portal</h1>
        <div className="hidden md:flex items-center px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-600 tracking-wider uppercase">
          ACADEMIC SESSION: {academicSession}
        </div>
      </div>
      <div className="flex items-center gap-6">
        <Link href={alertHref} className="relative p-2 text-slate-500 hover:text-slate-900 transition-colors">
          <BellRing className="h-5 w-5" />
          {unreadAlertsCount > 0 && (
            <span className="absolute top-1.5 right-1.5 h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" />
          )}
        </Link>
        <div className="h-6 w-px bg-slate-200 hidden sm:block" />
        <div className="flex items-center gap-3">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium leading-none text-slate-900">{userName || "User"}</span>
            <span className="text-xs text-slate-500 capitalize mt-1">{role.toLowerCase()}</span>
          </div>
          <div className="h-9 w-9 rounded-full bg-slate-100 flex items-center justify-center border border-slate-200">
            <UserIcon className="h-4 w-4 text-slate-600" />
          </div>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <Button variant="ghost" size="icon" onClick={handleLogout} title="Log out" className="text-slate-500 hover:text-slate-900 hover:bg-slate-100">
          <LogOut className="h-5 w-5" />
          <span className="sr-only">Log out</span>
        </Button>
      </div>
    </header>
  )
}
