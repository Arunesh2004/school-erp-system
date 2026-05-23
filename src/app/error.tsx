"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error)
  }, [error])

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-6 p-4 text-center">
      <div className="rounded-full bg-red-100 p-6">
        <AlertCircle className="h-12 w-12 text-red-600" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Something went wrong!</h2>
        <p className="text-slate-500 max-w-md mx-auto">
          An unexpected error occurred in the application. Our team has been notified.
        </p>
      </div>
      <div className="flex gap-4">
        <Button
          onClick={
            // Attempt to recover by trying to re-render the segment
            () => reset()
          }
          className="bg-blue-600 hover:bg-blue-700"
        >
          Try again
        </Button>
        <Button
          variant="outline"
          onClick={() => window.location.href = "/"}
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  )
}
