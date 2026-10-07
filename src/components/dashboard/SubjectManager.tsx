"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Plus, Trash2 } from "lucide-react"

type Subject = { id: string, name: string, school_id: string | null }

export function SubjectManager({ initialSubjects, currentContext, userId }: { initialSubjects: Subject[], currentContext: string, userId: string }) {
  const [subjects, setSubjects] = useState<Subject[]>(initialSubjects)
  const [newSubject, setNewSubject] = useState("")
  const [loading, setLoading] = useState(false)
  const supabase = createClient()

  const handleAdd = async () => {
    if (!newSubject.trim()) return
    setLoading(true)

    const schoolId = currentContext === "all" || currentContext === "private" ? null : currentContext

    const { data, error } = await supabase
      .from("subjects")
      .insert({ teacher_id: userId, name: newSubject, school_id: schoolId })
      .select()
      .single()

    if (!error && data) {
      setSubjects([...subjects, data])
      setNewSubject("")
    }
    setLoading(false)
  }

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("subjects").delete().eq("id", id)
    if (!error) {
      setSubjects(subjects.filter(s => s.id !== id))
    }
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Minhas Disciplinas</h2>
      
      <div className="flex gap-2 mb-6">
        <Input 
          value={newSubject}
          onChange={(e) => setNewSubject(e.target.value)}
          placeholder="Ex: Matemática"
          className="flex-1"
        />
        <Button onClick={handleAdd} disabled={loading || !newSubject.trim()}>
          <Plus className="w-5 h-5 mr-1" /> Adicionar
        </Button>
      </div>

      <div className="space-y-3">
        {subjects.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">Nenhuma disciplina cadastrada neste contexto.</p>
        ) : (
          subjects.map(subject => (
            <div key={subject.id} className="flex items-center justify-between p-3 border border-gray-100 bg-gray-50 rounded-xl">
              <span className="font-medium text-gray-900">{subject.name}</span>
              <button onClick={() => handleDelete(subject.id)} className="text-gray-400 hover:text-red-600 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
