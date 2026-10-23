"use client"

import { useState, useEffect } from "react"
import { Download, Share, PlusSquare, X } from "lucide-react"

export function InstallPrompt() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return

    // Verificar se já está instalado em modo standalone (Android/iOS)
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (window.navigator as any).standalone === true

    if (isStandalone) return

    const dismissed = localStorage.getItem("pwa_prompt_dismissed")
    if (dismissed) return

    // Detectar dispositivos iOS (iPhone / iPad / iPod)
    const ua = window.navigator.userAgent.toLowerCase()
    const iosDevice =
      /iphone|ipad|ipod/.test(ua) ||
      (window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1)

    if (iosDevice) {
      const timer = window.setTimeout(() => {
        setIsIOS(true)
        setShowPrompt(true)
      }, 0)
      return () => window.clearTimeout(timer)
    }

    // Apenas mostrar no mobile/tablet para Android/Chrome
    if (window.innerWidth > 768) {
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowPrompt(true)
    }

    window.addEventListener("beforeinstallprompt", handler)

    return () => {
      window.removeEventListener("beforeinstallprompt", handler)
    }
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === "accepted") {
      setShowPrompt(false)
    }
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem("pwa_prompt_dismissed", "true")
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300 md:hidden">
      <div className="bg-gray-900 text-white rounded-2xl p-4 shadow-xl flex items-center justify-between gap-4">
        <div className="flex flex-col flex-1 min-w-0">
          <p className="font-bold text-sm truncate">Instalar o Professor</p>
          {isIOS ? (
            <p className="text-xs text-gray-300 mt-0.5 leading-snug">
              Toque em <Share className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" />{" "}
              <span className="font-semibold">Compartilhar</span> e depois em{" "}
              <PlusSquare className="w-3.5 h-3.5 inline mx-0.5 text-blue-400" />{" "}
              <span className="font-semibold">Adicionar à Tela de Início</span>
            </p>
          ) : (
            <p className="text-xs text-gray-400 truncate">Acesso rápido na tela inicial</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!isIOS && (
            <button
              onClick={handleInstall}
              className="flex items-center gap-1.5 bg-white text-gray-900 px-3 py-1.5 rounded-full text-xs font-bold"
            >
              <Download className="w-3.5 h-3.5" />
              Instalar
            </button>
          )}
          <button
            onClick={handleDismiss}
            aria-label="Fechar aviso de instalação"
            className="p-1.5 text-gray-400 hover:text-white rounded-full transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
