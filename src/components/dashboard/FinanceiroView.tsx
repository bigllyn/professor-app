"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { createClient } from "@/lib/supabase/client"
import { Search, User, Calendar, X, Plus, Pencil, Trash2, DollarSign, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type FinanceRecord = {
  id: string
  student_id: string
  lesson_id: string | null
  title: string
  amount: number
  status: 'pending' | 'paid' | 'cancelled'
  due_date: string | null
  paid_at: string | null
  notes: string | null
  students: { name: string } | null
  lessons: { title: string, date: string } | null
}

function Modal({ isOpen, onClose, title, children }: { isOpen: boolean, onClose: () => void, title: string, children: React.ReactNode }) {
  if (!isOpen) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
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

export default function FinanceiroView({ userId, initialContext }: { userId: string, initialContext: string }) {
  const supabase = createClient()
  const [currentContext, setCurrentContext] = useState(initialContext)
  
  // Data
  const [finances, setFinances] = useState<FinanceRecord[]>([])
  const [loading, setLoading] = useState(true)

  // Lookups
  const [studentsList, setStudentsList] = useState<{id: string, name: string}[]>([])
  const [lessonsList, setLessonsList] = useState<{id: string, title: string, date: string, student_id: string | null}[]>([])

  // Filtros
  const [filterStudent, setFilterStudent] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [dateRange, setDateRange] = useState("all")

  // Form
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    student_id: "",
    lesson_id: "",
    title: "",
    amount: "",
    due_date: "",
    status: "pending",
    notes: ""
  })

  // Listen Context
  useEffect(() => {
    const handleContextChange = (e: any) => setCurrentContext(e.detail)
    window.addEventListener('context_changed', handleContextChange)
    return () => window.removeEventListener('context_changed', handleContextChange)
  }, [])

  // Check se é contexto escolar e bloquear render
  const isSchoolContext = currentContext !== 'all' && currentContext !== 'private'

  // Fetch Lookups (Sempre buscar apenas alunos e aulas particulares)
  const fetchLookups = useCallback(async () => {
    if (isSchoolContext) return
    const [stRes, lsRes] = await Promise.all([
      supabase.from("students").select("id, name").eq("teacher_id", userId).is("school_id", null).order("name"),
      supabase.from("lessons").select("id, title, date, student_id").eq("teacher_id", userId).is("school_id", null).neq("status", "cancelled").order("date", {ascending: false}).limit(100)
    ])
    if (stRes.data) setStudentsList(stRes.data)
    if (lsRes.data) setLessonsList(lsRes.data)
  }, [userId, isSchoolContext, supabase])

  // Fetch Core Data
  const fetchData = useCallback(async () => {
    if (isSchoolContext) {
      setLoading(false)
      return
    }
    setLoading(true)
    let query = supabase.from("private_lesson_finances").select(`
      id, student_id, lesson_id, title, amount, status, due_date, paid_at, notes,
      students(name), lessons(title, date)
    `).eq("teacher_id", userId).order("created_at", { ascending: false })

    if (dateRange !== 'all') {
      const d = new Date()
      d.setDate(d.getDate() - parseInt(dateRange))
      const dateStr = d.toISOString().split('T')[0]
      query = query.gte("created_at", dateStr)
    }

    const { data } = await query
    if (data) setFinances(data as unknown as FinanceRecord[])
    setLoading(false)
  }, [userId, isSchoolContext, dateRange, supabase])

  useEffect(() => {
    fetchLookups()
    fetchData()
  }, [fetchLookups, fetchData])

  // Process Filters
  const filteredFinances = useMemo(() => {
    let res = finances
    if (filterStudent !== 'all') res = res.filter(f => f.student_id === filterStudent)
    if (filterStatus !== 'all') res = res.filter(f => f.status === filterStatus)
    return res
  }, [finances, filterStudent, filterStatus])

  // Calculate Summary
  const { totalPending, totalPaid, totalCancelled } = useMemo(() => {
    let p = 0, pd = 0, c = 0
    filteredFinances.forEach(f => {
      if (f.status === 'pending') p += f.amount
      else if (f.status === 'paid') pd += f.amount
      else if (f.status === 'cancelled') c += f.amount
    })
    return { totalPending: p, totalPaid: pd, totalCancelled: c }
  }, [filteredFinances])

  const fmtMon = (val: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  // Handlers
  const openNew = () => {
    setEditingId(null)
    setFormData({ student_id: "", lesson_id: "", title: "", amount: "", due_date: "", status: "pending", notes: "" })
    setIsModalOpen(true)
  }

  const openEdit = (f: FinanceRecord) => {
    setEditingId(f.id)
    setFormData({
      student_id: f.student_id,
      lesson_id: f.lesson_id || "",
      title: f.title,
      amount: f.amount.toString().replace('.', ','),
      due_date: f.due_date || "",
      status: f.status,
      notes: f.notes || ""
    })
    setIsModalOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir definitivamente este lançamento financeiro?")) return
    const { error } = await supabase.from("private_lesson_finances").delete().eq("id", id)
    if (!error) setFinances(prev => prev.filter(f => f.id !== id))
  }

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    const payload: any = { status: newStatus }
    if (newStatus === 'paid') payload.paid_at = new Date().toISOString()
    else if (newStatus === 'pending') payload.paid_at = null

    const { data, error } = await supabase.from("private_lesson_finances").update(payload).eq("id", id).select("*, students(name), lessons(title, date)").single()
    if (!error && data) setFinances(prev => prev.map(f => f.id === id ? data as unknown as FinanceRecord : f))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.student_id || !formData.title || !formData.amount) {
      alert("Preencha Título, Aluno e Valor.")
      return
    }

    const numericAmount = parseFloat(formData.amount.replace(/\./g, '').replace(',', '.'))
    if (isNaN(numericAmount) || numericAmount <= 0) {
      alert("Valor inválido. Insira um valor positivo.")
      return
    }

    setSaving(true)
    const payload: any = {
      teacher_id: userId,
      student_id: formData.student_id,
      lesson_id: formData.lesson_id || null,
      school_id: null,
      title: formData.title,
      amount: numericAmount,
      status: formData.status,
      due_date: formData.due_date || null,
      notes: formData.notes || null
    }

    if (formData.status === 'paid' && (!editingId || finances.find(f => f.id === editingId)?.status !== 'paid')) {
      payload.paid_at = new Date().toISOString()
    } else if (formData.status === 'pending') {
      payload.paid_at = null
    }

    if (editingId) {
      const { data, error } = await supabase.from("private_lesson_finances").update(payload).eq("id", editingId).select("*, students(name), lessons(title, date)").single()
      if (!error && data) {
        setFinances(prev => prev.map(f => f.id === editingId ? data as unknown as FinanceRecord : f))
        setIsModalOpen(false)
      } else {
        console.error("🔥 SUPABASE ERROR (UPDATE):", error, "Payload:", payload)
        alert(`Erro ao atualizar:\nMessage: ${error?.message}\nDetails: ${error?.details}\nHint: ${error?.hint}\nCode: ${error?.code}`)
      }
    } else {
      const { data, error } = await supabase.from("private_lesson_finances").insert(payload).select("*, students(name), lessons(title, date)").single()
      if (!error && data) {
        setFinances(prev => [data as unknown as FinanceRecord, ...prev])
        setIsModalOpen(false)
      } else {
        console.error("🔥 SUPABASE ERROR (INSERT):", error, "Payload:", payload)
        alert(`Erro ao criar lançamento:\nMessage: ${error?.message}\nDetails: ${error?.details}\nHint: ${error?.hint}\nCode: ${error?.code}`)
      }
    }
    setSaving(false)
  }

  if (isSchoolContext) {
    return (
      <div className="text-center py-20 bg-white rounded-3xl border border-gray-100 shadow-sm mt-6">
        <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-5">
          <DollarSign className="w-10 h-10 text-gray-400" />
        </div>
        <h3 className="text-xl font-bold text-gray-900">Acesso Restrito</h3>
        <p className="text-gray-500 mt-2 max-w-sm mx-auto">
          Financeiro disponível apenas para <strong className="text-gray-900">aulas particulares</strong>.<br/>Troque o local ativo no topo da tela para acessar.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Clock className="w-4 h-4" /> A Receber</p>
          <p className="text-3xl font-black text-gray-900">{fmtMon(totalPending)}</p>
        </div>
        <div className="bg-green-50 p-5 rounded-2xl border border-green-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-green-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> Recebido</p>
          <p className="text-3xl font-black text-green-700">{fmtMon(totalPaid)}</p>
        </div>
        <div className="bg-red-50 p-5 rounded-2xl border border-red-100 shadow-sm flex flex-col justify-between">
          <p className="text-xs font-bold text-red-700 uppercase tracking-wider mb-2 flex items-center gap-1.5"><XCircle className="w-4 h-4" /> Cancelado</p>
          <p className="text-3xl font-black text-red-700">{fmtMon(totalCancelled)}</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 mb-2 md:mb-0">
        <Button onClick={openNew} className="w-full md:w-auto h-10 px-4">
          <Plus className="w-4 h-4 mr-2" /> Novo lançamento
        </Button>
      </div>

      {/* Filtros */}
      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
        <select value={filterStudent} onChange={e => setFilterStudent(e.target.value)} className="flex-1 h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
          <option value="all">Todos os alunos</option>
          {studentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="w-full sm:w-40 h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
          <option value="all">Status (Todos)</option>
          <option value="pending">Pendente</option>
          <option value="paid">Pago</option>
          <option value="cancelled">Cancelado</option>
        </select>
        <select value={dateRange} onChange={e => setDateRange(e.target.value)} className="w-full sm:w-40 h-10 px-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-gray-900 outline-none">
          <option value="all">Período (Todo)</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
      </div>

      {/* Listagem */}
      {loading ? (
        <div className="py-12 flex justify-center"><div className="w-8 h-8 border-4 border-gray-200 border-t-gray-900 rounded-full animate-spin" /></div>
      ) : filteredFinances.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-gray-100 border-dashed">
          <div className="bg-gray-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <DollarSign className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900">Nenhum lançamento</h3>
          <p className="text-gray-500 mt-1">Crie um novo lançamento financeiro.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFinances.map(f => (
            <div key={f.id} className="bg-white border border-gray-100 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col justify-between">
              <div>
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-bold text-gray-900 line-clamp-1 flex-1 pr-2">{f.title}</h3>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase shrink-0 ${f.status === 'paid' ? 'bg-green-100 text-green-700' : f.status === 'cancelled' ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                    {f.status === 'paid' ? 'Pago' : f.status === 'cancelled' ? 'Cancelado' : 'Pendente'}
                  </span>
                </div>
                <p className="text-2xl font-black text-gray-900 mb-3">{fmtMon(f.amount)}</p>
                
                <div className="space-y-1.5 border-t border-gray-50 pt-3">
                  <p className="text-xs font-medium text-gray-600 flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> {f.students?.name}</p>
                  {f.due_date && <p className="text-xs text-gray-500 flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> Vencimento: {new Date(f.due_date + 'T12:00:00').toLocaleDateString('pt-BR')}</p>}
                </div>
              </div>
              
              <div className="mt-5 pt-3 border-t border-gray-50 flex items-center justify-end gap-2 flex-wrap">
                {f.status === 'pending' && (
                  <Button size="sm" onClick={() => handleUpdateStatus(f.id, 'paid')} className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white">
                    <CheckCircle className="w-3.5 h-3.5 mr-1" /> Pagar
                  </Button>
                )}
                {f.status === 'paid' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(f.id, 'pending')} className="h-8 px-3 text-xs">
                    Desfazer Pgto.
                  </Button>
                )}
                {f.status !== 'cancelled' && (
                  <Button variant="outline" size="sm" onClick={() => handleUpdateStatus(f.id, 'cancelled')} className="h-8 px-3 text-xs text-orange-600 border-orange-100 hover:bg-orange-50 hover:text-orange-700">
                    Cancelar
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => openEdit(f)} className="h-8 px-2">
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handleDelete(f.id)} className="h-8 px-2 text-red-600 border-red-100 hover:bg-red-50 hover:text-red-700">
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Nova/Editar */}
      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingId ? "Editar Lançamento" : "Novo Lançamento"}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Descrição (Título) *</label>
            <Input required value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} placeholder="Ex: Mensalidade Setembro..." />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Aluno Particular *</label>
            <select required value={formData.student_id} onChange={e => setFormData({...formData, student_id: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="">Selecione um aluno...</option>
              {studentsList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Aula Relacionada (Opcional)</label>
            <select 
              value={formData.lesson_id} 
              onChange={e => {
                const val = e.target.value
                const lesson = lessonsList.find(l => l.id === val)
                setFormData(prev => ({
                  ...prev, 
                  lesson_id: val,
                  ...(lesson?.student_id ? { student_id: lesson.student_id } : {})
                }))
              }} 
              className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none"
            >
              <option value="">Nenhuma aula vinculada</option>
              {lessonsList.filter(l => !formData.student_id || l.student_id === formData.student_id || l.student_id === null).map(l => (
                <option key={l.id} value={l.id}>{new Date(l.date + 'T12:00:00').toLocaleDateString('pt-BR')} - {l.title}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Valor (R$) *</label>
              <Input required value={formData.amount} onChange={e => setFormData({...formData, amount: e.target.value})} placeholder="Ex: 80,00" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700">Vencimento (Opcional)</label>
              <Input type="date" value={formData.due_date} onChange={e => setFormData({...formData, due_date: e.target.value})} />
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Status</label>
            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full h-10 px-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none">
              <option value="pending">Pendente</option>
              <option value="paid">Pago</option>
              <option value="cancelled">Cancelado</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-bold text-gray-700">Observações (Opcional)</label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({...formData, notes: e.target.value})} 
              className="w-full p-3 rounded-xl border border-gray-200 bg-white text-sm focus:ring-2 focus:ring-gray-900 outline-none min-h-[80px] resize-none"
              placeholder="Notas internas..."
            />
          </div>

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
            <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>Cancelar</Button>
            <Button type="submit" disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
