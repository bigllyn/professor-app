import * as React from "react"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ContextSwitcher } from "@/components/dashboard/ContextSwitcher"
import { BookOpen, Calendar, Users, Home, Activity, Award, DollarSign } from "lucide-react"

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
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header Mobile / Topnav */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-gray-900" />
          <span className="font-semibold text-gray-900">Professor</span>
        </div>
        <ContextSwitcher schools={schools} hasPrivate={hasPrivate} />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      {/* Bottom Navigation */}
      <nav className="bg-white border-t border-gray-200 fixed bottom-0 w-full flex items-center justify-around pb-safe pt-2 px-2 h-16">
        <a href="/dashboard" className="flex flex-col items-center gap-1 text-gray-900">
          <Home className="w-6 h-6" />
          <span className="text-[10px] font-medium">Início</span>
        </a>
        <a href="/dashboard/agenda" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
          <Calendar className="w-6 h-6" />
          <span className="text-[10px] font-medium">Agenda</span>
        </a>
        <a href="/dashboard/turmas" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
          <Users className="w-6 h-6" />
          <span className="text-[10px] font-medium">Turmas</span>
        </a>
        <a href="/dashboard/progresso" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
          <Activity className="w-6 h-6" />
          <span className="text-[10px] font-medium">Progresso</span>
        </a>
        <a href="/dashboard/avaliacoes" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
          <Award className="w-6 h-6" />
          <span className="text-[10px] font-medium">Avaliações</span>
        </a>
        <a href="/dashboard/financeiro" className="flex flex-col items-center gap-1 text-gray-400 hover:text-gray-900 transition-colors">
          <DollarSign className="w-6 h-6" />
          <span className="text-[10px] font-medium">Financeiro</span>
        </a>
      </nav>
    </div>
  )
}
