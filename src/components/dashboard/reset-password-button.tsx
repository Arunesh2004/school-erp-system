"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { resetUserPassword } from "@/app/actions/admin"
import { KeyRound, Check, Copy } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"

export function ResetPasswordButton({ userId, userName }: { userId: string, userName?: string }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isPending, setIsPending] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleReset() {
    setIsPending(true)
    setError(null)
    try {
      const res = await resetUserPassword(userId)
      if (res.error) {
        setError(res.error)
      } else if (res.tempPassword) {
        setTempPassword(res.tempPassword)
      }
    } catch (err: any) {
      setError("Failed to reset password")
    } finally {
      setIsPending(false)
    }
  }

  function handleCopy() {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  function handleDone() {
    setIsOpen(false)
    setTimeout(() => {
      setTempPassword(null)
      setError(null)
      setCopied(false)
    }, 300)
  }

  function handleClose(open: boolean) {
    if (tempPassword && !open) return // Prevent accidental dismissal when showing password
    if (!open) {
      setIsOpen(false)
      // reset state on close
      setTimeout(() => {
        setTempPassword(null)
        setError(null)
        setCopied(false)
      }, 300)
    } else {
      setIsOpen(true)
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setIsOpen(true)} className="h-8 gap-2 border-amber-200 text-amber-700 hover:bg-amber-50 hover:text-amber-800">
        <KeyRound className="h-3.5 w-3.5" />
        Reset Password
      </Button>
      <Dialog open={isOpen} onOpenChange={handleClose}>
        <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset Password</DialogTitle>
          <DialogDescription>
            {tempPassword 
              ? `Password reset successful for ${userName || "user"}.`
              : `Are you sure you want to reset the password for ${userName || "this user"}? This will invalidate their current session.`
            }
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-md text-sm">
            {error}
          </div>
        )}

        {tempPassword ? (
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
              <code className="text-lg font-mono font-bold text-slate-800">{tempPassword}</code>
              <Button size="icon" variant="ghost" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4 text-slate-500" />}
              </Button>
            </div>
            <p className="text-sm text-slate-500">
              Please copy this temporary password and provide it securely to the user. This is the only time it will be shown. The user will be forced to change it upon their next login.
            </p>
            <DialogFooter>
              <Button onClick={handleDone}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <DialogFooter>
            <Button variant="outline" onClick={() => handleClose(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleReset} disabled={isPending} className="bg-amber-600 hover:bg-amber-700 text-white">
              {isPending ? "Resetting..." : "Confirm Reset"}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
    </>
  )
}
