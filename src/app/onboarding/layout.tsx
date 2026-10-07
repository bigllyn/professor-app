import * as React from "react"
import { BookOpen } from "lucide-react"

export default function OnboardingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center p-6">
      <div className="w-full max-w-md">
        <header className="flex items-center gap-3 mb-8 pt-4">
          <BookOpen className="w-6 h-6 text-gray-900" />
          <span className="font-semibold text-gray-900 text-lg">Professor</span>
        </header>
        {children}
      </div>
    </div>
  )
}
