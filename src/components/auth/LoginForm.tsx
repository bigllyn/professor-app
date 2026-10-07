"use client"

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Mail, Lock, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function LoginForm() {
  const router = useRouter()
  const supabase = createClient()
  const [loginId, setLoginId] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    
    let targetEmail = loginId.trim()

    // Se não contiver '@', tenta resolver como username via RPC
    if (!targetEmail.includes("@")) {
      const { data: resolvedEmail, error: rpcError } = await supabase.rpc("get_email_by_username", { p_username: targetEmail })
      
      if (rpcError || !resolvedEmail) {
        setError("Credenciais inválidas.")
        setLoading(false)
        return
      }
      targetEmail = resolvedEmail as string
    }

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password,
    })

    if (signInError) {
      setError(signInError.message)
      setLoading(false)
      return
    }
    
    router.push("/dashboard")
    router.refresh()
  }

  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
  }

  return (
    <div className="w-full flex flex-col gap-4">
      {error && <div className="text-red-500 text-sm">{error}</div>}
      <form onSubmit={handleEmailLogin} className="flex flex-col gap-4">
        <Input 
          type="text" 
          placeholder="E-mail ou Usuário" 
          icon={<Mail className="h-5 w-5" />} 
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
        />
        <div className="relative">
          <Input 
            type="password" 
            placeholder="Sua senha" 
            icon={<Lock className="h-5 w-5" />} 
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button type="button" className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400">
            <Eye className="h-5 w-5" />
          </button>
        </div>

        <div className="flex justify-between items-center text-sm px-1">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="rounded text-gray-900 focus:ring-gray-900 border-gray-300 w-4 h-4" />
            <span className="text-gray-600">Lembrar de mim</span>
          </label>
          <button type="button" className="text-gray-500 hover:text-gray-900">
            Esqueceu sua senha?
          </button>
        </div>

        <Button type="submit" className="mt-2" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </Button>
      </form>

      <div className="relative flex items-center py-2">
        <div className="flex-grow border-t border-gray-200"></div>
        <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">ou</span>
        <div className="flex-grow border-t border-gray-200"></div>
      </div>

      <Button variant="outline" type="button" onClick={handleGoogleLogin} className="rounded-full">
        <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continuar com Google
      </Button>
    </div>
  )
}
