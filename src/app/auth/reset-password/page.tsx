"use client"

import * as React from "react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Lock, BookOpen } from "lucide-react"

export default function ResetPasswordPage() {
  const supabase = createClient()
  const [password, setPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    if (password.length < 6) {
      setError("A senha deve ter pelo menos 6 caracteres.")
      setLoading(false)
      return
    }

    if (password !== confirmPassword) {
      setError("As senhas não conferem.")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase.auth.updateUser({
      password,
    })

    if (updateError) {
      setError(updateError.message)
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
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Nova senha</h1>
          <p className="text-sm text-gray-500">Crie uma nova senha para sua conta.</p>
        </div>

        <div className="w-full">
          {success ? (
            <div className="bg-green-50 text-green-700 p-4 rounded-xl text-sm mb-6 border border-green-100">
              Sua senha foi redefinida com sucesso! Você já pode fazer login.
            </div>
          ) : (
            <form onSubmit={handleUpdate} className="flex flex-col gap-4">
              {error && <div className="text-red-500 text-sm text-left">{error}</div>}
              
              <Input 
                type="password" 
                placeholder="Nova senha (mín. 6 caracteres)" 
                icon={<Lock className="h-5 w-5" />} 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />

              <Input 
                type="password" 
                placeholder="Confirme a nova senha" 
                icon={<Lock className="h-5 w-5" />} 
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />

              <Button type="submit" className="mt-2" disabled={loading}>
                {loading ? "Salvando..." : "Salvar nova senha"}
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
