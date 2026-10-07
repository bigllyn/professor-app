import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import ProgressoView from "@/components/dashboard/ProgressoView"

export const metadata = {
  title: "Progresso | Professor.app",
  description: "Acompanhe a evolução dos seus alunos",
}

export default async function ProgressoPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  return (
    <div className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Progresso</h1>
          <p className="text-gray-500 mt-1">
            Acompanhe a evolução dos seus alunos com base nas aulas registradas.
          </p>
        </div>
      </div>

      <ProgressoView 
        userId={user.id} 
        initialContext={contextCookie} 
      />
    </div>
  )
}
