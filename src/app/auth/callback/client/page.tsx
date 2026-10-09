"use client"

import { useEffect, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"

function ClientCallbackContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  useEffect(() => {
    const processHash = async () => {
      const next = searchParams.get('next') ?? '/dashboard'
      const hash = window.location.hash

      // Se houver erro no hash
      if (hash && hash.includes("error=")) {
        const hashParams = new URLSearchParams(hash.substring(1))
        const error = hashParams.get("error")
        const error_description = hashParams.get("error_description")
        router.push(`/auth/auth-code-error?error=${error}&error_description=${error_description}`)
        return
      }

      // Se houver access_token no hash (Implicit Flow antigo ou Link de Recuperação legado)
      if (hash && hash.includes("access_token=")) {
        // A sessão é extraída automaticamente pelo createBrowserClient na sua inicialização
        // (ele assina onAuthStateChange e processa o hash do Supabase).
        // Apenas precisamos aguardar a sessão ser setada para confirmar.
        const { data: { session }, error } = await supabase.auth.getSession()
        
        if (error) {
          router.push(`/auth/auth-code-error?error=${error.name}&error_description=${error.message}`)
          return
        }

        if (session) {
          // Sessão garantida. Agora envia para o destino.
          router.push(next)
          router.refresh()
          return
        }
      }

      // Se não houver nem erro nem token, redirecionamos pelo fallback
      router.push("/auth/login")
    }

    processHash()
  }, [router, searchParams, supabase])

  return (
    <div className="w-full max-w-sm text-center">
      <p className="text-sm text-gray-500">Validando link de acesso...</p>
    </div>
  )
}

export default function ClientCallbackPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <Suspense fallback={<div className="text-gray-500">Carregando...</div>}>
        <ClientCallbackContent />
      </Suspense>
    </main>
  )
}
