"use client"

import { useState, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Plus, Edit2, Trash2, Users } from "lucide-react"

type ClassItem = { id: string, name: string }
type StudentItem = { 
  id: string, 
  name: string, 
  email: string | null,
  phone: string | null,
  school_id: string | null, 
  class_id: string | null,
  classes: { name: string } | null
}

export function StudentsManager({ 
  initialStudents, 
  classes, 
  currentContext, 
  userId 
}: { 
  initialStudents: StudentItem[], 
  classes: ClassItem[], 
  currentContext: string, 
  userId: string 
}) {
  const [studentsList, setStudentsList] = useState<StudentItem[]>(initialStudents)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  
  // Filtro client-side de turmas (Dropdown filter)
  const [filterClassId, setFilterClassId] = useState<string>("all")

  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", class_id: "" })

  const supabase = createClient()

  const openNew = () => {
    setEditingId(null)
    setFormData({ name: "", email: "", phone: "", class_id: filterClassId !== "all" ? filterClassId : "" })
    setError("")
    setIsModalOpen(true)
  }

  const openEdit = (std: StudentItem) => {
    setEditingId(std.id)
    setFormData({ name: std.name, email: std.email || "", phone: std.phone || "", class_id: std.class_id || "" })
    setError("")
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este aluno?")) return
    
    const { error } = await supabase.from("students").delete().eq("id", id)
    if (!error) {
      setStudentsList(prev => prev.filter(s => s.id !== id))
    } else {
      alert("Erro ao excluir: " + error.message)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")

    if (!formData.name.trim()) {
      setError("Nome do aluno é obrigatório")
      setLoading(false)
      return
    }

    const schoolId = currentContext === "all" || currentContext === "private" ? null : currentContext
    const classId = formData.class_id ? formData.class_id : null

    const payload = {
      name: formData.name,
      email: formData.email || null,
      phone: formData.phone || null,
      class_id: classId,
      school_id: schoolId,
      teacher_id: userId
    }

    if (editingId) {
      const { data, error: updateError } = await supabase
        .from("students")
        .update(payload)
        .eq("id", editingId)
        .select("*, classes(name)")
        .single()

      if (updateError) {
        setError(updateError.message)
      } else if (data) {
        setStudentsList(prev => prev.map(s => s.id === editingId ? data : s))
        setIsModalOpen(false)
      }
    } else {
      const { data, error: insertError } = await supabase
        .from("students")
        .insert(payload)
        .select("*, classes(name)")
        .single()

      if (insertError) {
        setError(insertError.message)
      } else if (data) {
        setStudentsList([data, ...studentsList])
        setIsModalOpen(false)
      }
    }
    setLoading(false)
  }

  // Memoizar lista visível aplicando ambos os filtros: de Contexto (caso "all") e de Turma (Dropdown)
  const displayStudents = useMemo(() => {
    return studentsList.filter(s => {
      // 1. Filtro do Switcher de Contexto Global (se em "all", SSR trouxe tudo, mas adições client-side precisam de filtro)
      if (currentContext !== "all") {
        if (currentContext === "private" && s.school_id !== null) return false
        if (currentContext !== "private" && s.school_id !== currentContext) return false
      }
      
      // 2. Filtro Local da Página por Turma
      if (filterClassId !== "all") {
        if (filterClassId === "none" && s.class_id !== null) return false
        if (filterClassId !== "none" && s.class_id !== filterClassId) return false
      }
      return true
    })
  }, [studentsList, currentContext, filterClassId])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alunos</h1>
          <p className="text-sm text-gray-500">Gerencie seus alunos no contexto atual.</p>
        </div>
        <Button onClick={openNew} className="rounded-full w-12 h-12 p-0 flex items-center justify-center">
          <Plus className="w-6 h-6" />
        </Button>
      </div>

      <div className="bg-white p-2 rounded-2xl border border-gray-200">
        <select 
          value={filterClassId} 
          onChange={e => setFilterClassId(e.target.value)}
          className="w-full h-10 px-3 rounded-xl bg-transparent focus:outline-none text-sm text-gray-900 font-medium"
        >
          <option value="all">Todas as turmas</option>
          <option value="none">Sem turma (Avulsos)</option>
          {classes.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      {displayStudents.length === 0 ? (
        <div className="bg-white border border-gray-200 border-dashed rounded-3xl p-10 text-center">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-900">Nenhum aluno</h3>
          <p className="text-sm text-gray-500 mt-1">Nenhum aluno encontrado para este filtro.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {displayStudents.map(std => (
            <div key={std.id} className="bg-white border border-gray-200 p-4 rounded-2xl shadow-sm flex items-center justify-between">
              <div>
                <h3 className="font-bold text-gray-900">{std.name}</h3>
                <p className="text-sm text-gray-500 mt-0.5">{std.classes?.name || "Sem turma"}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => openEdit(std)} className="p-2 text-gray-400 hover:text-gray-900 bg-gray-50 hover:bg-gray-100 rounded-full transition-colors">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(std.id)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-full transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Aluno" : "Novo Aluno"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{error}</div>}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nome do aluno</label>
            <Input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Ex: Ana Souza" required />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">E-mail (Opcional)</label>
              <Input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} placeholder="ana@email.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp (Opcional)</label>
              <Input value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 9999-9999" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a uma Turma</label>
            <select 
              value={formData.class_id} 
              onChange={e => setFormData({ ...formData, class_id: e.target.value })}
              className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm text-gray-900"
            >
              <option value="">Sem turma (Avulso)</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm text-gray-600">
            <strong>Aviso:</strong> O RLS protegerá esta operação impedindo cruzamento ilegal de escola e turma.
          </div>

          <Button type="submit" className="w-full h-12" disabled={loading}>
            {loading ? "Salvando..." : "Salvar"}
          </Button>
        </form>
      </Modal>
    </div>
  )
}
