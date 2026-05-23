"use client"

import { useTransition } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { updateSchoolSettings } from "@/app/actions/settings"
import { toast } from "sonner"
import { Loader2, Save } from "lucide-react"

interface SettingsFormProps {
  initialData: {
    schoolName: string
    schoolAddress: string
    contactNumber: string
    principalName: string
    email: string
  }
  activeSessionName: string
}

export function SettingsForm({ initialData, activeSessionName }: SettingsFormProps) {
  const [isPending, startTransition] = useTransition()

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    startTransition(async () => {
      const result = await updateSchoolSettings(formData)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("School settings updated successfully!")
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-2">
          <Label htmlFor="schoolName">Official School Name</Label>
          <Input id="schoolName" name="schoolName" defaultValue={initialData.schoolName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="academicSession">Current Academic Session</Label>
          <Input id="academicSession" value={activeSessionName} readOnly className="bg-slate-50 text-slate-500 cursor-not-allowed" />
          <p className="text-[10px] text-slate-500 mt-1">Managed via Academic Session portal.</p>
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="schoolAddress">School Address</Label>
          <Input id="schoolAddress" name="schoolAddress" defaultValue={initialData.schoolAddress} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="principalName">Principal's Name</Label>
          <Input id="principalName" name="principalName" defaultValue={initialData.principalName} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="contactNumber">Contact Number</Label>
          <Input id="contactNumber" name="contactNumber" defaultValue={initialData.contactNumber} required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Official Email</Label>
          <Input id="email" name="email" type="email" defaultValue={initialData.email} required />
        </div>
      </div>
      
      <div className="pt-4 border-t flex justify-end">
        <Button type="submit" disabled={isPending} className="w-full md:w-auto min-w-[150px]">
          {isPending ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
          ) : (
            <><Save className="mr-2 h-4 w-4" /> Save Settings</>
          )}
        </Button>
      </div>
    </form>
  )
}
