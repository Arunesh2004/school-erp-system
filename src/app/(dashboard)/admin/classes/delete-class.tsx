"use client"

import { Button } from "@/components/ui/button"
import { useTransition } from "react"
import { deleteClass } from "@/app/actions/admin"
import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

export function DeleteClassButton({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  return (
    <Button
      variant="destructive"
      size="sm"
      disabled={isPending}
      onClick={() => {
        if (confirm("Are you sure you want to delete this class?")) {
          startTransition(async () => {
            const res = await deleteClass(id)
            if (res.error) alert(res.error)
            else router.refresh()
          })
        }
      }}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  )
}
