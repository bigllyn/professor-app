"use client"

import * as React from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, BookOpen } from "lucide-react"

export default function ForgotPasswordPage() {
  const supabase = createClient()
  const [email, setEmail] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    // Configura URL para onde o usuario voltará para digitar a nova senha
    const redirectTo = `${window.location.origin}/auth/reset-password`

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (resetError) {
      setError(resetError.message)
    } else {
      setSuccess(true)
    }
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-8 flex flex-col items-center text-center">
        
        {/* Logo and Welcome Text */}
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-white p-4 rounded-3xl shadow-sm border border-gray-100">
              <BookOpen className="w-12 h-12 text-gray-900" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Esqueceu sua senha?</h1>
          <p className="text-sm text-gray-500">Enviaremos um link para redefinição.</p>
        </div>

        <div className="w-full">
          {success ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 border border-green-100">
              Se este e-mail estiver cadastrado, enviaremos um link para redefinir sua senha.
            </div>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              {error && <div className="text-red-500 text-sm text-left">{error}</div>}
              
              <Input 
                type="email" 
                placeholder="E-mail" 
                icon={<Mail className="h-5 w-5" />} 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button type="submit" className="mt-2" disabled={loading}>
                {loading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>
          )}

          <div className="mt-8 text-sm">
            <Link href="/auth/login" className="text-gray-900 font-semibold hover:underline">
              Voltar para o login
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
