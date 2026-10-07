"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Modal } from "@/components/ui/modal"
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User, BookOpen, Plus, Edit2, Trash2 } from "lucide-react"

type Lesson = {
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
  classes: { name: string } | null
  subjects: { name: string } | null
  students: { name: string } | null
  private_lesson_finances?: {
    id: string
    amount: number
    status: 'pending' | 'paid' | 'cancelled'
  }[]
  lesson_students?: {
    id: string
    student_id: string | null
    class_id: string | null
    student_name_snapshot: string
    class_name_snapshot: string | null
    attendance_status: 'present' | 'absent' | 'justified'
    attendance_notes: string | null
    performance_level: 'excellent' | 'good' | 'needs_attention' | null
    performance_notes: string | null
  }[]
}

type LessonContent = {
  id: string
  title: string
  description: string | null
  observations: string | null
  sequence_order: number
}

type LookupData = {
  schools: { id: string, name: string }[]
  classes: { id: string, name: string, school_id: string | null }[]
  subjects: { id: string, name: string, school_id: string | null }[]
  students: { id: string, name: string, school_id: string | null }[]
}

export function AgendaView({ 
  initialLessons, 
  currentContext, 
  userId, 
  initialDate 
}: { 
  initialLessons: any[]
  currentContext: string
  userId: string
  initialDate: string
}) {
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day')
  const [currentDateStr, setCurrentDateStr] = useState<string>(initialDate)
  const [lessons, setLessons] = useState<Lesson[]>(initialLessons)
  const [loading, setLoading] = useState(false)
  const [isInitialMount, setIsInitialMount] = useState(true)

  const supabase = createClient()

  // Modal State
  const [activeModal, setActiveModal] = useState<'none' | 'create' | 'details' | 'edit'>('none')
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null)
  
  const [lookups, setLookups] = useState<LookupData | null>(null)
  const [loadingLookups, setLoadingLookups] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState("")

  const [formData, setFormData] = useState({
    title: "",
    date: "",
    start_time: "",
    end_time: "",
    school_id: "",
    class_id: "",
    subject_id: "",
    student_id: "",
    description: "",
    status: "scheduled"
  })

  // Lesson Contents State
  const [lessonContents, setLessonContents] = useState<LessonContent[]>([])
  const [loadingContents, setLoadingContents] = useState(false)
  const [contentFormMode, setContentFormMode] = useState<'list' | 'add' | 'edit'>('list')
  const [selectedContent, setSelectedContent] = useState<LessonContent | null>(null)
  const [savingContent, setSavingContent] = useState(false)
  const [contentFormError, setContentFormError] = useState("")
  const [contentFormData, setContentFormData] = useState({
    title: "",
    description: "",
    observations: ""
  })

  // Lesson Students State
  const [studentFormMode, setStudentFormMode] = useState<'list' | 'manage'>('list')
  const [classStudents, setClassStudents] = useState<{id: string, name: string}[]>([])
  const [loadingStudents, setLoadingStudents] = useState(false)
  const [attendanceDraft, setAttendanceDraft] = useState<Record<string, {status: 'present' | 'absent' | 'justified'}>>({})
  const [savingAttendance, setSavingAttendance] = useState(false)
  
  const [performanceDraft, setPerformanceDraft] = useState<Record<string, {level: 'excellent' | 'good' | 'needs_attention' | null, notes: string}>>({})
  const [savingPerformance, setSavingPerformance] = useState(false)

  // Helpers de Data
  const getTodayStr = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const addDays = (dateStr: string, days: number) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    date.setDate(date.getDate() + days)
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  }

  const getWeekRange = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    const day = date.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    const monday = new Date(date)
    monday.setDate(date.getDate() + diffToMonday)
    
    const sunday = new Date(monday)
    sunday.setDate(monday.getDate() + 6)
    
    const format = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
    
    return { start: format(monday), end: format(sunday), monday, sunday }
  }

  const formatDisplayDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number)
    const date = new Date(y, m - 1, d)
    return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)
  }

  const formatDisplayWeek = (dateStr: string) => {
    const { monday, sunday } = getWeekRange(dateStr)
    const formatterDay = new Intl.DateTimeFormat('pt-BR', { day: '2-digit' })
    const formatterFull = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })
    
    if (monday.getMonth() === sunday.getMonth()) {
       return `${formatterDay.format(monday)} — ${formatterFull.format(sunday)}`
    } else if (monday.getFullYear() === sunday.getFullYear()) {
       const fmtDayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
       return `${fmtDayMonth.format(monday)} — ${formatterFull.format(sunday)}`
    } else {
       const fmtFullShort = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
       return `${fmtFullShort.format(monday)} — ${formatterFull.format(sunday)}`
    }
  }

  const fetchLessons = useCallback(async (dateStr: string, mode: 'day' | 'week') => {
    setLoading(true)
    let query = supabase.from("lessons")
      .select("id, title, description, date, start_time, end_time, status, school_id, class_id, subject_id, student_id, classes(name), subjects(name), students(name), private_lesson_finances(id, amount, status), lesson_students(id, student_id, class_id, student_name_snapshot, class_name_snapshot, attendance_status, attendance_notes, performance_level, performance_notes)")
      .eq("teacher_id", userId)
      .order("date")
      .order("start_time")
    
    if (mode === 'day') {
      query = query.eq("date", dateStr)
    } else {
      const { start, end } = getWeekRange(dateStr)
      query = query.gte("date", start).lte("date", end)
    }

    if (currentContext !== "all") {
      if (currentContext === "private") query = query.is("school_id", null)
      else query = query.eq("school_id", currentContext)
    }

    const { data, error } = await query
    if (!error && data) {
      setLessons(data as any)
    }
    setLoading(false)
  }, [currentContext, userId, supabase])

  useEffect(() => {
    if (isInitialMount) {
      setIsInitialMount(false)
      return
    }
    fetchLessons(currentDateStr, viewMode)
  }, [currentDateStr, viewMode, currentContext, fetchLessons])

  const handlePrev = () => setCurrentDateStr(prev => addDays(prev, viewMode === 'week' ? -7 : -1))
  const handleNext = () => setCurrentDateStr(prev => addDays(prev, viewMode === 'week' ? 7 : 1))
  const handleToday = () => setCurrentDateStr(getTodayStr())

  const loadLookupsIfNeeded = async () => {
    if (!lookups) {
      setLoadingLookups(true)
      const [schRes, clsRes, subRes, stuRes] = await Promise.all([
        supabase.from("teacher_schools").select("school_id, schools(id, name)").eq("status", "active"),
        supabase.from("classes").select("id, name, school_id"),
        supabase.from("subjects").select("id, name, school_id"),
        supabase.from("students").select("id, name, school_id")
      ])
      
      const schools = schRes.data?.map((ts: any) => ({
        id: ts.school_id,
        name: ts.schools?.name || "Escola Desconhecida"
      })) || []

      setLookups({
        schools,
        classes: clsRes.data || [],
        subjects: subRes.data || [],
        students: stuRes.data || []
      })
      setLoadingLookups(false)
    }
  }

  // --- Fetch Lesson Contents ---
  const fetchLessonContents = async (lessonId: string) => {
    setLoadingContents(true)
    const { data, error } = await supabase
      .from("lesson_contents")
      .select("id, title, description, observations, sequence_order")
      .eq("lesson_id", lessonId)
      .order("sequence_order", { ascending: true })
      .order("created_at", { ascending: true })

    if (!error && data) {
      setLessonContents(data)
    }
    setLoadingContents(false)
  }

  // --- Modals Base ---
  const openCreateModal = async () => {
    const initSchoolId = currentContext === "all" ? "" : currentContext === "private" ? "private" : currentContext
    
    setFormData({
      title: "", date: currentDateStr, start_time: "08:00", end_time: "09:00",
      school_id: initSchoolId, class_id: "", subject_id: "", student_id: "",
      description: "", status: "scheduled"
    })
    setFormError("")
    setActiveModal('create')
    await loadLookupsIfNeeded()
  }

  const openDetailsModal = (lesson: Lesson) => {
    setSelectedLesson(lesson)
    setActiveModal('details')
    setContentFormMode('list')
    setStudentFormMode('list')
    
    // Configurar o draft de presença e desempenho
    const draft: Record<string, {status: 'present'|'absent'|'justified'}> = {}
    const perfDraft: Record<string, {level: 'excellent'|'good'|'needs_attention'|null, notes: string}> = {}
    lesson.lesson_students?.forEach(s => {
      draft[s.id] = { status: s.attendance_status || 'present' }
      perfDraft[s.id] = { level: s.performance_level || null, notes: s.performance_notes || "" }
    })
    setAttendanceDraft(draft)
    setPerformanceDraft(perfDraft)

    fetchLessonContents(lesson.id)
  }

  const openEditModal = async () => {
    if (!selectedLesson) return
    setFormData({
      title: selectedLesson.title, date: selectedLesson.date,
      start_time: selectedLesson.start_time.slice(0,5), end_time: selectedLesson.end_time.slice(0,5),
      school_id: selectedLesson.school_id === null ? "private" : selectedLesson.school_id,
      class_id: selectedLesson.class_id || "", subject_id: selectedLesson.subject_id || "", student_id: selectedLesson.student_id || "",
      description: selectedLesson.description || "", status: selectedLesson.status || "scheduled"
    })
    setFormError("")
    setActiveModal('edit')
    await loadLookupsIfNeeded()
  }

  // --- Content Form Handlers ---
  const openAddContent = () => {
    setContentFormData({ title: "", description: "", observations: "" })
    setContentFormError("")
    setContentFormMode('add')
  }

  const openEditContent = (c: LessonContent) => {
    setSelectedContent(c)
    setContentFormData({
      title: c.title,
      description: c.description || "",
      observations: c.observations || ""
    })
    setContentFormError("")
    setContentFormMode('edit')
  }

  const handleContentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedLesson) return
    if (!contentFormData.title.trim()) {
      setContentFormError("O título é obrigatório.")
      return
    }

    setSavingContent(true)
    setContentFormError("")

    const payload = {
      title: contentFormData.title,
      description: contentFormData.description || null,
      observations: contentFormData.observations || null
    }

    if (contentFormMode === 'add') {
      const nextOrder = lessonContents.length > 0 ? Math.max(...lessonContents.map(c => c.sequence_order)) + 1 : 0
      const insertPayload = {
        ...payload,
        lesson_id: selectedLesson.id,
        teacher_id: userId,
        school_id: selectedLesson.school_id,
        sequence_order: nextOrder
      }

      const { data, error } = await supabase.from("lesson_contents").insert(insertPayload).select().single()
      if (error) setContentFormError("Erro ao adicionar: " + error.message)
      else {
        setLessonContents([...lessonContents, data as any])
        setContentFormMode('list')
      }
    } else if (contentFormMode === 'edit' && selectedContent) {
      const { data, error } = await supabase.from("lesson_contents").update(payload).eq("id", selectedContent.id).select().single()
      if (error) setContentFormError("Erro ao atualizar: " + error.message)
      else {
        setLessonContents(lessonContents.map(c => c.id === selectedContent.id ? (data as any) : c))
        setContentFormMode('list')
      }
    }
    setSavingContent(false)
  }

  const handleDeleteContent = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este conteúdo?")) return
    setSavingContent(true)
    const { error } = await supabase.from("lesson_contents").delete().eq("id", id)
    if (!error) {
      setLessonContents(lessonContents.filter(c => c.id !== id))
    } else {
      alert("Erro ao excluir: " + error.message)
    }
    setSavingContent(false)
  }

  // --- Manage Participants ---
  const openManageStudents = async () => {
    if (!selectedLesson || !selectedLesson.class_id) return
    setStudentFormMode('manage')
    setLoadingStudents(true)
    const { data } = await supabase.from("students").select("id, name").eq("class_id", selectedLesson.class_id).eq("status", "active")
    if (data) setClassStudents(data)
    setLoadingStudents(false)
  }

  const handleAddParticipant = async (studentId: string, studentName: string) => {
    if (!selectedLesson) return
    setSaving(true)
    const payload = {
      lesson_id: selectedLesson.id,
      student_id: studentId,
      teacher_id: userId,
      school_id: selectedLesson.school_id,
      class_id: selectedLesson.class_id,
      student_name_snapshot: studentName,
      class_name_snapshot: selectedLesson.classes?.name || null
    }
    const { error, data } = await supabase.from("lesson_students").insert(payload).select().single()
    if (!error && data) {
      const updatedLesson = { ...selectedLesson }
      if (!updatedLesson.lesson_students) updatedLesson.lesson_students = []
      updatedLesson.lesson_students.push(data as any)
      setSelectedLesson(updatedLesson)
      setLessons(prev => prev.map(l => l.id === selectedLesson.id ? updatedLesson : l))
    }
    setSaving(false)
  }

  const handleRemoveParticipant = async (lessonStudentId: string) => {
    if (!selectedLesson) return
    if (!confirm("Tem certeza que deseja remover este participante desta aula?")) return
    setSaving(true)
    const { error } = await supabase.from("lesson_students").delete().eq("id", lessonStudentId)
    if (!error) {
      const updatedLesson = { ...selectedLesson }
      updatedLesson.lesson_students = (updatedLesson.lesson_students || []).filter(s => s.id !== lessonStudentId)
      setSelectedLesson(updatedLesson)
      setLessons(prev => prev.map(l => l.id === selectedLesson.id ? updatedLesson : l))
    }
    setSaving(false)
  }

  const handleSaveAttendance = async () => {
    if (!selectedLesson || !selectedLesson.lesson_students) return
    setSavingAttendance(true)
    
    // Atualizar cada lesson_student alterado
    const promises = selectedLesson.lesson_students.map(async (ls) => {
      const draft = attendanceDraft[ls.id]
      if (draft && draft.status !== ls.attendance_status) {
        return supabase.from("lesson_students").update({ attendance_status: draft.status }).eq("id", ls.id)
      }
      return null
    }).filter(p => p !== null)

    await Promise.all(promises)
    
    const updatedLesson = { ...selectedLesson }
    updatedLesson.lesson_students = (updatedLesson.lesson_students || []).map(ls => ({
      ...ls,
      attendance_status: attendanceDraft[ls.id]?.status || ls.attendance_status
    }))
    
    setSelectedLesson(updatedLesson)
    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? updatedLesson : l))
    setSavingAttendance(false)
    alert("Presença salva com sucesso.")
  }

  const handleSavePerformance = async () => {
    if (!selectedLesson || !selectedLesson.lesson_students) return
    setSavingPerformance(true)
    
    const promises = selectedLesson.lesson_students.map(async (ls) => {
      const draft = performanceDraft[ls.id]
      if (draft && (draft.level !== ls.performance_level || draft.notes !== (ls.performance_notes || ""))) {
        return supabase.from("lesson_students").update({ 
          performance_level: draft.level, 
          performance_notes: draft.notes || null 
        }).eq("id", ls.id)
      }
      return null
    }).filter(p => p !== null)

    await Promise.all(promises)
    
    const updatedLesson = { ...selectedLesson }
    updatedLesson.lesson_students = (updatedLesson.lesson_students || []).map(ls => ({
      ...ls,
      performance_level: performanceDraft[ls.id]?.level !== undefined ? performanceDraft[ls.id].level : ls.performance_level,
      performance_notes: performanceDraft[ls.id]?.notes !== undefined ? performanceDraft[ls.id].notes : ls.performance_notes
    }))
    
    setSelectedLesson(updatedLesson)
    setLessons(prev => prev.map(l => l.id === selectedLesson.id ? updatedLesson : l))
    setSavingPerformance(false)
    alert("Desempenho salvo com sucesso.")
  }

  // --- Lesson Handlers ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setFormError("")

    if (!formData.title.trim() || !formData.date || !formData.start_time || !formData.end_time) {
      setFormError("Preencha todos os campos obrigatórios.")
      setSaving(false)
      return
    }

    if (formData.end_time <= formData.start_time) {
      setFormError("A hora de término deve ser maior que a hora de início.")
      setSaving(false)
      return
    }

    if (activeModal === 'create' && currentContext === "all" && formData.school_id === "") {
      setFormError("Selecione um contexto para a aula.")
      setSaving(false)
      return
    }

    const finalSchoolId = formData.school_id === "private" ? null : formData.school_id

    const payload = {
      title: formData.title, description: formData.description || null,
      date: formData.date, start_time: formData.start_time, end_time: formData.end_time,
      class_id: formData.class_id || null, subject_id: formData.subject_id || null, student_id: formData.student_id || null,
      status: formData.status
    }

    if (activeModal === 'create') {
      const { data: newLesson, error } = await supabase.from("lessons").insert({
        ...payload, teacher_id: userId, school_id: finalSchoolId
      }).select().single()

      if (error) {
        setFormError("Erro ao agendar: " + error.message)
      } else {
        // --- ADD LESSON_STUDENTS HERE ---
        if (payload.class_id) {
           const { data: studentsOfClass } = await supabase.from("students").select("id, name").eq("class_id", payload.class_id).eq("status", "active")
           const clazzName = lookups?.classes.find(c => c.id === payload.class_id)?.name || "Turma"
           if (studentsOfClass && studentsOfClass.length > 0) {
             const lsPayload = studentsOfClass.map(s => ({
               lesson_id: newLesson.id,
               student_id: s.id,
               teacher_id: userId,
               school_id: finalSchoolId,
               class_id: payload.class_id,
               student_name_snapshot: s.name,
               class_name_snapshot: clazzName
             }))
             await supabase.from("lesson_students").insert(lsPayload)
           }
        } else if (payload.student_id) {
           const studentName = lookups?.students.find(s => s.id === payload.student_id)?.name || "Aluno"
           await supabase.from("lesson_students").insert({
               lesson_id: newLesson.id,
               student_id: payload.student_id,
               teacher_id: userId,
               school_id: finalSchoolId,
               class_id: null,
               student_name_snapshot: studentName,
               class_name_snapshot: null
           })
        }

        fetchLessons(currentDateStr, viewMode)
        setActiveModal('none')
      }
    } else if (activeModal === 'edit' && selectedLesson) {
      const { data, error } = await supabase.from("lessons").update(payload).eq("id", selectedLesson.id).select("*, classes(name), subjects(name), students(name)").single()
      if (error) setFormError("Erro ao atualizar: " + error.message)
      else {
        fetchLessons(currentDateStr, viewMode)
        setActiveModal('none')
        setSelectedLesson(data as any)
      }
    }
    setSaving(false)
  }

  const handleCancelLesson = async () => {
    if (!selectedLesson) return
    if (!confirm("Tem certeza que deseja cancelar esta aula? O registro será mantido no histórico como cancelado.")) return
    
    setSaving(true)
    const { error, data } = await supabase.from("lessons").update({ status: 'cancelled' }).eq("id", selectedLesson.id).select("*, classes(name), subjects(name), students(name)").single()
    if (error) setFormError("Erro ao cancelar: " + error.message)
    else {
      setLessons(prev => prev.map(l => l.id === selectedLesson.id ? (data as any) : l))
      setSelectedLesson(data as any)
      setActiveModal('details')
    }
    setSaving(false)
  }

  const activeSchoolId = formData.school_id === "private" ? null : formData.school_id === "" ? null : formData.school_id
  const availableClasses = lookups?.classes.filter(c => c.school_id === activeSchoolId) || []
  const availableSubjects = lookups?.subjects.filter(c => c.school_id === activeSchoolId) || []
  const availableStudents = lookups?.students.filter(c => c.school_id === activeSchoolId) || []

  const getSchoolName = (id: string | null) => {
    if (id === null) return "Aula Particular"
    return lookups?.schools.find(s => s.id === id)?.name || "Escola"
  }

  // -- Components --
  const LessonCard = ({ lesson }: { lesson: Lesson }) => {
    const start = lesson.start_time.slice(0, 5)
    const end = lesson.end_time.slice(0, 5)
    const isCancelled = lesson.status === 'cancelled'
    
    return (
      <div 
        onClick={() => openDetailsModal(lesson)}
        className={`bg-white border p-4 rounded-2xl shadow-sm hover:shadow-md transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center gap-4 ${isCancelled ? 'border-red-100 opacity-70 bg-red-50/20' : 'border-gray-200'}`}
      >
        <div className={`flex flex-col items-center justify-center rounded-xl p-3 min-w-[100px] border ${isCancelled ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
          <span className={`text-lg font-bold ${isCancelled ? 'text-red-700 line-through' : 'text-gray-900'}`}>{start}</span>
          <span className="text-xs font-medium text-gray-400 mt-0.5">{end}</span>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className={`text-base font-bold ${isCancelled ? 'text-gray-600' : 'text-gray-900'}`}>{lesson.title}</h3>
            {isCancelled && <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[10px] font-bold rounded uppercase tracking-wider">Cancelada</span>}
          </div>
          
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
            {lesson.subjects?.name && <span className="flex items-center text-sm text-gray-600 gap-1.5"><BookOpen className="w-4 h-4 text-gray-400" />{lesson.subjects.name}</span>}
            {lesson.classes?.name && <span className="flex items-center text-sm text-gray-600 gap-1.5"><UsersIcon className="w-4 h-4 text-gray-400" />{lesson.classes.name}</span>}
            
            {lesson.lesson_students && lesson.lesson_students.length > 0 ? (
              <span className="flex items-center text-sm text-gray-600 gap-1.5 line-clamp-1" title={lesson.lesson_students.map(s => s.student_name_snapshot).join(', ')}>
                <User className="w-4 h-4 text-gray-400 min-w-[16px]" />
                {lesson.lesson_students.length === 1 
                  ? lesson.lesson_students[0].student_name_snapshot 
                  : `${lesson.lesson_students.length} alunos`}
              </span>
            ) : lesson.students?.name ? (
              <span className="flex items-center text-sm text-gray-600 gap-1.5">
                <User className="w-4 h-4 text-gray-400" />{lesson.students.name}
              </span>
            ) : null}
          </div>
        </div>
        
        {currentContext === "all" && (
          <div className="sm:text-right self-start sm:self-center">
            <span className="text-xs font-medium px-2.5 py-1 bg-gray-100 text-gray-600 rounded-full">{lesson.school_id ? "Escola" : "Particular"}</span>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Agenda</h1>
          <p className="text-sm text-gray-500">Acompanhe seus horários e compromissos.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={() => setViewMode('day')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'day' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Dia</button>
            <button onClick={() => setViewMode('week')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${viewMode === 'week' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>Semana</button>
          </div>
          <Button onClick={openCreateModal} className="flex items-center gap-2 h-10 px-5 rounded-full whitespace-nowrap">
            <Plus className="w-5 h-5" /> Agendar
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center justify-between bg-white p-4 rounded-2xl border border-gray-200 shadow-sm gap-4">
        <div className="flex items-center gap-2">
          <Button variant="outline" className="h-10 w-10 p-0 rounded-full" onClick={handlePrev}><ChevronLeft className="w-5 h-5" /></Button>
          <Button variant="outline" className="h-10 w-10 p-0 rounded-full" onClick={handleNext}><ChevronRight className="w-5 h-5" /></Button>
          <Button variant="outline" className="h-10 px-4 rounded-full font-medium ml-2" onClick={handleToday}>Hoje</Button>
        </div>
        
        <div className="flex items-center gap-2 text-gray-900 font-semibold capitalize">
          <CalendarIcon className="w-5 h-5 text-gray-400" />
          {viewMode === 'day' ? formatDisplayDate(currentDateStr) : formatDisplayWeek(currentDateStr)}
        </div>
      </div>

      {viewMode === 'day' ? (
        <div className="bg-gray-50/50 rounded-3xl min-h-[400px]">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Nenhuma aula</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">Nenhuma aula agendada para este dia.</p>
            </div>
          ) : (
            <div className="grid gap-3">{lessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}</div>
          )}
        </div>
      ) : (
        <div className="space-y-8 bg-gray-50/30 p-2 sm:p-4 rounded-3xl">
          {loading ? (
            <div className="flex items-center justify-center h-40"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
          ) : lessons.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center px-4">
              <CalendarIcon className="w-12 h-12 text-gray-300 mb-3" />
              <h3 className="text-lg font-medium text-gray-900">Semana livre</h3>
              <p className="text-sm text-gray-500 mt-1 max-w-sm">Nenhuma aula agendada para esta semana no contexto selecionado.</p>
            </div>
          ) : (
            Array.from({length: 7}).map((_, i) => {
              const current = new Date(getWeekRange(currentDateStr).start + "T00:00:00")
              current.setDate(current.getDate() + i)
              const dStr = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, '0')}-${String(current.getDate()).padStart(2, '0')}`
              const dayLessons = lessons.filter(l => l.date === dStr)
              if (dayLessons.length === 0) return null
              
              const weekDay = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' }).format(current)
              const dayMonth = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(current)
              
              return (
                <div key={dStr} className="space-y-3">
                  <h3 className="font-bold text-gray-700 uppercase flex items-center gap-2 pl-1">
                    <span className="text-gray-900">{weekDay}</span> <span className="text-gray-400 font-normal">— {dayMonth}</span>
                  </h3>
                  <div className="grid gap-3">{dayLessons.map(lesson => <LessonCard key={lesson.id} lesson={lesson} />)}</div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* --- MODALS --- */}
      <Modal 
        isOpen={activeModal !== 'none'} 
        onClose={() => setActiveModal('none')} 
        title={activeModal === 'create' ? "Agendar nova aula" : activeModal === 'edit' ? "Editar Aula" : "Detalhes da Aula"}
      >
        {activeModal === 'details' && selectedLesson && (
          <div className="space-y-6">
            {formError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{formError}</div>}
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-gray-900">{selectedLesson.title}</h2>
                {selectedLesson.status === 'cancelled' && <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-bold rounded uppercase">Cancelada</span>}
              </div>
              <p className="text-sm text-gray-500 flex items-center gap-2"><CalendarIcon className="w-4 h-4" />{new Intl.DateTimeFormat('pt-BR', { dateStyle: 'full' }).format(new Date(selectedLesson.date + "T00:00:00"))}</p>
              <p className="text-sm text-gray-500 flex items-center gap-2 mt-1"><Clock className="w-4 h-4" />{selectedLesson.start_time.slice(0,5)} as {selectedLesson.end_time.slice(0,5)}</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-3 border border-gray-100">
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Contexto / Local</p>
                <p className="text-sm font-medium text-gray-900">{selectedLesson.school_id ? "Escola" : "Aula Particular"}</p>
              </div>
              {selectedLesson.classes?.name && <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Turma</p><p className="text-sm font-medium text-gray-900 flex items-center gap-2"><UsersIcon className="w-4 h-4 text-gray-400" />{selectedLesson.classes.name}</p></div>}
              {selectedLesson.subjects?.name && <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Disciplina</p><p className="text-sm font-medium text-gray-900 flex items-center gap-2"><BookOpen className="w-4 h-4 text-gray-400" />{selectedLesson.subjects.name}</p></div>}
              {selectedLesson.students?.name && <div><p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Aluno(a)</p><p className="text-sm font-medium text-gray-900 flex items-center gap-2"><User className="w-4 h-4 text-gray-400" />{selectedLesson.students.name}</p></div>}
            </div>

            {selectedLesson.description && (
              <div>
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">Anotações</p>
                <div className="bg-amber-50/50 p-3 rounded-lg border border-amber-100 text-sm text-gray-800 whitespace-pre-wrap">{selectedLesson.description}</div>
              </div>
            )}

            {/* SEÇÃO: FINANCEIRO (Apenas para Aulas Particulares) */}
            {selectedLesson.school_id === null && selectedLesson.private_lesson_finances && selectedLesson.private_lesson_finances.length > 0 && (
              <div className="mt-4 bg-green-50/50 border border-green-100 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-bold text-green-800 uppercase tracking-wider">Financeiro Relacionado</p>
                  <a href="/dashboard/financeiro" className="text-xs font-bold text-green-700 hover:underline">Ver financeiro &rarr;</a>
                </div>
                <div className="space-y-2">
                  {selectedLesson.private_lesson_finances.map(fin => (
                    <div key={fin.id} className="flex justify-between items-center bg-white border border-green-50 p-2 rounded-lg">
                      <span className="font-bold text-gray-900">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(fin.amount)}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${fin.status === 'paid' ? 'bg-green-100 text-green-700' : fin.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                        {fin.status === 'paid' ? 'Pago' : fin.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SEÇÃO: PRESENÇA / PARTICIPANTES */}
            <div className="mt-6 border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Presença</h3>
                {studentFormMode === 'list' && selectedLesson.status !== 'cancelled' && selectedLesson.class_id && (
                  <Button onClick={openManageStudents} variant="outline" size="sm" className="h-8 text-xs font-medium">
                    <UsersIcon className="w-3 h-3 mr-1" /> Gerenciar Participantes
                  </Button>
                )}
              </div>

              {studentFormMode === 'list' ? (
                (!selectedLesson.lesson_students || selectedLesson.lesson_students.length === 0) ? (
                  <div className="text-center py-4 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                    <p className="text-sm text-gray-500">
                      {selectedLesson.students?.name 
                        ? `Aluno registrado de forma legada: ${selectedLesson.students.name}` 
                        : 'Nenhum participante registrado.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      {selectedLesson.lesson_students.map(s => {
                        const currentDraft = attendanceDraft[s.id] || { status: 'present' }
                        const isCancelled = selectedLesson.status === 'cancelled'
                        
                        return (
                          <div key={s.id} className={`flex flex-col sm:flex-row sm:items-center justify-between bg-white border border-gray-200 rounded-xl p-4 shadow-sm gap-4 ${isCancelled ? 'opacity-70' : ''}`}>
                            <div className="flex items-center gap-3">
                              <div className="bg-blue-50 text-blue-600 p-2.5 rounded-lg">
                                <User className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="text-sm font-bold text-gray-900">{s.student_name_snapshot}</p>
                                {s.class_name_snapshot && <p className="text-xs text-gray-500">{s.class_name_snapshot}</p>}
                              </div>
                            </div>
                            
                            <div className="flex bg-gray-50 p-1 rounded-lg border border-gray-100 self-start sm:self-auto">
                              <button 
                                disabled={isCancelled || savingAttendance}
                                onClick={() => setAttendanceDraft(prev => ({ ...prev, [s.id]: { status: 'present' } }))}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${currentDraft.status === 'present' ? 'bg-green-100 text-green-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                              >
                                Presente
                              </button>
                              <button 
                                disabled={isCancelled || savingAttendance}
                                onClick={() => setAttendanceDraft(prev => ({ ...prev, [s.id]: { status: 'absent' } }))}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${currentDraft.status === 'absent' ? 'bg-red-100 text-red-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                              >
                                Ausente
                              </button>
                              <button 
                                disabled={isCancelled || savingAttendance}
                                onClick={() => setAttendanceDraft(prev => ({ ...prev, [s.id]: { status: 'justified' } }))}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${currentDraft.status === 'justified' ? 'bg-orange-100 text-orange-700 shadow-sm' : 'text-gray-500 hover:bg-gray-200'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                              >
                                Justificado
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    {selectedLesson.status !== 'cancelled' && (
                      <div className="flex justify-end pt-2">
                        <Button onClick={handleSaveAttendance} disabled={savingAttendance} className="h-9 text-sm px-5">
                          {savingAttendance ? "Salvando..." : "Salvar presença"}
                        </Button>
                      </div>
                    )}
                  </div>
                )
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="font-bold text-gray-900 text-sm">Gerenciar Alunos da Turma</h4>
                    <Button onClick={() => setStudentFormMode('list')} variant="ghost" size="sm" className="h-8">Concluir</Button>
                  </div>
                  
                  {loadingStudents ? (
                    <div className="flex justify-center py-4"><div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
                  ) : (
                    <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                      {classStudents.map(student => {
                        const participation = selectedLesson.lesson_students?.find(s => s.student_id === student.id)
                        return (
                          <div key={student.id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg p-2.5">
                            <span className="text-sm font-medium text-gray-700">{student.name}</span>
                            {participation ? (
                              <Button onClick={() => handleRemoveParticipant(participation.id)} variant="outline" size="sm" className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700" disabled={saving}>Remover</Button>
                            ) : (
                              <Button onClick={() => handleAddParticipant(student.id, student.name)} variant="outline" size="sm" className="h-7 text-xs" disabled={saving}>Adicionar</Button>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* SEÇÃO: DESEMPENHO */}
            {selectedLesson.lesson_students && selectedLesson.lesson_students.length > 0 && studentFormMode === 'list' && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Desempenho</h3>
                <div className="space-y-4">
                  {selectedLesson.lesson_students.map(s => {
                    const currentDraft = performanceDraft[s.id] || { level: null, notes: '' }
                    const isCancelled = selectedLesson.status === 'cancelled'
                    
                    return (
                      <div key={s.id} className={`bg-white border border-gray-200 rounded-xl p-4 shadow-sm space-y-3 ${isCancelled ? 'opacity-70' : ''}`}>
                        <div className="flex items-center gap-2 mb-2">
                          <User className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-bold text-gray-900">{s.student_name_snapshot}</span>
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                          <button 
                            disabled={isCancelled || savingPerformance}
                            onClick={() => setPerformanceDraft(prev => ({ ...prev, [s.id]: { ...currentDraft, level: 'excellent' } }))}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors border ${currentDraft.level === 'excellent' ? 'bg-green-50 text-green-700 border-green-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                          >
                            Excelente
                          </button>
                          <button 
                            disabled={isCancelled || savingPerformance}
                            onClick={() => setPerformanceDraft(prev => ({ ...prev, [s.id]: { ...currentDraft, level: 'good' } }))}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors border ${currentDraft.level === 'good' ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                          >
                            Bom
                          </button>
                          <button 
                            disabled={isCancelled || savingPerformance}
                            onClick={() => setPerformanceDraft(prev => ({ ...prev, [s.id]: { ...currentDraft, level: 'needs_attention' } }))}
                            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors border ${currentDraft.level === 'needs_attention' ? 'bg-orange-50 text-orange-700 border-orange-200' : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'} ${isCancelled ? 'cursor-not-allowed' : ''}`}
                          >
                            Precisa de atenção
                          </button>
                        </div>
                        
                        <div>
                          <Input 
                            value={currentDraft.notes} 
                            onChange={e => setPerformanceDraft(prev => ({ ...prev, [s.id]: { ...currentDraft, notes: e.target.value } }))}
                            disabled={isCancelled || savingPerformance}
                            placeholder="Observações sobre o desempenho (opcional)..." 
                            className="h-9 text-xs bg-gray-50"
                          />
                        </div>
                      </div>
                    )
                  })}
                  {selectedLesson.status !== 'cancelled' && (
                    <div className="flex justify-end pt-2">
                      <Button onClick={handleSavePerformance} disabled={savingPerformance} className="h-9 text-sm px-5">
                        {savingPerformance ? "Salvando..." : "Salvar desempenho"}
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* SEÇÃO: CONTEÚDOS TRABALHADOS */}
            <div className="mt-8 border-t border-gray-100 pt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-gray-900">Conteúdos trabalhados</h3>
                {contentFormMode === 'list' && selectedLesson.status !== 'cancelled' && (
                  <Button onClick={openAddContent} variant="outline" size="sm" className="h-8 text-xs font-medium">
                    <Plus className="w-3 h-3 mr-1" /> Adicionar conteúdo
                  </Button>
                )}
              </div>

              {contentFormMode === 'list' ? (
                loadingContents ? (
                  <div className="flex justify-center py-6">
                    <div className="w-5 h-5 border-2 border-gray-200 border-t-gray-900 rounded-full animate-spin" />
                  </div>
                ) : lessonContents.length === 0 ? (
                  <div className="text-center py-6 bg-gray-50 rounded-xl border border-gray-100 border-dashed">
                    <p className="text-sm text-gray-500">Nenhum conteúdo registrado nesta aula.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {lessonContents.map((c, i) => (
                      <div key={c.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm group">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <h4 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                              <span className="flex items-center justify-center bg-gray-100 text-gray-600 text-[10px] w-5 h-5 rounded-full">{i + 1}</span>
                              {c.title}
                            </h4>
                            {c.description && <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{c.description}</p>}
                            {c.observations && (
                              <div className="mt-2 bg-amber-50 text-amber-800 text-xs p-2 rounded-lg border border-amber-100 whitespace-pre-wrap">
                                <strong>Obs:</strong> {c.observations}
                              </div>
                            )}
                          </div>
                          {selectedLesson.status !== 'cancelled' && (
                            <div className="flex items-center gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                              <button onClick={() => openEditContent(c)} className="p-1.5 text-gray-400 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors" title="Editar">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={() => handleDeleteContent(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors" title="Excluir">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 animate-in fade-in slide-in-from-top-2">
                  <h4 className="font-bold text-gray-900 mb-3 text-sm">
                    {contentFormMode === 'add' ? 'Adicionar Novo Conteúdo' : 'Editar Conteúdo'}
                  </h4>
                  <form onSubmit={handleContentSubmit} className="space-y-3">
                    {contentFormError && <div className="p-2 bg-red-50 text-red-600 text-xs rounded-lg">{contentFormError}</div>}
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Título *</label>
                      <Input value={contentFormData.title} onChange={e => setContentFormData({ ...contentFormData, title: e.target.value })} placeholder="Ex: Equações de 2º Grau" required className="h-9 text-sm" />
                    </div>
                    
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Descrição (Opcional)</label>
                      <textarea value={contentFormData.description} onChange={e => setContentFormData({ ...contentFormData, description: e.target.value })} placeholder="Páginas, exercícios..." className="w-full p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none h-16" />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Observações Privadas (Opcional)</label>
                      <textarea value={contentFormData.observations} onChange={e => setContentFormData({ ...contentFormData, observations: e.target.value })} placeholder="Dificuldades da turma..." className="w-full p-2 rounded-lg border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-gray-900 text-sm resize-none h-16" />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button type="submit" disabled={savingContent} className="h-9 text-sm px-4">
                        {savingContent ? "Salvando..." : "Salvar Conteúdo"}
                      </Button>
                      <Button type="button" onClick={() => setContentFormMode('list')} variant="outline" className="h-9 text-sm px-4" disabled={savingContent}>
                        Cancelar
                      </Button>
                    </div>
                  </form>
                </div>
              )}
            </div>
            {/* FIM SEÇÃO CONTEÚDOS */}

            <div className="flex gap-3 pt-6 mt-6 border-t border-gray-100">
              <Button onClick={openEditModal} variant="outline" className="flex-1 flex items-center justify-center gap-2 h-11" disabled={saving}>
                <Edit2 className="w-4 h-4" /> Editar Aula
              </Button>
              {selectedLesson.status !== 'cancelled' && (
                <Button onClick={handleCancelLesson} variant="outline" className="flex-1 flex items-center justify-center gap-2 h-11 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" disabled={saving}>
                  <Trash2 className="w-4 h-4" /> {saving ? "Cancelando..." : "Cancelar Aula"}
                </Button>
              )}
            </div>
          </div>
        )}

        {(activeModal === 'create' || activeModal === 'edit') && (
          loadingLookups ? (
            <div className="flex justify-center py-10"><div className="w-6 h-6 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {formError && <div className="p-3 bg-red-50 text-red-600 text-sm rounded-xl">{formError}</div>}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Título da aula *</label>
                <Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} placeholder="Ex: Aula de Reforço, Equações..." required />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Data *</label>
                  <Input type="date" value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Início *</label>
                  <Input type="time" value={formData.start_time} onChange={e => setFormData({ ...formData, start_time: e.target.value })} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Fim *</label>
                  <Input type="time" value={formData.end_time} onChange={e => setFormData({ ...formData, end_time: e.target.value })} required />
                </div>
              </div>

              {activeModal === 'create' && currentContext === "all" ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contexto da Aula *</label>
                  <select value={formData.school_id} onChange={e => { setFormData({ ...formData, school_id: e.target.value, class_id: "", subject_id: "", student_id: "" }) }} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm" required>
                    <option value="">Selecione o local/contexto...</option>
                    <option value="private">Aula Particular (Sem vínculo)</option>
                    {lookups?.schools.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              ) : activeModal === 'edit' ? (
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 text-sm text-gray-600">
                  <strong>Local:</strong> {getSchoolName(activeSchoolId)}
                  <p className="text-xs text-gray-400 mt-1">O contexto não pode ser alterado na edição.</p>
                </div>
              ) : null}

              {(currentContext !== "all" || formData.school_id !== "" || activeModal === 'edit') && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-gray-50/50 rounded-xl border border-gray-100">
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Turma (Opcional)</label><select value={formData.class_id} onChange={e => setFormData({ ...formData, class_id: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"><option value="">Nenhuma...</option>{availableClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  <div><label className="block text-xs font-medium text-gray-500 mb-1">Disciplina (Opcional)</label><select value={formData.subject_id} onChange={e => setFormData({ ...formData, subject_id: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"><option value="">Nenhuma...</option>{availableSubjects.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                  <div className="sm:col-span-2"><label className="block text-xs font-medium text-gray-500 mb-1">Aluno 1x1 (Opcional)</label><select value={formData.student_id} onChange={e => setFormData({ ...formData, student_id: e.target.value })} className="w-full h-10 px-3 rounded-lg border border-gray-200 bg-white text-sm"><option value="">Nenhum...</option>{availableStudents.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anotações (Opcional)</label>
                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm resize-none h-20" />
              </div>

              {activeModal === 'edit' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                  <select value={formData.status} onChange={e => setFormData({ ...formData, status: e.target.value })} className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-white text-sm">
                    <option value="scheduled">Agendada</option><option value="completed">Concluída</option><option value="cancelled">Cancelada</option>
                  </select>
                </div>
              )}

              <Button type="submit" className="w-full h-12 mt-2" disabled={saving || (activeModal === 'create' && currentContext === "all" && formData.school_id === "")}>
                {saving ? "Salvando..." : activeModal === 'create' ? "Agendar" : "Salvar"}
              </Button>
            </form>
          )
        )}
      </Modal>
    </div>
  )
}

function UsersIcon(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
