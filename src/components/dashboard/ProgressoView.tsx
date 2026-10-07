"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Search, User, Filter, BookOpen, UsersIcon, Calendar, Activity, X, TrendingUp, ChevronRight, CheckCircle, AlertCircle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

// Tipos
type StudentItem = {
  id: string
  name: string
  class_id: string | null
  school_id: string | null
  classes: { name: string } | null
}

type LessonContent = {
  id: string
  title: string
  description: string | null
  observations: string | null
  sequence_order: number
}

type ProgressLessonStudent = {
  id: string
  student_id: string | null
  attendance_status: 'present' | 'absent' | 'justified'
  performance_level: 'excellent' | 'good' | 'needs_attention' | null
  performance_notes: string | null
  student_name_snapshot: string
  class_name_snapshot: string | null
  lessons: {
    id: string
    date: string
    start_time: string
    end_time: string
    status: string
    school_id: string | null
    subject_id: string | null
    subjects: { name: string } | null
    lesson_contents: LessonContent[]
  }
}

// Agrupamento Processado
type StudentProgress = {
  student: StudentItem
  totalLessons: number
  presents: number
  absents: number
  justified: number
  performancesRecorded: number
  totalAssessments: number
  history: ProgressLessonStudent[]
}

// Modal Simples
function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-gray-500 hover:bg-gray-100 rounded-full w-8 h-8">
            <X className="w-4 h-4" />
          </Button>
        </div>
        <div className="p-4 md:p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

