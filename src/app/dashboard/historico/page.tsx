import { createClient } from "@/lib/supabase/server"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { HistoricoView } from "@/components/dashboard/HistoricoView"

export const metadata = {
  title: 'Histórico Pedagógico | Professor',
}

export default async function HistoricoPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  const cookieStore = await cookies()
  const contextCookie = cookieStore.get("professor_context")?.value || "all"

  return (
    <div className="p-4 space-y-6">
      <HistoricoView userId={user.id} initialContext={contextCookie} />
    </div>
  )
}
