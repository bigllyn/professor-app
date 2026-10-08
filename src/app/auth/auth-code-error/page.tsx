"use client"

import * as React from "react"
import Link from "next/link"
import { BookOpen } from "lucide-react"

export default function AuthCodeErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-sm space-y-8 flex flex-col items-center text-center">
        
        {/* Logo and Welcome Text */}
        <div className="space-y-4">
          <div className="flex justify-center mb-6">
            <div className="bg-red-50 p-4 rounded-3xl shadow-sm border border-red-100">
              <BookOpen className="w-12 h-12 text-red-600" />
            </div>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Não foi possível entrar</h1>
          <p className="text-sm text-gray-500">Não conseguimos concluir o login com o Google. Tente novamente.</p>
        </div>

        <div className="w-full">
          <Link 
            href="/auth/login" 
            className="flex items-center justify-center w-full rounded-full bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800 transition-colors"
          >
            Tentar novamente
          </Link>
        </div>
      </div>
    </main>
  )
}
