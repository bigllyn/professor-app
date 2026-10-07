import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { AgendaView } from "@/components/dashboard/AgendaView"

export default async function AgendaPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect("/auth/login")

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  // Gerar data de hoje no formato YYYY-MM-DD com base no UTC do servidor
  // O componente client gerenciará sua própria data a partir desta inicial.
  const d = new Date()
  const todayStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

  let query = supabase.from("lessons")
    .select("id, title, description, date, start_time, end_time, status, school_id, class_id, subject_id, student_id, classes(name), subjects(name), students(name), private_lesson_finances(id, amount, status), lesson_students(id, student_id, class_id, student_name_snapshot, class_name_snapshot, attendance_status, attendance_notes, performance_level, performance_notes)")
    .eq("teacher_id", user.id)
    .eq("date", todayStr)
    .order("start_time")
  
  if (contextCookie !== "all") {
    if (contextCookie === "private") query = query.is("school_id", null)
    else query = query.eq("school_id", contextCookie)
  }

  const { data } = await query

  return (
    <div className="p-4 space-y-6">
      <AgendaView 
        initialLessons={(data as any) || []} 
        currentContext={contextCookie} 
        userId={user.id} 
        initialDate={todayStr}
      />
    </div>
  )
}
