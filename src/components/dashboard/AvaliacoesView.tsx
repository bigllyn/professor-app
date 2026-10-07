"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Search, User, Filter, BookOpen, UsersIcon, Calendar, Activity, X, Plus, Pencil, Trash2, Award } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type Assessment = {
  id: string
  student_id: string
  class_id: string | null
  subject_id: string | null
  lesson_id: string | null
  school_id: string | null
  title: string
  description: string | null
  score: number | null
  max_score: number | null
  assessment_date: string
  students: { name: string } | null
  classes: { name: string } | null
  subjects: { name: string } | null
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:bg-gray-100 rounded-full w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto max-h-[85vh]">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function AvaliacoesView({ userId, initialContext }: { userId: string, initialContext: string }) {
  const supabase = createClient()
  const [currentContext, setCurrentContext] = useState(initialContext)
  
  // Data
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)

  // Lookups
  const [studentsList, setStudentsList] = useState<{id: string, name: string, class_id: string | null, school_id: string | null}[]>([])
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([])
  const [subjectsList, setSubjectsList] = useState<{id: string, name: string}[]>([])
  const [lessonsList, setLessonsList] = useState<{id: string, title: string, date: string, class_id: string | null}[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClass, setFilterClass] = useState("all")
  const [filterSubject, setFilterSubject] = useState("all")
  const [dateRange, setDateRange] = useState("all")

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    assessment_date: new Date().toISOString().split('T')[0],
    student_id: "",
    class_id: "",
    subject_id: "",
    lesson_id: "",
    score: "",
    max_score: ""
  })

  // Listen context
  useEffect(() => {
    const handleContextChange = (e: any) => setCurrentContext(e.detail)
    window.addEventListener('context_changed', handleContextChange)
    return () => window.removeEventListener('context_changed', handleContextChange)
  }, [])

  // Fetch Lookups
  const fetchLookups = useCallback(async () => {
    let qSt = supabase.from("students").select("id, name, class_id, school_id").eq("teacher_id", userId).eq("status", "active").order("name")
    let qC = supabase.from("classes").select("id, name, school_id").eq("teacher_id", userId).order("name")
    let qS = supabase.from("subjects").select("id, name, school_id").eq("teacher_id", userId).order("name")
    let qL = supabase.from("lessons").select("id, title, date, class_id, school_id").eq("teacher_id", userId).neq("status", "cancelled").order("date", {ascending: false}).limit(100)

    if (currentContext === 'private') {
      qSt = qSt.is("school_id", null)
      qL = qL.is("school_id", null)
    } else if (currentContext !== 'all') {
      qSt = qSt.eq("school_id", currentContext)
      qC = qC.eq("school_id", currentContext)
      qS = qS.eq("school_id", currentContext)
      qL = qL.eq("school_id", currentContext)
    }

    const [rSt, rC, rS, rL] = await Promise.all([qSt, qC, qS, qL])
    if (rSt.data) setStudentsList(rSt.data)
    if (rC.data) setClassesList(rC.data)
    if (rS.data) setSubjectsList(rS.data)
    if (rL.data) setLessonsList(rL.data)
  }, [userId, currentContext, supabase])

  // Fetch Core Data
  const fetchData = useCallback(async () => {
    setLoading(true)
    let query = supabase.from("assessments").select(`
      id, student_id, class_id, subject_id, lesson_id, school_id, title, description, score, max_score, assessment_date,
      students(name), classes(name), subjects(name)
    `).eq("teacher_id", userId).order("assessment_date", { ascending: false })

    if (currentContext === 'private') query = query.is("school_id", null)
    else if (currentContext !== 'all') query = query.eq("school_id", currentContext)

    if (dateRange !== 'all') {
      const d = new Date()
      d.setDate(d.getDate() - parseInt(dateRange))
      const dateStr = d.toISOString().split('T')[0]
      query = query.gte("assessment_date", dateStr)
    }

    const { data } = await query
    if (data) setAssessments(data as unknown as Assessment[])
    setLoading(false)
  }, [userId, currentContext, dateRange, supabase])

  useEffect(() => {
    fetchLookups()
    fetchData()
  }, [fetchLookups, fetchData])

  // Process Filter
  const filteredAssessments = useMemo(() => {
    let result = assessments
    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase()
      result = result.filter(a => a.title.toLowerCase().includes(t) || a.students?.name.toLowerCase().includes(t))
    }
    if (filterClass !== 'all') result = result.filter(a => a.class_id === filterClass)
    if (filterSubject !== 'all') result = result.filter(a => a.subject_id === filterSubject)
    return result
  }, [assessments, searchTerm, filterClass, filterSubject])

  // Handlers
  const handleOpenNew = () => {
    setEditingId(null)
    setFormData({
      title: "", description: "", assessment_date: new Date().toISOString().split('T')[0],
      student_id: "", class_id: "", subject_id: "", lesson_id: "", score: "", max_score: ""
    })
    setIsModalOpen(true)
  }

  const handleOpenEdit = (a: Assessment) => {
    setEditingId(a.id)
    setFormData({
      title: a.title,
      description: a.description || "",
      assessment_date: a.assessment_date,
      student_id: a.student_id,
      class_id: a.class_id || "",
      subject_id: a.subject_id || "",
      lesson_id: a.lesson_id || "",
      score: a.score !== null ? a.score.toString() : "",
      max_score: a.max_score !== null ? a.max_score.toString() : ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta avaliação?")) return
    const { error } = await supabase.from("assessments").delete().eq("id", id)
    if (!error) {
      setAssessments(prev => prev.filter(a => a.id !== id))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validations
    if (!formData.title || !formData.student_id || !formData.assessment_date) {
      alert("Preencha os campos obrigatórios: Título, Aluno e Data.")
      return
    }

    const sc = formData.score ? parseFloat(formData.score) : null
    const ms = formData.max_score ? parseFloat(formData.max_score) : null

    if (sc !== null && sc < 0) { alert("A nota não pode ser negativa."); return }
    if (ms !== null && ms <= 0) { alert("A nota máxima deve ser maior que zero."); return }
    if (sc !== null && ms !== null && sc > ms) { alert("A nota não pode ser maior que a nota máxima."); return }

    setSaving(true)

    // Determinar school_id baseado no aluno
    const selStudent = studentsList.find(s => s.id === formData.student_id)
    const activeSchoolId = selStudent ? selStudent.school_id : (currentContext !== 'all' ? currentContext : null)

    const payload = {
      teacher_id: userId,
      school_id: activeSchoolId,
      student_id: formData.student_id,
      class_id: formData.class_id || null,
      subject_id: formData.subject_id || null,
      lesson_id: formData.lesson_id || null,
      title: formData.title,
      description: formData.description || null,
      score: sc,
      max_score: ms,
      assessment_date: formData.assessment_date
    }

    if (editingId) {
      const { data, error } = await supabase.from("assessments").update(payload).eq("id", editingId).select("*, students(name), classes(name), subjects(name)").single()
      if (!error && data) {
        setAssessments(prev => prev.map(a => a.id === editingId ? data as unknown as Assessment : a))
        setIsModalOpen(false)
      } else {
        alert("Erro ao atualizar avaliação.")
      }
    } else {
      const { data, error } = await supabase.from("assessments").insert(payload).select("*, students(name), classes(name), subjects(name)").single()
      if (!error && data) {
        setAssessments(prev => [data as unknown as Assessment, ...prev])
        setIsModalOpen(false)
      } else {
        alert("Erro ao criar avaliação.")
      }
    }
    setSaving(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 mb-2 md:mb-0">
        <Button onClick={handleOpenNew} className="w-full md:w-auto h-10 px-4">
          <Plus className="w-4 h-4 mr-2" /> Nova avaliação
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Buscar por título ou aluno..." 
            className="pl-10 h-10 bg-gray-50 border-transparent focus:bg-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none w-full sm:w-40">
            <option value="all">Todas as turmas</option>
            {classesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none w-full sm:w-40">
            <option value="all">Todas disciplinas</option>
            {subjectsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none w-full sm:w-40">
            <option value="all">Todo o período</option>
            <option value="7">Últimos 7 dias</option>
            <option value="30">Últimos 30 dias</option>
            <option value="90">Últimos 90 dias</option>
          </select>
        </div>
      </div>

      {/* Listagem */}
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
      ) : filteredAssessments.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <Award className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Nenhuma avaliação encontrada</h3>
          <p className="text-gray-500 mt-1 max-w-sm mx-auto">
            Utilize o botão acima para registrar a primeira avaliação.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredAssessments.map(a => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-gray-900 line-clamp-2">{a.title}</h3>
                  {a.score !== null && (
                    <span className="bg-blue-50 text-blue-700 px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ml-2 border border-blue-100">
                      {a.score} {a.max_score ? `/ ${a.max_score}` : ''}
                    </span>
                  )}
                </div>
                
                <div className="space-y-1.5 mt-4">
                  <p className="text-sm font-medium text-gray-700 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" /> {a.students?.name}</p>
                  <p className="text-xs text-gray-500 flex items-center gap-2"><Calendar className="w-4 h-4 text-gray-400" /> {new Date(a.assessment_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>
                  {(a.classes?.name || a.subjects?.name) && (
                    <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-gray-50">
                      {a.classes?.name && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">{a.classes.name}</span>}
                      {a.subjects?.name && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded uppercase">{a.subjects.name}</span>}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="mt-5 pt-3 border-t border-gray-50 flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => handleOpenEdit(a)} className="h-8 px-3 text-xs">
                  <Pencil className="w-3.5 h-3.5 mr-1" /> Editar
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(a.id)} className="h-8 px-2 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova/Editar */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Avaliação" : "Nova Avaliação"}>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">Título da Avaliação *</label>
              <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Prova Bimestral, Trabalho Prático..." />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Aluno *</label>
              <select required value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                <option value="">Selecione um aluno</option>
                {studentsList.map(s => <option key={s.id} value={s.id}>{s.name} {s.class_id ? '' : '(Particular)'}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Data *</label>
              <Input type="date" required value={formData.assessment_date} onChange={e => setFormData({...formData, assessment_date: e.target.value})} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Turma (Opcional)</label>
              <select value={formData.class_id} onChange={e => setFormData({...formData, class_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                <option value="">Nenhuma turma</option>
                {classesList.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Disciplina (Opcional)</label>
              <select value={formData.subject_id} onChange={e => setFormData({...formData, subject_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                <option value="">Nenhuma disciplina</option>
                {subjectsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">Aula Relacionada (Opcional)</label>
              <select value={formData.lesson_id} onChange={e => setFormData({...formData, lesson_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
                <option value="">Nenhuma aula vinculada</option>
                {lessonsList.filter(l => !formData.class_id || l.class_id === formData.class_id).map(l => (
                  <option key={l.id} value={l.id}>{new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {l.title}</option>
                ))}
              </select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <label className="text-sm font-bold text-gray-700">Descrição (Opcional)</label>
              <textarea 
                value={formData.description} 
                onChange={e => setFormData({...formData, description: e.target.value})} 
                className="w-full min-h-[80px] p-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none resize-none"
                placeholder="Detalhes ou anotações sobre a avaliação..."
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Nota (Opcional)</label>
              <Input type="number" step="0.1" min="0" value={formData.score} onChange={e => setFormData({...formData, score: e.target.value})} placeholder="Ex: 8.5" />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Nota Máxima (Opcional)</label>
              <Input type="number" step="0.1" min="0.1" value={formData.max_score} onChange={e => setFormData({...formData, max_score: e.target.value})} placeholder="Ex: 10" />
            </div>
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3 mt-6">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar avaliação"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
