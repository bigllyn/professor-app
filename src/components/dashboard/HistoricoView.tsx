"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { Calendar as CalendarIcon, Clock, User, BookOpen, Users as UsersIcon, Search, Filter } from "lucide-react"

type Assessment = {
  id: string
  title: string
  score: number | null
  max_score: number | null
  student_id: string
}

type LessonStudent = {
  student_id: string | null
  class_id: string | null
  student_name_snapshot: string
  class_name_snapshot: string | null
  attendance_status: 'present' | 'absent' | 'justified'
  attendance_notes: string | null
  performance_level: 'excellent' | 'good' | 'needs_attention' | null
  performance_notes: string | null
}

type LessonContent = {
  id: string
  title: string
  description: string | null
  observations: string | null
  sequence_order: number
}

type HistoryLesson = {
  id: string
  title: string
  description: string | null
  date: string
  start_time: string
  end_time: string
  status: string
  school_id: string | null
  class_id: string | null
  subject_id: string | null
  student_id: string | null
  subjects: { id: string, name: string } | null
  classes: { id: string, name: string } | null
  students: { id: string, name: string } | null
  lesson_students: LessonStudent[]
  lesson_contents: LessonContent[]
  assessments?: Assessment[]
}

type LookupItem = {
  id: string
  name: string
  school_id: string | null
}

