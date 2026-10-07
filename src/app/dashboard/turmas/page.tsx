import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ClassesManager } from "@/components/dashboard/ClassesManager"

export default async function TurmasPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  // 1. Buscar turmas considerando o RLS/Contexto SSR
  let classesQuery = supabase.from("classes").select("id, name, year, school_id, subject_id, subjects(name)").eq("teacher_id", user.id).order("name")
  
  if (contextCookie !== "all") {
    if (contextCookie === "private") classesQuery = classesQuery.is("school_id", null)
    else classesQuery = classesQuery.eq("school_id", contextCookie)
  }

  // 2. Buscar disciplinas do contexto atual para preencher o combobox
  let subjectsQuery = supabase.from("subjects").select("id, name").eq("teacher_id", user.id).order("name")
  if (contextCookie !== "all") {
    if (contextCookie === "private") subjectsQuery = subjectsQuery.is("school_id", null)
    else subjectsQuery = subjectsQuery.eq("school_id", contextCookie)
  }

  const [classesRes, subjectsRes] = await Promise.all([classesQuery, subjectsQuery])

  return (
    <div className="p-4 space-y-6">
      <ClassesManager 
        initialClasses={(classesRes.data as any[]) || []} 
        subjects={(subjectsRes.data as any[]) || []} 
        currentContext={contextCookie} 
        userId={user.id} 
      />
    </div>
  )
}
