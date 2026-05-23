"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { deleteAnnouncement } from "@/app/actions/announcements"
import { Trash2, Loader2 } from "lucide-react"
import { toast } from "sonner"

export function DeleteAnnouncementButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this announcement?")) {
      startTransition(async () => {
        const res = await deleteAnnouncement(id)
        if (res.error) {
          toast.error(res.error)
        } else {
          toast.success("Announcement deleted")
        }
      })
    }
  }

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      onClick={handleDelete} 
      disabled={isPending}
      className="text-slate-400 hover:text-red-600 hover:bg-red-50 -mr-2"
    >
      {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
    </Button>
  )
}