export function HistoricoView({ userId, initialContext }: { userId: string, initialContext: string }) {
  const [currentContext, setCurrentContext] = useState(initialContext)
  const supabase = createClient()

  // Sincronizar context (caso mude externamente no App shell, ouvir cookies ou ter um event listener se precisarmos.
  // Por enquanto o Dashboard layout forca remount ou reload na troca, mas pra ser responsivo podemos ler cookie)
  useEffect(() => {
    setCurrentContext(initialContext)
  }, [initialContext])

  // State
  const [lessons, setLessons] = useState<HistoryLesson[]>([])
  const [loading, setLoading] = useState(true)
  
  // Fitros e Buscas
  const [searchTerm, setSearchTerm] = useState("")
  
  // Datas Default: Últimos 30 dias até hoje
  const dToday = new Date()
  const dPast = new Date()
  dPast.setDate(dPast.getDate() - 30)
  
  const formatDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  
  const [startDate, setStartDate] = useState(formatDate(dPast))
  const [endDate, setEndDate] = useState(formatDate(dToday))
  
  const [filterClass, setFilterClass] = useState("")
  const [filterSubject, setFilterSubject] = useState("")
  const [filterStudent, setFilterStudent] = useState("")

  // Lookups para os selects de filtros
  const [classesList, setClassesList] = useState<LookupItem[]>([])
  const [subjectsList, setSubjectsList] = useState<LookupItem[]>([])
  const [studentsList, setStudentsList] = useState<LookupItem[]>([])

  // Modal
  const [selectedLesson, setSelectedLesson] = useState<HistoryLesson | null>(null)

  // Fetch Lookups
  const fetchLookups = useCallback(async () => {
    const [cls, sub, stu] = await Promise.all([
      supabase.from("classes").select("id, name, school_id"),
      supabase.from("subjects").select("id, name, school_id"),
      supabase.from("students").select("id, name, school_id")
    ])
    setClassesList(cls.data || [])
    setSubjectsList(sub.data || [])
    setStudentsList(stu.data || [])
  }, [supabase])

  // Fetch Lessons
  const fetchHistory = useCallback(async () => {
    setLoading(true)
    let query = supabase.from("lessons").select(`
      id, title, description, date, start_time, end_time, status, school_id, class_id, subject_id, student_id,
      subjects(id, name),
      classes(id, name),
      students(id, name),
      lesson_students(student_id, class_id, student_name_snapshot, class_name_snapshot, attendance_status, attendance_notes, performance_level, performance_notes),
      lesson_contents(id, title, description, observations, sequence_order),
      assessments(id, title, score, max_score, student_id)
    `)
    .eq("teacher_id", userId)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date", { ascending: false })
    .order("start_time", { ascending: false })

    if (currentContext === "private") {
      query = query.is("school_id", null)
    } else if (currentContext !== "all") {
      query = query.eq("school_id", currentContext)
    }

    const { data, error } = await query
    if (!error && data) {
      setLessons(data as unknown as HistoryLesson[])
    } else {
      console.error(error)
    }
    setLoading(false)
  }, [currentContext, userId, startDate, endDate, supabase])

  useEffect(() => {
    fetchLookups()
  }, [fetchLookups])

  useEffect(() => {
    fetchHistory()
  }, [fetchHistory])

  // Processar filtros locais
  const filteredLessons = useMemo(() => {
    return lessons.filter(l => {
      // Search
      const term = searchTerm.toLowerCase()
      const matchesSearch = !term || 
        l.title.toLowerCase().includes(term) ||
        l.lesson_contents.some(c => c.title.toLowerCase().includes(term)) ||
        l.lesson_students.some(s => s.student_name_snapshot.toLowerCase().includes(term)) ||
        l.students?.name.toLowerCase().includes(term)

      // Turma (Class)
      const matchesClass = !filterClass || 
        l.lesson_students.some(s => s.class_id === filterClass) || 
        l.class_id === filterClass

      // Disciplina (Subject)
      const matchesSubject = !filterSubject || l.subject_id === filterSubject

      // Aluno (Student)
      const matchesStudent = !filterStudent || 
        l.lesson_students.some(s => s.student_id === filterStudent) || 
        l.student_id === filterStudent

      return matchesSearch && matchesClass && matchesSubject && matchesStudent
    })
  }, [lessons, searchTerm, filterClass, filterSubject, filterStudent])

  // Context Dropdowns (filtrando pelo context switcher)
  const activeSchoolId = currentContext === "private" ? null : currentContext === "all" ? undefined : currentContext
  
  const availableClasses = classesList.filter(c => activeSchoolId === undefined || c.school_id === activeSchoolId)
  const availableSubjects = subjectsList.filter(c => activeSchoolId === undefined || c.school_id === activeSchoolId)
  const availableStudents = studentsList.filter(c => activeSchoolId === undefined || c.school_id === activeSchoolId)

  // Helpers Visuais
  const getDisplayNames = (lesson: HistoryLesson) => {
    let studentNames = "Turma/Geral"
    let classNames = "Sem turma"

    // Resolvendo Aluno(s) (Prioridade para lesson_students, fallback para lesson.student)
    if (lesson.lesson_students && lesson.lesson_students.length > 0) {
      studentNames = lesson.lesson_students.map(s => s.student_name_snapshot).join(", ")
    } else if (lesson.students) {
      studentNames = lesson.students.name
    }

    // Resolvendo Turma (Prioridade para snapshot do 1o lesson_student, fallback para lesson.class)
    if (lesson.lesson_students && lesson.lesson_students.length > 0 && lesson.lesson_students[0].class_name_snapshot) {
      classNames = lesson.lesson_students[0].class_name_snapshot
    } else if (lesson.classes) {
      classNames = lesson.classes.name
    }

    return { studentNames, classNames }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Histórico</h1>
        <p className="text-sm text-gray-500">Veja o histórico das aulas e o acompanhamento dos alunos.</p>
      </div>

      {/* FILTROS */}
      <div className="bg-white p-4 rounded-2xl border border-gray-200 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <Input 
              value={searchTerm} 
              onChange={e => setSearchTerm(e.target.value)} 
              placeholder="Buscar por aluno, conteúdo ou título..." 
              className="pl-10 h-11"
            />
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-11 flex-1 sm:w-36" title="Data Inicial" />
            <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-11 flex-1 sm:w-36" title="Data Final" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-3 border-t border-gray-100">
          <div>
            <select value={filterClass} onChange={e => setFilterClass(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="">Todas as Turmas</option>
              {availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="">Todas as Disciplinas</option>
              {availableSubjects.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="">Todos os Alunos</option>
              {availableStudents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {/* LISTAGEM */}
      <div className="bg-gray-50/50 rounded-3xl min-h-[400px]">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
          </div>
        ) : filteredLessons.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center px-4">
            <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
            <h3 className="text-lg font-medium text-gray-900">Seu histórico aparecerá aqui</h3>
            <p className="text-sm text-gray-500 mt-1 max-w-sm">
              Nenhuma aula encontrada para os filtros selecionados ou conforme você registrar suas aulas.
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {filteredLessons.map(lesson => {
              const { studentNames, classNames } = getDisplayNames(lesson)
              const dateStr = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' }).format(new Date(lesson.date + "T00:00:00"))
              const isCancelled = lesson.status === 'cancelled'

              return (
                <div 
                  key={lesson.id} 
                  onClick={() => setSelectedLesson(lesson)}
                  className={`bg-white border p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row gap-4 ${isCancelled ? 'border-red-100 opacity-70 bg-red-50/20' : 'border-gray-200'}`}
                >
                  <div className={`flex flex-col items-center justify-center rounded-xl p-3 min-w-[90px] border ${isCancelled ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                    <span className={`text-base font-bold ${isCancelled ? 'text-red-700 line-through' : 'text-gray-900'}`}>{dateStr}</span>
                    <span className="text-xs font-medium text-gray-400 mt-0.5">{lesson.start_time.slice(0,5)}</span>
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`text-base font-bold ${isCancelled ? 'text-gray-600' : 'text-gray-900'}`}>{lesson.title}</h3>
                      {isCancelled && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider">Cancelada</span>}
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                      {lesson.subjects && <span className="flex items-center text-sm text-gray-600 gap-1.5"><BookOpen className="w-4 h-4 text-gray-400" />{lesson.subjects.name}</span>}
                      {lesson.classes && <span className="flex items-center text-sm text-gray-600 gap-1.5"><UsersIcon className="w-4 h-4 text-gray-400" />{classNames}</span>}
                      <span className="flex items-center text-sm text-gray-600 gap-1.5 line-clamp-1"><User className="w-4 h-4 text-gray-400 min-w-[16px]" />{studentNames}</span>
                    </div>

                    {lesson.lesson_contents && lesson.lesson_contents.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {lesson.lesson_contents.slice(0, 3).map(c => (
                          <span key={c.id} className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs font-medium">
                            {c.title}
                          </span>
                        ))}
                        {lesson.lesson_contents.length > 3 && (
                          <span className="inline-flex items-center px-2 py-1 rounded-md bg-gray-50 text-gray-500 text-xs font-medium border border-gray-100">
                            +{lesson.lesson_contents.length - 3}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL DE DETALHES */}
      <Modal isOpen={!!selectedLesson} onClose={() => setSelectedLesson(null)} title="Detalhes do Histórico">
        {selectedLesson && (() => {
          const { studentNames, classNames } = getDisplayNames(selectedLesson)
          return (
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-gray-900">{selectedLesson.title}</h2>
                  {selectedLesson.status === 'cancelled' && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase">Cancelada</span>}
                </div>
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <CalendarIcon className="w-4 h-4" />
                  {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(selectedLesson.date + "T00:00:00"))}
                </p>
                <p className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                  <Clock className="w-4 h-4" />{selectedLesson.start_time.slice(0,5)} as {selectedLesson.end_time.slice(0,5)}
                </p>
              </div>

              <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contexto / Local</p>
                  <p className="text-sm font-medium text-gray-900">{selectedLesson.school_id ? "Escola" : "Aula Particular"}</p>
                </div>
                {classNames !== "Sem turma" && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Turma (Registro Histórico)</p>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <UsersIcon className="w-4 h-4 text-gray-400" />{classNames}
                    </p>
                  </div>
                )}
                {selectedLesson.subjects && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Disciplina</p>
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-gray-400" />{selectedLesson.subjects.name}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Aluno(s) Participante(s)</p>
                  {selectedLesson.lesson_students && selectedLesson.lesson_students.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-1">
                      {selectedLesson.lesson_students.map(s => (
                        <div key={s.student_id || s.student_name_snapshot} className="flex flex-col gap-2 bg-white border border-gray-100 rounded-md p-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-gray-900 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />{s.student_name_snapshot}</span>
                            <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${s.attendance_status === 'present' ? 'bg-green-100 text-green-700' : s.attendance_status === 'absent' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                              {s.attendance_status === 'present' ? 'Presente' : s.attendance_status === 'absent' ? 'Ausente' : 'Justificado'}
                            </span>
                          </div>
                          {s.performance_level && (
                            <div className="flex items-center justify-between border-t border-gray-50 pt-2 mt-1">
                              <span className="text-xs text-gray-500">Desempenho:</span>
                              <span className={`text-xs font-bold ${s.performance_level === 'excellent' ? 'text-green-600' : s.performance_level === 'good' ? 'text-blue-600' : 'text-orange-600'}`}>
                                {s.performance_level === 'excellent' ? 'Excelente' : s.performance_level === 'good' ? 'Bom' : 'Precisa de atenção'}
                              </span>
                            </div>
                          )}
                          {s.performance_notes && (
                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded-md mt-1 italic">
                              "{s.performance_notes}"
                            </div>
                          )}
                          {selectedLesson.assessments && selectedLesson.assessments.filter(a => a.student_id === s.student_id).length > 0 && (
                            <div className="mt-2 space-y-1">
                              {selectedLesson.assessments.filter(a => a.student_id === s.student_id).map(a => (
                                <div key={a.id} className="bg-purple-50 text-purple-800 p-2 rounded-md border border-purple-100 flex items-center justify-between">
                                  <span className="text-xs font-bold truncate pr-2">{a.title}</span>
                                  {a.score !== null && (
                                    <span className="text-[10px] font-black bg-white px-1.5 py-0.5 rounded text-purple-700">
                                      {a.score} {a.max_score ? `/ ${a.max_score}` : ''}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm font-medium text-gray-900 flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400 min-w-[16px]" />{studentNames}
                    </p>
                  )}
                </div>
              </div>

              {selectedLesson.description && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Anotações Gerais da Aula</p>
                  <div className="bg-white p-3 rounded-lg border border-gray-200 text-sm text-gray-800 whitespace-pre-wrap">
                    {selectedLesson.description}
                  </div>
                </div>
              )}

              {/* CONTEÚDOS TRABALHADOS */}
              <div className="mt-8 border-t border-gray-100 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Conteúdos Pedagógicos</h3>
                
                {!selectedLesson.lesson_contents || selectedLesson.lesson_contents.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                    <p className="text-sm text-gray-500">Nenhum conteúdo registrado para esta aula.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedLesson.lesson_contents.map((c, i) => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                        <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                          <span className="flex items-center justify-center bg-gray-100 text-gray-600 text-[10px] w-5 h-5 rounded-full">{c.sequence_order + 1}</span>
                          {c.title}
                        </h4>
                        {c.description && <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap">{c.description}</p>}
                        {c.observations && (
                          <div className="mt-3 bg-amber-50 text-amber-800 text-xs p-3 rounded-lg border border-amber-100 whitespace-pre-wrap">
                            <strong>Obs do Professor:</strong> {c.observations}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </Modal>
    </div>
  )
}
