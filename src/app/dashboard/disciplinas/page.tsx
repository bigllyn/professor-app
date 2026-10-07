import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SubjectManager } from "@/components/dashboard/SubjectManager"

export default async function DisciplinasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  let query = supabase.from("subjects").select("*").eq("teacher_id", user.id).order("name")
  
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
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Disciplinas</h1>
        <p className="text-gray-500 text-sm mt-1">Gerencie as matérias que você leciona.</p>
      </div>

      <SubjectManager initialSubjects={subjects || []} currentContext={contextCookie} userId={user.id} />
    </div>
  )
}
