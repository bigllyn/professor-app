import * as React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ContextSwitcher } from "@/components/dashboard/ContextSwitcher"
import { BookOpen } from "lucide-react"
import { DashboardNavigation } from "@/components/dashboard/Navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  // Obter escolas do professor
  const { data: teacherSchools } = await supabase
    .from("teacher_schools")
    .select("school_id, schools(id, name)")
    .eq("teacher_id", user.id)

  const schools = (teacherSchools?.map(ts => ts.schools) || []) as any[]

  // Perfil para ver se dá aulas particulares
  const { data: profile } = await supabase
    .from("profiles")
    .select("work_types")
    .eq("id", user.id)
    .single()

  const hasPrivate = profile?.work_types?.includes('particular') || false

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
      <DashboardNavigation />
      
      <div className="flex-1 flex flex-col md:ml-64 w-full min-w-0">
        {/* Header Mobile / Topnav */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10 w-full">
          <div className="flex items-center gap-2 md:hidden">
            <BookOpen className="w-6 h-6 text-gray-900" />
            <span className="font-semibold text-gray-900">Professor</span>
          </div>
          {/* Espaçador no desktop para empurrar o switcher pra direita */}
          <div className="hidden md:block flex-1" />
          <ContextSwitcher schools={schools} hasPrivate={hasPrivate} />
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto pb-20 md:pb-8 w-full">
          {children}
        </main>
      </div>
    </div>
  )
}
