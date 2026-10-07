import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { SchoolForm } from "@/components/onboarding/SchoolForm"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function OnboardingSchoolsPage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/login")
  }

  // Verifica se já não tem escolas cadastradas (segurança para evitar duplicidade no botão voltar)
  const { data: existingLinks } = await supabase
    .from("teacher_schools")
    .select("id")
    .eq("teacher_id", user.id)
    .limit(1)

  if (existingLinks && existingLinks.length > 0) {
    redirect("/dashboard")
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Onde você ensina?</CardTitle>
        <CardDescription>
          Cadastre as escolas onde você leciona para organizar suas turmas.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SchoolForm />
      </CardContent>
    </Card>
  )
}
