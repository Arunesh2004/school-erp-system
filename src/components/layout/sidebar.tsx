"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { LayoutDashboard, Users, BookOpen, GraduationCap, FileText, Building2, CalendarDays, Bell, Activity, BellRing } from "lucide-react"

type SidebarProps = {
  role: "ADMIN" | "TEACHER" | "STUDENT"
  schoolName: string
  isClassTeacher?: boolean
}

export function Sidebar({ role, schoolName, isClassTeacher }: SidebarProps) {
  const pathname = usePathname()

  const getGroupedLinks = () => {
    switch (role) {
      case "ADMIN":
        return [
          {
            group: "Overview",
            items: [
              { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
            ]
          },
          {
            group: "Academics",
            items: [
              { name: "Classes", href: "/admin/classes", icon: BookOpen },
              { name: "Subjects", href: "/admin/subjects", icon: FileText },
              { name: "Attendance", href: "/admin/attendance", icon: CalendarDays },
            ]
          },
          {
            group: "People",
            items: [
              { name: "Teachers", href: "/admin/teachers", icon: Users },
              { name: "Students", href: "/admin/students", icon: GraduationCap },
            ]
          },
          {
            group: "Communication",
            items: [
              { name: "Alerts", href: "/admin/alerts", icon: BellRing },
              { name: "Announcements", href: "/admin/announcements", icon: Bell },
            ]
          },
          {
            group: "System",
            items: [
              { name: "Activity Log", href: "/admin/activity", icon: Activity },
              { name: "Settings", href: "/admin/settings", icon: Building2 },
            ]
          }
        ]
      case "TEACHER":
        return [
          {
            group: "Overview",
            items: [
              { name: "Dashboard", href: "/teacher", icon: LayoutDashboard },
              ...(isClassTeacher ? [{ name: "My Homeroom", href: "/teacher/class", icon: Users }] : [])
            ]
          },
          {
            group: "Academics",
            items: [
              { name: "My Classes", href: "/teacher/classes", icon: BookOpen },
              { name: "Attendance", href: "/teacher/attendance", icon: CalendarDays },
              { name: "Enter Marks", href: "/teacher/marks", icon: FileText },
              { name: "Notes & Hub", href: "/teacher/notes", icon: BookOpen },
            ]
          },
          {
            group: "Communication",
            items: [
              { name: "Alerts", href: "/teacher/alerts", icon: BellRing },
            ]
          }
        ]
      case "STUDENT":
        return [
          {
            group: "Overview",
            items: [
              { name: "Dashboard", href: "/student", icon: LayoutDashboard },
              { name: "My Results", href: "/student/results", icon: FileText },
            ]
          },
          {
            group: "Academics",
            items: [
              { name: "Learning Hub", href: "/student/learning-hub", icon: BookOpen },
            ]
          },
          {
            group: "Communication",
            items: [
              { name: "Inbox", href: "/student/alerts", icon: BellRing },
            ]
          }
        ]
      default:
        return []
    }
  }

  const groupedNav = getGroupedLinks()

  return (
    <div className="flex h-full w-full flex-col bg-slate-900 text-slate-50 shadow-xl">
      <div className="flex h-16 items-center border-b border-slate-800/60 px-4 lg:px-6">
        <Link href="/" className="flex items-center gap-3 font-bold text-lg tracking-tight hover:text-blue-400 transition-colors">
          <div className="bg-blue-600 p-1.5 rounded-lg flex-shrink-0">
            <GraduationCap className="h-5 w-5 text-white" />
          </div>
          <span className="truncate">{schoolName}</span>
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto py-6">
        <nav className="grid items-start px-3 text-sm font-medium lg:px-4">
          {groupedNav.map((section, idx) => (
            <div key={section.group} className={cn("mb-6", idx === groupedNav.length - 1 ? "mb-0" : "")}>
              <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-slate-500/80">
                {section.group}
              </div>
              <div className="space-y-1">
                {section.items.map((link) => {
                  const Icon = link.icon
                  const isActive = pathname === link.href || pathname.startsWith(link.href + "/")
                  return (
                    <Link
                      key={link.name}
                      href={link.href}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 transition-all group",
                        isActive
                          ? "bg-blue-600/15 text-blue-400 font-semibold shadow-sm"
                          : "text-slate-300 hover:bg-slate-800/80 hover:text-slate-100"
                      )}
                    >
                      <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-blue-400" : "text-slate-400 group-hover:text-slate-300")} />
                      {link.name}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}
