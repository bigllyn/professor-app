"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"
import { useSearchParams } from "next/navigation"

function ErrorContent() {
  const searchParams = useSearchParams()
  const errorDescription = searchParams.get("error_description") || ""
  
  const isExpired = errorDescription.toLowerCase().includes("expired")
  
  const title = isExpired ? "Link expirado" : "Não foi possível entrar"
  const message = isExpired 
    ? "O link que você utilizou expirou ou é inválido. Por favor, solicite um novo acesso."
    : "Não conseguimos concluir sua solicitação de autenticação. Tente novamente."

  return (
    <div className="w-full max-w-sm space-y-8 flex flex-col items-center text-center">
      <div className="space-y-4">
        <div className="flex justify-center mb-6">
          <div className="bg-red-50 p-4 rounded-3xl shadow-sm border border-red-100">
            <BookOpen className="w-12 h-12 text-red-600" />
          </div>
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
        <p className="text-sm text-gray-500">{message}</p>
      </div>

      <div className="w-full">
        <Link 
          href="/auth/login" 
          className="flex items-center justify-center w-full rounded-full bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
        >
          Voltar para o login
        </Link>
      </div>
    </div>
  )
}

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <React.Suspense fallback={<div className="text-gray-500">Carregando...</div>}>
        <ErrorContent />
      </React.Suspense>
    </main>
  )
}

