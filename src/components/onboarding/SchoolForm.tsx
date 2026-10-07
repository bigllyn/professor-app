"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ArrowRight, Plus } from "lucide-react"

export function SchoolForm() {
  const router = useRouter()
  const supabase = createClient()
  
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [schools, setSchools] = useState([{ id: 1, name: "", type: "private" }])

  const addSchool = () => {
    setSchools([...schools, { id: Date.now(), name: "", type: "private" }])
  }

  const updateSchool = (id: number, field: string, value: string) => {
    setSchools(schools.map(s => s.id === id ? { ...s, [field]: value } : s))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    const validSchools = schools.filter(s => s.name.trim() !== "")

    if (validSchools.length === 0) {
      setError("Por favor, adicione o nome de pelo menos uma escola.")
      setLoading(false)
      return
    }

    try {
      // Inserir todas as escolas válidas
      for (const school of validSchools) {
        const { error: insertError } = await supabase
          .from("schools")
          .insert({ name: school.name, type: school.type })

        if (insertError) throw insertError
        // A vinculação na tabela teacher_schools ocorre automaticamente via trigger do banco
      }

      router.push("/dashboard")
      
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && <div className="text-sm text-red-600 bg-red-50 p-3 rounded-lg">{error}</div>}
      
      <div className="space-y-6">
        {schools.map((school, index) => (
          <div key={school.id} className="p-4 border border-gray-200 rounded-2xl space-y-4">
            <h3 className="font-medium text-gray-900">Escola {index + 1}</h3>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome da instituição</label>
              <Input 
                value={school.name}
                onChange={(e) => updateSchool(school.id, "name", e.target.value)}
                placeholder="Ex: Colégio Santa Maria"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tipo de escola</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => updateSchool(school.id, "type", "private")}
                  className={`py-2 px-4 rounded-xl text-sm font-medium transition-colors ${school.type === "private" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Particular
                </button>
                <button
                  type="button"
                  onClick={() => updateSchool(school.id, "type", "public")}
                  className={`py-2 px-4 rounded-xl text-sm font-medium transition-colors ${school.type === "public" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}
                >
                  Pública
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button type="button" variant="outline" onClick={addSchool} className="w-full border-dashed rounded-2xl h-12">
        <Plus className="w-4 h-4 mr-2" />
        Adicionar outra escola
      </Button>

      <Button type="submit" className="w-full h-12 text-base font-medium flex items-center justify-center gap-2" disabled={loading}>
        {loading ? "Salvando..." : "Finalizar cadastro"}
        {!loading && <ArrowRight className="w-5 h-5" />}
      </Button>
    </form>
  )
}
