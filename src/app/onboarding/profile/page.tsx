import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { ProfileForm } from "@/components/onboarding/ProfileForm"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function OnboardingProfilePage() {
  const supabase = await createClient()
  
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    redirect("/auth/login")
  }

  // Fetch current profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Vamos configurar seu perfil profissional</CardTitle>
        <CardDescription>
          Conte um pouco sobre você para personalizarmos sua experiência.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ProfileForm initialData={profile} userId={user.id} />
      </CardContent>
    </Card>
  )
}
