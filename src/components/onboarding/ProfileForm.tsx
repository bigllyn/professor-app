"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight } from "lucide-react"

export function ProfileForm({ initialData, userId }: { initialData: any, userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [formData, setFormData] = useState({
    fullName: initialData?.full_name || "",
    displayName: initialData?.display_name || "",
    profession: initialData?.profession || "Professor(a)",
  })

  // Para workTypes: array de strings
  const [workTypes, setWorkTypes] = useState<string[]>(initialData?.work_types || [])

  const toggleWorkType = (type: string) => {
    setWorkTypes(prev => 
      prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!formData.fullName.trim() || !formData.displayName.trim() || workTypes.length === 0) {
      setError("Por favor, preencha todos os campos e selecione pelo menos uma opção de trabalho.")
      setLoading(false)
      return
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: formData.fullName,
        display_name: formData.displayName,
        profession: formData.profession,
        work_types: workTypes,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId)

    if (updateError) {
      setError(updateError.message)
      setLoading(false)
      return
    }

    // Se trabalha em escola, vai para cadastro de escola, senão pula para dashboard/context
    if (workTypes.includes('escola') || workTypes.includes('varias_escolas')) {
      router.push("/onboarding/schools")
    } else {
      // Somente particular
      router.push("/dashboard") 
    }
  }

  const workOptions = [
    { id: 'escola', label: 'Em uma escola' },
    { id: 'varias_escolas', label: 'Em mais de uma escola' },
    { id: 'particular', label: 'Aulas particulares' }
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
      
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nome completo</label>
          <Input 
            value={formData.fullName}
            onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
            placeholder="Ex: João da Silva"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Como quer ser chamado?</label>
          <Input 
            value={formData.displayName}
            onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
            placeholder="Ex: Prof. João"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Área de atuação</label>
          <Input 
            value={formData.profession}
            onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
            placeholder="Ex: Professor de Matemática"
          />
        </div>

        <div className="pt-2">
          <label className="block text-sm font-medium text-gray-700 mb-2">Você trabalha como?</label>
          <div className="space-y-2">
            {workOptions.map(opt => (
              <label key={opt.id} className={`flex items-center p-4 border rounded-xl cursor-pointer transition-colors ${workTypes.includes(opt.id) ? 'border-gray-900 bg-gray-50/50' : 'border-gray-200 hover:bg-gray-50'}`}>
                <input 
                  type="checkbox" 
                  className="hidden" 
                  checked={workTypes.includes(opt.id)}
                  onChange={() => toggleWorkType(opt.id)}
                />
                <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${workTypes.includes(opt.id) ? 'bg-gray-900 border-gray-900' : 'border-gray-300'}`}>
                  {workTypes.includes(opt.id) && <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
                </div>
                <span className="text-sm font-medium text-gray-900">{opt.label}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      <Button type="submit" className="w-full h-12 text-base font-medium flex items-center justify-center gap-2" disabled={loading}>
        {loading ? "Salvando..." : "Continuar"}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </Button>
    </form>
  )
}