export default function ProgressoView({ userId, initialContext }: { userId: string, initialContext: string }) {
  const supabase = createClient()
  const [currentContext, setCurrentContext] = useState(initialContext)
  
  // Data
  const [students, setStudents] = useState<StudentItem[]>([])
  const [historyRecords, setHistoryRecords] = useState<ProgressLessonStudent[]>([])
  const [loading, setLoading] = useState(true)

  // Lookups
  const [classesList, setClassesList] = useState<{id: string, name: string}[]>([])
  const [subjectsList, setSubjectsList] = useState<{id: string, name: string}[]>([])

  // Filtros
  const [searchTerm, setSearchTerm] = useState("")
  const [filterClass, setFilterClass] = useState("all")
  const [filterSubject, setFilterSubject] = useState("all")
  const [dateRange, setDateRange] = useState("all") // all, 7, 30, 90

  // Seleção Modal
  const [selectedStudentProg, setSelectedStudentProg] = useState<StudentProgress | null>(null)

  // Listen context
  useEffect(() => {
    const handleContextChange = (e: any) => setCurrentContext(e.detail)
    window.addEventListener('context_changed', handleContextChange)
    return () => window.removeEventListener('context_changed', handleContextChange)
  }, [])

  const [assessmentsRecords, setAssessmentsRecords] = useState<{id: string, student_id: string}[]>([])

  // Fetch Lookups
  useEffect(() => {
    async function loadLookups() {
      let qC = supabase.from("classes").select("id, name, school_id").eq("teacher_id", userId)
      let qS = supabase.from("subjects").select("id, name, school_id").eq("teacher_id", userId)
      
      if (currentContext !== 'all' && currentContext !== 'private') {
        qC = qC.eq("school_id", currentContext)
        qS = qS.eq("school_id", currentContext)
      }

      const [resC, resS] = await Promise.all([qC, qS])
      if (resC.data) setClassesList(resC.data)
      if (resS.data) setSubjectsList(resS.data)
    }
    loadLookups()
  }, [userId, currentContext, supabase])

  // Fetch Core Data
  const fetchData = useCallback(async () => {
    setLoading(true)

    // 1. Fetch Students (Apenas alunos vivos)
    let stQuery = supabase.from("students").select("id, name, class_id, school_id, classes(name)").eq("teacher_id", userId).order("name")
    if (currentContext === 'private') stQuery = stQuery.is("school_id", null)
    else if (currentContext !== 'all') stQuery = stQuery.eq("school_id", currentContext)
    
    // 2. Fetch Lesson Students (com os joins)
    let lsQuery = supabase.from("lesson_students").select(`
      id, student_id, attendance_status, performance_level, performance_notes, student_name_snapshot, class_name_snapshot,
      lessons!inner(
        id, date, start_time, end_time, status, school_id, subject_id,
        subjects(name),
        lesson_contents(id, title, description, observations, sequence_order)
      )
    `)
    .eq("teacher_id", userId)
    .neq("lessons.status", "cancelled")

    if (currentContext === 'private') lsQuery = lsQuery.is("lessons.school_id", null)
    else if (currentContext !== 'all') lsQuery = lsQuery.eq("lessons.school_id", currentContext)

    let assQuery = supabase.from("assessments").select("id, student_id, school_id, assessment_date").eq("teacher_id", userId)
    if (currentContext === 'private') assQuery = assQuery.is("school_id", null)
    else if (currentContext !== 'all') assQuery = assQuery.eq("school_id", currentContext)

    // Filtro de data
    if (dateRange !== 'all') {
      const d = new Date()
      d.setDate(d.getDate() - parseInt(dateRange))
      const dateStr = d.toISOString().split('T')[0]
      lsQuery = lsQuery.gte("lessons.date", dateStr)
      assQuery = assQuery.gte("assessment_date", dateStr)
    }

    const [stRes, lsRes, assRes] = await Promise.all([stQuery, lsQuery, assQuery])
    
    if (stRes.data) setStudents(stRes.data as unknown as StudentItem[])
    if (lsRes.data) setHistoryRecords(lsRes.data as unknown as ProgressLessonStudent[])
    if (assRes.data) setAssessmentsRecords(assRes.data)
    
    setLoading(false)
  }, [userId, currentContext, dateRange, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Process and group data
  const progressData = useMemo(() => {
    // Inicializa todos os alunos do contexto atual
    const map = new Map<string, StudentProgress>()
    students.forEach(st => {
      map.set(st.id, {
        student: st,
        totalLessons: 0,
        presents: 0,
        absents: 0,
        justified: 0,
        performancesRecorded: 0,
        totalAssessments: 0,
        history: []
      })
    })

    // Agrupa os registros históricos
    historyRecords.forEach(record => {
      // Ignorar registros órfãos que não pertencem a um student_id mapeado (ex: deletados)
      if (!record.student_id || !map.has(record.student_id)) return
      
      const stProg = map.get(record.student_id)!
      
      // Filtros em memória (Turma e Disciplina) - Aplicados aqui para refletir na contagem
      if (filterClass !== 'all' && stProg.student.class_id !== filterClass) return
      if (filterSubject !== 'all' && record.lessons.subject_id !== filterSubject) return

      stProg.history.push(record)
      stProg.totalLessons++
      if (record.attendance_status === 'present') stProg.presents++
      else if (record.attendance_status === 'absent') stProg.absents++
      else if (record.attendance_status === 'justified') stProg.justified++

      if (record.performance_level) stProg.performancesRecorded++
    })

    // Agrupa as avaliações
    assessmentsRecords.forEach(ass => {
      if (!map.has(ass.student_id)) return
      map.get(ass.student_id)!.totalAssessments++
    })

    // Converter para array e aplicar busca
    let result = Array.from(map.values())
    
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase()
      result = result.filter(p => p.student.name.toLowerCase().includes(term))
    }

    // Filtros que removem o aluno inteiro caso ele não passe (Turma)
    if (filterClass !== 'all') {
      result = result.filter(p => p.student.class_id === filterClass)
    }

    // Ordenar: primeiro quem tem mais aulas
    result.sort((a, b) => b.totalLessons - a.totalLessons || a.student.name.localeCompare(b.student.name))

    return result
  }, [students, historyRecords, searchTerm, filterClass, filterSubject])

  // Helpers de Renderização
  const renderPerfBadge = (level: string) => {
    if (level === 'excellent') return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Excelente</span>
    if (level === 'good') return <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Bom</span>
    if (level === 'needs_attention') return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Atenção</span>
    return null
  }

  const renderAttBadge = (status: string) => {
    if (status === 'present') return <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Presente</span>
    if (status === 'absent') return <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Ausente</span>
    if (status === 'justified') return <span className="bg-orange-100 text-orange-700 px-2 py-0.5 rounded text-[10px] font-bold uppercase">Justificado</span>
    return null
  }

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <Input 
            placeholder="Buscar aluno..." 
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

      {/* Tabela / Cards de Alunos */}
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
      ) : progressData.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Nenhum aluno encontrado</h3>
          <p className="text-gray-500 mt-1 max-w-sm mx-auto">
            Não há alunos para os filtros selecionados ou você ainda não possui alunos cadastrados neste contexto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {progressData.map(prog => (
            <div 
              key={prog.student.id} 
              onClick={() => setSelectedStudentProg(prog)}
              className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md hover:border-gray-300 transition-all cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="bg-blue-50 text-blue-600 p-2.5 rounded-xl">
                      <User className="w-5 h-5" />
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 line-clamp-1">{prog.student.name}</h3>
                      {prog.student.classes?.name && <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5"><UsersIcon className="w-3 h-3" /> {prog.student.classes.name}</p>}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 mt-4">
                  <div className="bg-gray-50 rounded-lg p-2.5 flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-gray-500 tracking-wider">Aulas</span>
                    <span className="text-lg font-black text-gray-900 leading-none mt-1">{prog.totalLessons}</span>
                  </div>
                  <div className="bg-green-50 rounded-lg p-2.5 flex flex-col">
                    <span className="text-[10px] uppercase font-bold text-green-700 tracking-wider">Presenças</span>
                    <span className="text-lg font-black text-green-700 leading-none mt-1">{prog.presents}</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 pt-3 border-t border-gray-50 flex items-center justify-between text-xs font-medium text-gray-500 group">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1.5" title="Anotações de desempenho"><Activity className="w-3.5 h-3.5" /> {prog.performancesRecorded}</span>
                  <span className="flex items-center gap-1.5" title="Avaliações formais">Avaliações: {prog.totalAssessments}</span>
                </div>
                <span className="flex items-center text-blue-600 group-hover:text-blue-700">Ver detalhes <ChevronRight className="w-4 h-4 ml-0.5" /></span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal de Detalhes do Aluno */}
      <Modal isOpen={!!selectedStudentProg} onClose={() => setSelectedStudentProg(null)} title={`Progresso: ${selectedStudentProg?.student.name}`}>
        {selectedStudentProg && (
          <div className="space-y-8">
            {/* Resumo */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                <p className="text-[10px] font-bold text-gray-500 uppercase mb-1">Aulas</p>
                <p className="text-xl font-black text-gray-900">{selectedStudentProg.totalLessons}</p>
              </div>
              <div className="bg-green-50 p-4 rounded-xl border border-green-100 text-center">
                <p className="text-[10px] font-bold text-green-700 uppercase mb-1">Presenças</p>
                <p className="text-xl font-black text-green-700">{selectedStudentProg.presents}</p>
              </div>
              <div className="bg-red-50 p-4 rounded-xl border border-red-100 text-center">
                <p className="text-[10px] font-bold text-red-700 uppercase mb-1">Faltas</p>
                <p className="text-xl font-black text-red-700">{selectedStudentProg.absents}</p>
              </div>
              <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 text-center">
                <p className="text-[10px] font-bold text-blue-700 uppercase mb-1">Desempenho</p>
                <p className="text-xl font-black text-blue-700">{selectedStudentProg.performancesRecorded}</p>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 text-center sm:col-span-1 col-span-2">
                <p className="text-[10px] font-bold text-purple-700 uppercase mb-1">Avaliações</p>
                <p className="text-xl font-black text-purple-700">{selectedStudentProg.totalAssessments}</p>
              </div>
            </div>

            {/* Histórico Cronológico */}
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-gray-400" />
                Histórico de Aulas
              </h3>

              {selectedStudentProg.history.length === 0 ? (
                <div className="text-center py-10 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                  <p className="text-sm font-medium text-gray-500">Este aluno ainda não possui histórico suficiente para apresentar um progresso.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedStudentProg.history.sort((a,b) => new Date(b.lessons.date).getTime() - new Date(a.lessons.date).getTime()).map((record) => (
                    <div key={record.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                      {/* Cabecalho Aula */}
                      <div className="bg-gray-50 px-4 py-3 border-b border-gray-100 flex flex-wrap gap-y-2 items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                            <Clock className="w-4 h-4 text-gray-400" />
                            {new Date(record.lessons.date + 'T12:00:00').toLocaleDateString('pt-BR')}
                          </span>
                          {record.lessons.subjects?.name && (
                            <span className="text-xs font-medium text-gray-600 flex items-center gap-1">
                              <BookOpen className="w-3.5 h-3.5" />
                              {record.lessons.subjects.name}
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          {renderAttBadge(record.attendance_status)}
                          {record.performance_level && renderPerfBadge(record.performance_level)}
                        </div>
                      </div>

                      {/* Corpo (Desempenho e Conteúdos) */}
                      <div className="p-4 space-y-4">
                        {/* Observações de Desempenho */}
                        {record.performance_notes && (
                          <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100">
                            <p className="text-xs font-bold text-amber-800 uppercase mb-1 flex items-center gap-1.5"><AlertCircle className="w-3.5 h-3.5" /> Observação do Professor</p>
                            <p className="text-sm text-gray-700 italic">"{record.performance_notes}"</p>
                          </div>
                        )}

                        {/* Conteúdos */}
                        {record.lessons.lesson_contents && record.lessons.lesson_contents.length > 0 && (
                          <div>
                            <p className="text-xs font-bold text-gray-500 uppercase mb-2">Conteúdos Trabalhados</p>
                            <ul className="space-y-2">
                              {record.lessons.lesson_contents.sort((a,b) => a.sequence_order - b.sequence_order).map(content => (
                                <li key={content.id} className="flex items-start gap-2 text-sm text-gray-800">
                                  <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                                  <span>
                                    <span className="font-medium">{content.title}</span>
                                    {content.description && <span className="text-gray-500 ml-1">- {content.description}</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
