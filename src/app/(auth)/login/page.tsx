import { Metadata } from "next"
import { LoginForm } from "./components/login-form"

export const metadata: Metadata = {
  title: "Login - School ERP",
  description: "Login to your account",
}

export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center bg-zinc-50 p-6 md:p-10 dark:bg-zinc-950">
      <div className="w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
