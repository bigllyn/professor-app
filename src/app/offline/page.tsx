"use client"

import { WifiOff, RefreshCw } from "lucide-react"

export default function OfflinePage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-sm border border-gray-100 space-y-6">
        <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto">
          <WifiOff className="w-8 h-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-gray-900">
            Você está sem conexão
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            Não foi possível carregar esta página no momento. Verifique sua internet e tente novamente.
          </p>
        </div>

        <button
          onClick={() => window.location.reload()}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-gray-800 text-white font-semibold py-3 px-6 rounded-full text-sm transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Tentar novamente
        </button>
      </div>
    </div>
  )
}
