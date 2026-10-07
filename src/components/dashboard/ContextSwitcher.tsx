"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { ChevronDown, MapPin, Building, User } from "lucide-react"

type School = { id: string, name: string }

export function ContextSwitcher({ schools, hasPrivate }: { schools: School[], hasPrivate: boolean }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(false)
  const [activeContext, setActiveContext] = useState<string>("all")

  // Load context from cookie on mount
  useEffect(() => {
    const match = document.cookie.match(/(^| )professor_context=([^;]+)/)
    if (match) setActiveContext(match[2])
  }, [])

  const setContext = (val: string) => {
    document.cookie = `professor_context=${val}; path=/; max-age=31536000`
    setActiveContext(val)
    setIsOpen(false)
    router.refresh() // Reloads server components with new cookie
  }

  const getContextLabel = () => {
    if (activeContext === "all") return "Todos os locais"
    if (activeContext === "private") return "Aulas Particulares"
    const school = schools.find(s => s.id === activeContext)
    return school ? school.name : "Todos os locais"
  }

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 transition-colors px-3 py-1.5 rounded-full text-sm font-medium text-gray-900"
      >
        <span className="truncate max-w-[150px]">{getContextLabel()}</span>
        <ChevronDown className="w-4 h-4 text-gray-500" />
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-gray-200 rounded-2xl shadow-lg z-30 overflow-hidden py-2 animate-in fade-in zoom-in-95 duration-100">
            <button
              onClick={() => setContext("all")}
              className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 ${activeContext === "all" ? "text-gray-900 bg-gray-50 font-medium" : "text-gray-600"}`}
            >
              <MapPin className="w-4 h-4" />
              Todos os locais
            </button>
            
            {schools.map(school => (
              <button
                key={school.id}
                onClick={() => setContext(school.id)}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 ${activeContext === school.id ? "text-gray-900 bg-gray-50 font-medium" : "text-gray-600"}`}
              >
                <Building className="w-4 h-4" />
                <span className="truncate">{school.name}</span>
              </button>
            ))}

            {hasPrivate && (
              <button
                onClick={() => setContext("private")}
                className={`w-full text-left px-4 py-2.5 text-sm flex items-center gap-3 hover:bg-gray-50 ${activeContext === "private" ? "text-gray-900 bg-gray-50 font-medium" : "text-gray-600"}`}
              >
                <User className="w-4 h-4" />
                Aulas Particulares
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}
