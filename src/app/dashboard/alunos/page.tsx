import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { StudentsManager } from "@/components/dashboard/StudentsManager"

export default async function AlunosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  // 1. Buscar alunos considerando o RLS/Contexto SSR
  let studentsQuery = supabase
    .from("students")
    .select("id, name, email, phone, school_id, class_id, classes(name)")
    .eq("teacher_id", user.id)
    .order("name")
  
  if (contextCookie !== "all") {
    if (contextCookie === "private") studentsQuery = studentsQuery.is("school_id", null)
    else studentsQuery = studentsQuery.eq("school_id", contextCookie)
  }

  // 2. Buscar turmas do contexto atual para preencher o combobox
  let classesQuery = supabase.from("classes").select("id, name").eq("teacher_id", user.id).order("name")
  if (contextCookie !== "all") {
    if (contextCookie === "private") classesQuery = classesQuery.is("school_id", null)
    else classesQuery = classesQuery.eq("school_id", contextCookie)
  }

  const [studentsRes, classesRes] = await Promise.all([studentsQuery, classesQuery])

  return (
    <div className="p-4 space-y-6">
      <StudentsManager 
        initialStudents={(studentsRes.data as any[]) || []} 
        classes={(classesRes.data as any[]) || []} 
        currentContext={contextCookie} 
        userId={user.id} 
      />
    </div>
  )
}
