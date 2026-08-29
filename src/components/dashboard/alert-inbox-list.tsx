"use client"

import { useState } from "react"
import { BellRing, Check, CheckCircle, ShieldAlert, Clock } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { markAlertRead, acknowledgeAlert } from "@/app/actions/alert"
import { useRouter } from "next/navigation"

type AlertInboxListProps = {
  initialAlerts: any[]
}

export function AlertInboxList({ initialAlerts }: AlertInboxListProps) {
  const [loadingIds, setLoadingIds] = useState<Set<string>>(new Set())
  const router = useRouter()

  const unreadCount = initialAlerts.filter(a => !a.readAt).length

  async function handleMarkRead(id: string) {
    setLoadingIds(prev => new Set(prev).add(id))
    try {
      await markAlertRead(id)
      router.refresh()
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  async function handleAcknowledge(id: string) {
    setLoadingIds(prev => new Set(prev).add(id))
    try {
      await acknowledgeAlert(id)
      router.refresh()
    } finally {
      setLoadingIds(prev => {
        const next = new Set(prev)
        next.delete(id)
        return next
      })
    }
  }

  if (initialAlerts.length === 0) {
    return (
      <div className="rounded-xl border bg-white p-12 text-center text-slate-500 shadow-sm flex flex-col items-center justify-center">
        <BellRing className="h-12 w-12 text-slate-300 mb-4" />
        <h3 className="text-lg font-medium text-slate-900 mb-1">You're all caught up!</h3>
        <p>No new alerts in your inbox.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {unreadCount > 0 && (
        <div className="mb-4 text-sm font-medium text-blue-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-100 inline-block">
          You have {unreadCount} unread alert{unreadCount === 1 ? '' : 's'}.
        </div>
      )}
      
      {initialAlerts.map((recipient) => {
        const { alert } = recipient
        const isUnread = !recipient.readAt
        const needsAck = alert.requiresAcknowledgement && !recipient.acknowledgedAt
        const isLoading = loadingIds.has(alert.id)

        return (
          <div 
            key={recipient.id} 
            className={`border rounded-xl shadow-sm p-6 relative overflow-hidden transition-all ${isUnread ? 'bg-blue-50/50 border-blue-200' : 'bg-white'}`}
          >
            {alert.priority === "URGENT" && <div className="absolute top-0 left-0 w-1 h-full bg-red-600"></div>}
            {alert.priority === "WARNING" && <div className="absolute top-0 left-0 w-1 h-full bg-orange-500"></div>}
            {alert.priority === "NOTICE" && <div className="absolute top-0 left-0 w-1 h-full bg-blue-400"></div>}
            {alert.priority === "INFO" && <div className="absolute top-0 left-0 w-1 h-full bg-slate-300"></div>}

            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 gap-3">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className={`font-bold text-lg ${isUnread ? 'text-blue-900' : 'text-slate-900'}`}>{alert.title}</h3>
                {isUnread && <Badge className="bg-blue-600">New</Badge>}
                {needsAck && (
                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 gap-1">
                    <ShieldAlert className="h-3 w-3" />
                    Action Required
                  </Badge>
                )}
              </div>
              
              <div className="flex flex-col gap-2 min-w-[120px]">
                {needsAck ? (
                  <button
                    onClick={() => handleAcknowledge(alert.id)}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    <CheckCircle className="h-3.5 w-3.5" />
                    Acknowledge
                  </button>
                ) : isUnread ? (
                  <button
                    onClick={() => handleMarkRead(alert.id)}
                    disabled={isLoading}
                    className="flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold px-3 py-1.5 rounded transition-colors disabled:opacity-50"
                  >
                    <Check className="h-3.5 w-3.5" />
                    Mark Read
                  </button>
                ) : (
                  <span className="flex items-center justify-end gap-1.5 text-xs text-slate-400 font-medium">
                    <CheckCircle className="h-3.5 w-3.5 text-emerald-500" />
                    {recipient.acknowledgedAt ? 'Acknowledged' : 'Read'}
                  </span>
                )}
              </div>
            </div>
            
            <p className="text-slate-700 whitespace-pre-wrap text-sm">{alert.message}</p>
            
            <div className="mt-4 flex items-center gap-4 text-xs font-medium text-slate-500 border-t pt-4">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" />
                {new Date(alert.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </div>
              <div>From: {alert.creator.name} ({alert.creator.role})</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
