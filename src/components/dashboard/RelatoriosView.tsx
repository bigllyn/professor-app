"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { BarChart2, Calendar, Users, CheckCircle, Activity, TrendingUp, DollarSign, BookOpen, AlertCircle, Clock, FileText, Award } from "lucide-react"

export function RelatoriosView({ userId }: { userId: string }) {
  const supabase = createClient()
  
  const [currentContext, setCurrentContext] = useState<string>("all")
  const [period, setPeriod] = useState<string>("30")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [data, setData] = useState({
    lessons: [] as any[],
    lessonStudents: [] as any[],
    students: [] as any[],
    contents: [] as any[],
    assessments: [] as any[],
    finances: [] as any[]
  })

  useEffect(() => {
    const handleContextChange = (e: any) => setCurrentContext(e.detail)
    window.addEventListener('context_changed', handleContextChange)
    
    const match = document.cookie.match(/(^| )professor_context=([^;]+)/)
    if (match) setCurrentContext(match[2])
      
    return () => window.removeEventListener('context_changed', handleContextChange)
  }, [])

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      let dateFilter = ""
      if (period === 'year') {
        dateFilter = new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0]
      } else {
        const d = new Date()
        d.setDate(d.getDate() - parseInt(period))
        dateFilter = d.toISOString().split('T')[0]
      }

      const applyContext = (q: any, isFinance = false) => {
        q = q.eq("teacher_id", userId)
        if (isFinance) return q
        if (currentContext === "private") return q.is("school_id", null)
        if (currentContext !== "all") return q.eq("school_id", currentContext)
        return q
      }

      const qLessons = applyContext(supabase.from("lessons").select("id, status, date, title, student_id, class_id, subject_id, students(name), classes(name), subjects(name), lesson_contents(title)")).gte("date", dateFilter).order("date", { ascending: false })
      const qLs = applyContext(supabase.from("lesson_students").select("id, attendance_status, performance_level, student_id, lessons!inner(date)")).gte("lessons.date", dateFilter)
      const qStudents = applyContext(supabase.from("students").select("id, name"))
      const qContents = applyContext(supabase.from("lesson_contents").select("id, title, created_at, lessons!inner(date, title)")).gte("lessons.date", dateFilter).order("created_at", { ascending: false }).limit(10)
      const qAssessments = applyContext(supabase.from("assessments").select("id, title, date, score, max_score")).gte("date", dateFilter)

      let qFinances = null
      if (currentContext === "all" || currentContext === "private") {
        qFinances = applyContext(supabase.from("private_lesson_finances").select("id, amount, status, created_at"), true).gte("created_at", dateFilter)
      }

      const [resLessons, resLs, resStudents, resContents, resAssessments, resFin] = await Promise.all([
        qLessons, qLs, qStudents, qContents, qAssessments, qFinances ? qFinances : Promise.resolve({ data: [] })
      ])

      if (resLessons.error) throw resLessons.error
      if (resLs.error) throw resLs.error

      setData({
        lessons: resLessons.data || [],
        lessonStudents: resLs.data || [],
        students: resStudents.data || [],
        contents: resContents.data || [],
        assessments: resAssessments.data || [],
        finances: resFin.data || []
      })
    } catch (err: any) {
      console.error(err)
      setError(err.message || "Erro ao buscar dados.")
    } finally {
      setLoading(false)
    }
  }, [userId, currentContext, period, supabase])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  // Calculations
  const stats = useMemo(() => {
    // Aulas
    const totalLessons = data.lessons.length
    const completedLessons = data.lessons.filter(l => l.status === "completed").length
    const scheduledLessons = data.lessons.filter(l => l.status === "scheduled").length
    const cancelledLessons = data.lessons.filter(l => l.status === "cancelled").length

    // Presenças e Desempenho
    let present = 0, absent = 0, justified = 0
    let exc = 0, good = 0, needsAtt = 0
    
    // Alunos ativos no periodo
    const activeStudentIds = new Set<string>()

    data.lessonStudents.forEach(ls => {
      if (ls.student_id) activeStudentIds.add(ls.student_id)
      
      if (ls.attendance_status === "present") present++
      else if (ls.attendance_status === "absent") absent++
      else if (ls.attendance_status === "justified") justified++

      if (ls.performance_level === "excellent") exc++
      else if (ls.performance_level === "good") good++
      else if (ls.performance_level === "needs_attention") needsAtt++
    })

    const totalAttendance = present + absent + justified
    const presentPerc = totalAttendance > 0 ? Math.round((present / totalAttendance) * 100) : null

    // Avaliações
    let totalScore = 0
    let totalMaxScore = 0
    data.assessments.forEach(a => {
      if (a.score !== null && a.max_score !== null && a.max_score > 0) {
        totalScore += Number(a.score)
        totalMaxScore += Number(a.max_score)
      }
    })
    const avgAssessment = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : null

    // Financeiro
    let finPending = 0, finPaid = 0, finCancelled = 0
    data.finances.forEach(f => {
      if (f.status === "pending") finPending += Number(f.amount)
      else if (f.status === "paid") finPaid += Number(f.amount)
      else if (f.status === "cancelled") finCancelled += Number(f.amount)
    })

    return {
      totalLessons, completedLessons, scheduledLessons, cancelledLessons,
      present, absent, justified, presentPerc, totalAttendance,
      exc, good, needsAtt,
      totalStudents: data.students.length,
      activeStudents: activeStudentIds.size,
      totalAssessments: data.assessments.length,
      avgAssessment,
      finPending, finPaid, finCancelled,
      showFinance: (currentContext === "all" || currentContext === "private")
    }
  }, [data, currentContext])

  const fmtMon = (v: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)

  if (loading) {
    return (
      <div className="flex-1 flex flex-col p-4 sm:p-8 animate-pulse">
        <div className="h-8 bg-gray-200 w-48 rounded-md mb-2"></div>
        <div className="h-4 bg-gray-200 w-64 rounded-md mb-8"></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[1,2,3,4].map(i => <div key={i} className="h-24 bg-gray-200 rounded-2xl"></div>)}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <AlertCircle className="w-12 h-12 text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">Erro ao carregar relatórios</h2>
        <p className="text-gray-500">{error}</p>
        <button onClick={fetchData} className="mt-4 px-6 py-2 bg-gray-900 text-white rounded-full font-medium text-sm">Tentar novamente</button>
      </div>
    )
  }

  const hasNoData = stats.totalLessons === 0 && stats.totalStudents === 0 && data.finances.length === 0

  return (
    <div className="flex-1 flex flex-col h-full bg-gray-50/50">
      <div className="flex-1 overflow-y-auto">
        <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8">
          
          {/* Header & Filtros */}
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-gray-900 tracking-tight">Relatórios</h1>
              <p className="text-sm text-gray-500 mt-1">Visão geral das suas aulas e do acompanhamento dos alunos.</p>
            </div>
            
            <div className="bg-white p-2 rounded-2xl border border-gray-100 shadow-sm flex items-center">
              <Calendar className="w-4 h-4 text-gray-400 ml-3 mr-2" />
              <select 
                value={period} 
                onChange={(e) => setPeriod(e.target.value)}
                className="h-9 pr-8 bg-transparent text-sm font-medium text-gray-700 focus:outline-none appearance-none cursor-pointer"
              >
                <option value="7">Últimos 7 dias</option>
                <option value="30">Últimos 30 dias</option>
                <option value="90">Últimos 90 dias</option>
                <option value="year">Este ano</option>
              </select>
            </div>
          </div>

          {hasNoData ? (
            <div className="bg-white rounded-3xl border border-gray-100 p-12 text-center shadow-sm">
              <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart2 className="w-8 h-8 text-gray-300" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-1">Nenhum registro encontrado</h3>
              <p className="text-gray-500 text-sm">Não há dados para exibir neste período e contexto selecionado.</p>
            </div>
          ) : (
            <div className="space-y-8">
              
              {/* Secao Resumo */}
              <section>
                <h2 className="text-sm font-bold text-gray-900 mb-4 px-1 uppercase tracking-wider">Resumo Geral</h2>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <BookOpen className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Aulas</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">{stats.totalLessons}</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Users className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Alunos Ativos</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">{stats.activeStudents}</span>
                      <span className="text-xs text-gray-400 font-medium">/ {stats.totalStudents} total</span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Presença</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">
                        {stats.presentPerc !== null ? `${stats.presentPerc}%` : '-'}
                      </span>
                    </div>
                  </div>
                  <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                      <Award className="w-4 h-4" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Média Geral</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-gray-900">
                        {stats.avgAssessment !== null ? `${stats.avgAssessment}%` : '-'}
                      </span>
                      <span className="text-xs text-gray-400 font-medium">({stats.totalAssessments} avaliações)</span>
                    </div>
                  </div>
                </div>
              </section>

              {/* Grid 2 colunas para detalhes */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* Detalhes Aulas */}
                <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-gray-400" />
                    Status das Aulas
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100/50">
                      <span className="text-sm font-medium text-green-700">Concluídas</span>
                      <span className="text-lg font-black text-green-700">{stats.completedLessons}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-blue-50 rounded-2xl border border-blue-100/50">
                      <span className="text-sm font-medium text-blue-700">Agendadas</span>
                      <span className="text-lg font-black text-blue-700">{stats.scheduledLessons}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-2xl border border-red-100/50">
                      <span className="text-sm font-medium text-red-700">Canceladas</span>
                      <span className="text-lg font-black text-red-700">{stats.cancelledLessons}</span>
                    </div>
                  </div>
                </section>

                {/* Detalhes Presenca */}
                <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <Users className="w-5 h-5 text-gray-400" />
                    Frequência
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Presentes</span>
                      <span className="text-lg font-black text-gray-900">{stats.present}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Faltas</span>
                      <span className="text-lg font-black text-gray-900">{stats.absent}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Justificadas</span>
                      <span className="text-lg font-black text-gray-900">{stats.justified}</span>
                    </div>
                  </div>
                </section>

                {/* Detalhes Desempenho */}
                <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5 text-gray-400" />
                    Desempenho Registrado
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100/50">
                      <span className="text-sm font-medium text-purple-700">Excelente</span>
                      <span className="text-lg font-black text-purple-700">{stats.exc}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-green-50 rounded-2xl border border-green-100/50">
                      <span className="text-sm font-medium text-green-700">Bom</span>
                      <span className="text-lg font-black text-green-700">{stats.good}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-2xl border border-orange-100/50">
                      <span className="text-sm font-medium text-orange-700">Precisa de Atenção</span>
                      <span className="text-lg font-black text-orange-700">{stats.needsAtt}</span>
                    </div>
                  </div>
                </section>

                {/* Conteudos e Avaliacoes */}
                <section className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm">
                  <h3 className="text-base font-bold text-gray-900 mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-400" />
                    Conteúdos e Avaliações
                  </h3>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Conteúdos trabalhados</span>
                      <span className="text-lg font-black text-gray-900">{data.contents.length}</span>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl border border-gray-100">
                      <span className="text-sm font-medium text-gray-700">Avaliações realizadas</span>
                      <span className="text-lg font-black text-gray-900">{stats.totalAssessments}</span>
                    </div>
                  </div>
                </section>

              </div>

              {/* Financeiro */}
              {stats.showFinance && (
                <section>
                  <h2 className="text-sm font-bold text-gray-900 mb-4 px-1 uppercase tracking-wider">Financeiro (Aulas Particulares)</h2>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">A Receber</div>
                      <div className="text-2xl font-black text-orange-600">{fmtMon(stats.finPending)}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recebido</div>
                      <div className="text-2xl font-black text-green-600">{fmtMon(stats.finPaid)}</div>
                    </div>
                    <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Cancelado</div>
                      <div className="text-2xl font-black text-gray-400">{fmtMon(stats.finCancelled)}</div>
                    </div>
                  </div>
                </section>
              )}

              {/* Atividade Recente */}
              {data.lessons.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-gray-900 mb-4 px-1 uppercase tracking-wider">Atividade Recente</h2>
                  <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden">
                    <div className="divide-y divide-gray-50">
                      {data.lessons.slice(0, 10).map((l: any) => (
                        <div key={l.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-gray-50 transition-colors">
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold text-gray-900 truncate">{l.title || 'Aula sem título'}</p>
                            
                            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
                              {l.students?.name && <span className="text-xs text-gray-500 flex items-center gap-1"><Users className="w-3 h-3" /> {l.students.name}</span>}
                              {l.classes?.name && <span className="text-xs text-gray-500">Turma: {l.classes.name}</span>}
                              {l.subjects?.name && <span className="text-xs text-gray-500">Disciplina: {l.subjects.name}</span>}
                              {l.lesson_contents?.[0]?.title && <span className="text-xs text-gray-500">Conteúdo: {l.lesson_contents[0].title}</span>}
                            </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1 shrink-0">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-gray-100 text-gray-600 uppercase">
                              {new Date(l.date + "T00:00:00").toLocaleDateString('pt-BR')}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                              l.status === 'completed' ? 'bg-green-100 text-green-700' :
                              l.status === 'scheduled' ? 'bg-blue-100 text-blue-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {l.status === 'completed' ? 'Concluída' : l.status === 'scheduled' ? 'Agendada' : 'Cancelada'}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              )}

            </div>
          )}

        </div>
      </div>
    </div>
  )
}
