import { createClient } from "@/lib/supabase/server"
import { redirect } from "next/navigation"
import { RelatoriosView } from "@/components/dashboard/RelatoriosView"

export const metadata = {
  title: "Relatórios | Professor App",
}

export default async function RelatoriosPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login")
  }

  return <RelatoriosView userId={user.id} />
}
