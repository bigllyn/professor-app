import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, work_types")
    .eq("id", user.id)
    .single()

  if (!profile?.work_types || profile.work_types.length === 0) {
    redirect("/onboarding")
  }

  // Lógica de leitura de contexto pelo Cookie
  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  // Fetch das turmas ou subjects baseadas no contexto (Mock visual apenas do layout, consultando BD real)
  let query = supabase.from("subjects").select("*").eq("teacher_id", user.id)
  
  if (contextCookie !== "all") {
    if (contextCookie === "private") {
      query = query.is("school_id", null)
    } else {
      query = query.eq("school_id", contextCookie)
    }
  }

  const { data: subjects } = await query

  return (
    <div className="p-4 space-y-6">
      <div className="pt-2">
        <h1 className="text-2xl font-bold text-gray-900">Meu Dia</h1>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo(a), {profile.full_name}</p>
      </div>
      
      {/* Cards de Resumo */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
          <div className="text-3xl font-bold text-gray-900">{subjects?.length || 0}</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Disciplinas ativas</div>
        </div>
        <div className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm">
          <div className="text-3xl font-bold text-gray-900">0</div>
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mt-1">Aulas hoje</div>
        </div>
      </div>

      <div className="bg-gray-100 rounded-2xl p-6 text-center border border-gray-200 border-dashed">
        <p className="text-gray-500 text-sm">
          Filtro ativo no servidor: <strong className="text-gray-900 font-mono">{contextCookie}</strong>
        </p>
      </div>
    </div>
  )
}
