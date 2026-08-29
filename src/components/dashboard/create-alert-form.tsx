"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createAlert } from "@/app/actions/alert"
import { AlertPriority } from "@prisma/client"
import { BellRing, Plus, Loader2 } from "lucide-react"

type CreateAlertFormProps = {
  isAdmin?: boolean
  assignedClasses?: { id: string; name: string }[]
}

export function CreateAlertForm({ isAdmin, assignedClasses = [] }: CreateAlertFormProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const router = useRouter()

  const [targetType, setTargetType] = useState<string>(isAdmin ? "GLOBAL" : "SPECIFIC_CLASSES")
  const [selectedClassId, setSelectedClassId] = useState<string>("")

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    const formData = new FormData(e.currentTarget)
    const title = formData.get("title") as string
    const message = formData.get("message") as string
    const priority = formData.get("priority") as AlertPriority
    const requiresAck = formData.get("requiresAcknowledgement") === "on"

    try {
      let payload: any = { targetType }
      
      if (targetType === "SPECIFIC_CLASSES") {
        if (!selectedClassId) throw new Error("Please select a class")
        payload.classIds = [selectedClassId]
      }
      
      const result = await createAlert({
        title,
        message,
        priority,
        requiresAcknowledgement: requiresAck,
        targetPayload: payload
      })

      if (result.error) {
        setError(result.error)
      } else {
        setIsOpen(false)
        router.refresh()
      }
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred.")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium shadow-sm transition-colors"
      >
        <Plus className="h-4 w-4" />
        New Alert
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b flex items-center gap-3">
          <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
            <BellRing className="h-5 w-5" />
          </div>
          <h2 className="text-xl font-bold text-slate-900">Create Alert</h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-md text-sm font-medium border border-red-100">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Title</label>
            <input
              required
              name="title"
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="e.g. Tomorrow's test cancelled"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Message</label>
            <textarea
              required
              name="message"
              rows={3}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Detailed message..."
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Target</label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {isAdmin ? (
                  <>
                    <option value="GLOBAL">Global (Everyone)</option>
                    <option value="ALL_STUDENTS">All Students</option>
                    <option value="ALL_TEACHERS">All Teachers</option>
                    <option value="SPECIFIC_CLASSES">Specific Class</option>
                  </>
                ) : (
                  <>
                    <option value="SPECIFIC_CLASSES">Assigned Class</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Priority</label>
              <select
                name="priority"
                defaultValue="INFO"
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="INFO">Info</option>
                <option value="NOTICE">Notice</option>
                <option value="WARNING">Warning</option>
                <option value="URGENT">Urgent</option>
              </select>
            </div>
          </div>

          {targetType === "SPECIFIC_CLASSES" && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Select Class</label>
              {isAdmin ? (
                <input 
                  type="text" 
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  placeholder="Enter Class ID..."
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                />
              ) : (
                <select 
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  required
                >
                  <option value="">Select an assigned class...</option>
                  {assignedClasses.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <input type="checkbox" id="requiresAcknowledgement" name="requiresAcknowledgement" className="rounded border-slate-300 text-blue-600 focus:ring-blue-500" />
            <label htmlFor="requiresAcknowledgement" className="text-sm font-medium text-slate-700">Require readers to acknowledge</label>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t mt-6">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {isLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Publish Alert
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
