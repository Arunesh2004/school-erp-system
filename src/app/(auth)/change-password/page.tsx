import { ChangePasswordForm } from "./components/change-password-form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

export default function ChangePasswordPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 p-6 md:p-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <Card className="shadow-lg">
          <CardHeader className="space-y-2">
            <CardTitle className="text-2xl text-center font-bold tracking-tight">Action Required</CardTitle>
            <CardDescription className="text-center text-slate-500">
              Your administrator created this account with a temporary password. Please create your personal password to continue.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChangePasswordForm />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
