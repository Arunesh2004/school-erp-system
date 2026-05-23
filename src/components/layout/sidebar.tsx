"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, BookOpen, GraduationCap, FileText, Building2, CalendarDays, Bell, Activity } from "lucide-react"

type SidebarProps = {
  role: "ADMIN" | "TEACHER" | "STUDENT"
  schoolName: string
  isClassTeacher?: boolean
}

export function Sidebar({ role, schoolName, isClassTeacher }: SidebarProps) {
  const pathname = usePathname()

  const links = {
    ADMIN: [
      { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
      { name: "Teachers", href: "/admin/teachers", icon: Users },
      { name: "Students", href: "/admin/students", icon: GraduationCap },
      { name: "Classes", href: "/admin/classes", icon: BookOpen },
      { name: "Subjects", href: "/admin/subjects", icon: FileText },
      { name: "Attendance", href: "/admin/attendance", icon: CalendarDays },
      { name: "Announcements", href: "/admin/announcements", icon: Bell },
      { name: "Activity Log", href: "/admin/activity", icon: Activity },
      { name: "Settings", href: "/admin/settings", icon: Building2 },
    ],
    TEACHER: [
      { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
      { name: "My Classes", href: "/teacher/classes", icon: BookOpen },
      { name: "Attendance", href: "/teacher/attendance", icon: CalendarDays },
      { name: "Enter Marks", href: "/teacher/marks", icon: FileText },
    ],
    STUDENT: [
      { name: "Dashboard", href: "/student", icon: LayoutDashboard },
      { name: "My Results", href: "/student/results", icon: FileText },
    ],
  }

  const currentLinks = [...(links[role] || [])]
  
  if (role === "TEACHER" && isClassTeacher) {
    // Insert "My Class" after "Dashboard"
    currentLinks.splice(1, 0, { name: "My Class", href: "/teacher/class", icon: Users })
  }

  return (
    <div className="flex h-full w-full flex-col bg-slate-900 text-slate-50 shadow-xl">
      <div className="flex h-16 items-center border-b border-slate-800 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3 font-bold text-lg tracking-tight hover:text-blue-400 transition-colors">
          <div className="bg-blue-600 p-1.5 rounded-lg flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="truncate">{schoolName}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-auto py-4">
        <nav className="grid items-start px-3 text-sm font-medium gap-1 lg:px-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {role} MENU
          </div>
          {currentLinks.map((link) => {
            const Icon = link.icon
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
            return (
              <Link
                key={link.name}
                href={link.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2.5 transition-all",
                  isActive 
                    ? "bg-blue-600/10 text-blue-400 font-semibold" 
                    : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-100"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-blue-400" : "text-slate-400")} />
                {link.name}
              </Link>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
