"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Edit2, Trash2, BookOpen } from "lucide-react"

type Subject = { id: string, name: string }
type ClassItem = { 
  id: string, 
  name: string, 
  year: string, 
  school_id: string | null, 
  subject_id: string | null,
  subjects: { name: string } | null
}

export function ClassesManager({ 
  initialClasses, 
  subjects, 
  currentContext, 
  userId 
}: { 
  initialClasses: ClassItem[], 
  subjects: Subject[], 
  currentContext: string, 
  userId: string 
}) {
  const [classesList, setClassesList] = useState<ClassItem[]>(initialClasses)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", year: new Date().getFullYear().toString(), subject_id: "" })

  const supabase = createClient()

  const openNew = () => {
    setEditingId(null)
    setFormData({ name: "", year: new Date().getFullYear().toString(), subject_id: "" })
    setError("")
    setIsModalOpen(true)
  }

  const openEdit = (cls: ClassItem) => {
    setEditingId(cls.id)
    setFormData({ name: cls.name, year: cls.year, subject_id: cls.subject_id || "" })
    setError("")
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta turma?")) return
    
    const { error } = await supabase.from("classes").delete().eq("id", id)
    if (!error) {
      setClassesList(prev => prev.filter(c => c.id !== id))
    } else {
      alert("Erro ao excluir: " + error.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!formData.name.trim()) {
      setError("Nome da turma é obrigatório")
      setLoading(false)
      return
    }

    const schoolId = currentContext === "all" || currentContext === "private" ? null : currentContext
    const subjectId = formData.subject_id ? formData.subject_id : null

    const payload = {
      name: formData.name,
      year: formData.year,
      subject_id: subjectId,
      school_id: schoolId,
      teacher_id: userId
    }

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from("classes")
        .update(payload)
        .eq("id", editingId)
        .select("*, subjects(name)")
        .single()

      if (updateError) {
        setError(updateError.message)
      } else if (data) {
        setClassesList(prev => prev.map(c => c.id === editingId ? data : c))
        setIsModalOpen(false)
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("classes")
        .insert(payload)
        .select("*, subjects(name)")
        .single()

      if (insertError) {
        setError(insertError.message)
      } else if (data) {
        setClassesList([data, ...classesList])
        setIsModalOpen(false)
      }
    }
    setLoading(false)
  }

  // Filtrar classes pelo contexto client-side (além do que o SSR já fez) para lidar com adições caso em "all"
  const displayClasses = classesList.filter(c => {
    if (currentContext === "all") return true
    if (currentContext === "private") return c.school_id === null
    return c.school_id === currentContext
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Turmas</h1>
          <p className="text-sm text-gray-500">Gerencie as turmas do contexto atual.</p>
        </div>
        <Button onClick={openNew} className="rounded-full w-12 h-12 p-0 flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      {displayClasses.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-3xl p-10 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Nenhuma turma</h3>
          <p className="text-sm text-gray-500 mt-1">Nenhuma turma encontrada neste contexto.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayClasses.map(cls => (
            <div key={cls.id} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{cls.name} <span className="text-xs font-normal text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md ml-1">{cls.year}</span></h3>
                <p className="text-sm text-gray-500 mt-0.5">{cls.subjects?.name || "Sem disciplina vinculada"}</p>
                {currentContext === "all" && (
                  <p className="text-xs text-gray-400 mt-1">{cls.school_id ? "Escola" : "Particular"}</p>
                )}
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(cls)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(cls.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-full transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Turma" : "Nova Turma"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome da turma</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: 3º Ano A" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Ano</label>
              <Input value={formData.year} onChange={e => setFormData({ ...formData, year: e.target.value })} placeholder="Ex: 2024" required />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Disciplina</label>
              <select 
                value={formData.subject_id} 
                onChange={e => setFormData({ ...formData, subject_id: e.target.value })}
                className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900"
              >
                <option value="">Selecione...</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm text-gray-600">
            <strong>Contexto:</strong> {currentContext === "all" ? "Aulas Particulares (Por padrão em 'Todos')" : currentContext === "private" ? "Aulas Particulares" : "Escola selecionada"}
          </div>

          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
