"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { 
  Home, Calendar, Users, Activity, Award, DollarSign, 
  Menu, X, BookOpen, GraduationCap, History, PieChart, LogOut
} from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useRouter } from "next/navigation"

export function DashboardNavigation() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isMoreOpen, setIsMoreOpen] = React.useState(false)

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push("/auth/login")
    router.refresh()
  }

  // As rotas principais que ficam direto na barra inferior
  const mainNav = [
    { href: "/dashboard", label: "Início", icon: Home },
    { href: "/dashboard/agenda", label: "Agenda", icon: Calendar },
    { href: "/dashboard/alunos", label: "Alunos", icon: Users },
    { href: "/dashboard/turmas", label: "Turmas", icon: GraduationCap },
  ]

  // As rotas secundárias que ficam no "Mais"
  const moreNav = [
    { href: "/dashboard/avaliacoes", label: "Avaliações", icon: Award },
    { href: "/dashboard/progresso", label: "Progresso", icon: Activity },
    { href: "/dashboard/financeiro", label: "Financeiro", icon: DollarSign },
    { href: "/dashboard/historico", label: "Histórico", icon: History },
    { href: "/dashboard/disciplinas", label: "Disciplinas", icon: BookOpen },
    { href: "/dashboard/relatorios", label: "Relatórios", icon: PieChart },
  ]

  const allNav = [...mainNav, ...moreNav]

  return (
    <>
      {/* Desktop Sidebar (oculta no mobile) */}
      <aside className="hidden md:flex flex-col w-64 border-r border-gray-200 bg-white fixed h-screen top-0 left-0 pt-16 z-0">
        <div className="p-4 space-y-2 overflow-y-auto flex-1">
          {allNav.map((item) => {
            const isActive = pathname === item.href
            const Icon = item.icon
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${
                  isActive 
                    ? "bg-gray-900 text-white" 
                    : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
              </Link>
            )
          })}
        </div>
        <div className="p-4 border-t border-gray-200 pb-8">
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl transition-colors text-red-600 hover:bg-red-50"
          >
            <LogOut className="w-5 h-5" />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (oculta no desktop) */}
      <nav className="md:hidden bg-white border-t border-gray-200 fixed bottom-0 w-full flex items-center justify-between pb-safe pt-2 px-2 min-h-[4rem] z-50">
        {mainNav.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link 
              key={item.href} 
              href={item.href} 
              className={`flex flex-col items-center justify-center w-16 gap-1 transition-colors ${
                isActive ? "text-gray-900" : "text-gray-400 hover:text-gray-900"
              }`}
            >
              <Icon className="w-6 h-6" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
        
        {/* Botão Mais */}
        <button 
          onClick={() => setIsMoreOpen(!isMoreOpen)}
          className={`flex flex-col items-center justify-center w-16 gap-1 transition-colors ${
            isMoreOpen ? "text-gray-900" : "text-gray-400 hover:text-gray-900"
          }`}
        >
          {isMoreOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>

      {/* Mobile Drawer (Menu "Mais") */}
      {isMoreOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/50 flex flex-col justify-end pb-[calc(4rem+env(safe-area-inset-bottom))] animate-in fade-in duration-200">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsMoreOpen(false)}
          />
          <div className="bg-white rounded-t-3xl border-t border-gray-200 p-4 pb-8 shadow-xl relative animate-in slide-in-from-bottom-full duration-300">
            <div className="w-12 h-1.5 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="grid grid-cols-3 gap-4 pb-4">
              {moreNav.map((item) => {
                const isActive = pathname === item.href
                const Icon = item.icon
                return (
                    <Link 
                      key={item.href} 
                      href={item.href} 
                      className={`flex flex-col items-center gap-2 p-3 rounded-xl transition-colors ${
                        isActive ? "bg-gray-50 text-gray-900 border-2 border-gray-900" : "bg-gray-50 text-gray-600 border-2 border-transparent"
                      }`}
                      onClick={() => setIsMoreOpen(false)}
                    >
                      <Icon className={`w-6 h-6 ${isActive ? "text-gray-900" : "text-gray-500"}`} />
                      <span className="text-[11px] font-semibold text-center">{item.label}</span>
                    </Link>
                )
              })}
              <button
                onClick={() => {
                  setIsMoreOpen(false);
                  handleLogout();
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-xl transition-colors bg-red-50 text-red-600 border-2 border-transparent"
              >
                <LogOut className="w-6 h-6 text-red-600" />
                <span className="text-[11px] font-semibold text-center">Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
