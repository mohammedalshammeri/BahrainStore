'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface CountdownTimer {
  id: string
  name: string
  title: string | null
  titleAr: string | null
  endsAt: string
  isActive: boolean
  style: string
  showOnAllPages: boolean
  targetUrl: string | null
  createdAt: string
}

const STYLE_LABELS: Record<string, string> = {
  BAR: 'شريط علوي',
  POPUP: 'نافذة منبثقة',
  INLINE: 'داخلي',
}

export default function CountdownTimersPage() {
  const { store } = useAuthStore()
  const [timers, setTimers] = useState<CountdownTimer[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<CountdownTimer | null>(null)
  const [form, setForm] = useState({
    name: '',
    title: '',
    titleAr: '',
    endsAt: '',
    style: 'BAR',
    showOnAllPages: true,
    targetUrl: '',
    isActive: true,
  })

  const loadData = useCallback(async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const res = await api.get(`/countdown/timers?storeId=${store.id}`)
      setTimers(res.data)
    } finally {
      setLoading(false)
    }
  }, [store?.id])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    const d = new Date()
    d.setDate(d.getDate() + 7)
    setForm({ name: '', title: '', titleAr: '', endsAt: d.toISOString().slice(0, 16), style: 'BAR', showOnAllPages: true, targetUrl: '', isActive: true })
    setShowModal(true)
  }

  function openEdit(t: CountdownTimer) {
    setEditing(t)
    setForm({
      name: t.name,
      title: t.title ?? '',
      titleAr: t.titleAr ?? '',
      endsAt: t.endsAt.slice(0, 16),
      style: t.style,
      showOnAllPages: t.showOnAllPages,
      targetUrl: t.targetUrl ?? '',
      isActive: t.isActive,
    })
    setShowModal(true)
  }

  async function save() {
    if (!store?.id) return
    const payload = { ...form, storeId: store.id }
    if (editing) {
      await api.put(`/countdown/timers/${editing.id}`, payload)
    } else {
      await api.post('/countdown/timers', payload)
    }
    setShowModal(false)
    loadData()
  }

  async function deleteTimer(id: string) {
    if (!confirm('حذف هذا العداد؟')) return
    await api.delete(`/countdown/timers/${id}`)
    loadData()
  }

  async function toggleActive(t: CountdownTimer) {
    await api.put(`/countdown/timers/${t.id}`, { isActive: !t.isActive, storeId: store?.id })
    loadData()
  }

  function timeLeft(endsAt: string) {
    const diff = new Date(endsAt).getTime() - Date.now()
    if (diff <= 0) return 'منتهي'
    const d = Math.floor(diff / 86400000)
    const h = Math.floor((diff % 86400000) / 3600000)
    if (d > 0) return `${d} يوم و ${h} ساعة`
    const m = Math.floor((diff % 3600000) / 60000)
    return `${h} ساعة و ${m} دقيقة`
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">العدادات التنازلية</h1>
          <p className="text-gray-500 text-sm">أنشئ عدادات تنازلية لزيادة الإلحاحية وتحفيز الشراء</p>
        </div>
        <Button onClick={openCreate}>+ إضافة عداد</Button>
      </div>

      <Card>
        <CardHeader title="العدادات النشطة" />
        <CardBody>
          {loading ? (
            <p className="text-center py-8 text-gray-400">جاري التحميل...</p>
          ) : !timers.length ? (
            <p className="text-center py-8 text-gray-400">لا توجد عدادات. أنشئ عداداً لعرضه في متجرك!</p>
          ) : (
            <div className="grid gap-3">
              {timers.map(t => (
                <div key={t.id} className="flex items-center justify-between p-4 border rounded-xl hover:bg-gray-50">
                  <div>
                    <p className="font-medium text-sm">{t.name}</p>
                    {t.titleAr && <p className="text-xs text-gray-500 mt-0.5">{t.titleAr}</p>}
                    <div className="flex gap-3 mt-1">
                      <span className="text-xs text-gray-400">
                        ⏱ {timeLeft(t.endsAt)}
                      </span>
                      <span className="text-xs bg-gray-100 px-2 py-0.5 rounded">{STYLE_LABELS[t.style] ?? t.style}</span>
                      {t.showOnAllPages && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">كل الصفحات</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleActive(t)}
                      className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${t.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${t.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </button>
                    <button onClick={() => openEdit(t)} className="text-blue-600 text-sm hover:underline">تعديل</button>
                    <button onClick={() => deleteTimer(t.id)} className="text-red-500 text-sm hover:underline">حذف</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{editing ? 'تعديل العداد' : 'إنشاء عداد جديد'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">اسم العداد *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: عرض نهاية الموسم" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">عنوان (عربي)</label>
                  <Input value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} placeholder="ينتهي العرض خلال:" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title (EN)</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Sale ends in:" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الانتهاء *</label>
                <Input type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع العرض</label>
                <select
                  value={form.style}
                  onChange={e => setForm(f => ({ ...f, style: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                >
                  <option value="BAR">شريط علوي</option>
                  <option value="POPUP">نافذة منبثقة</option>
                  <option value="INLINE">داخلي في الصفحة</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">رابط (اختياري)</label>
                <Input value={form.targetUrl} onChange={e => setForm(f => ({ ...f, targetUrl: e.target.value }))} placeholder="/products" />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.showOnAllPages}
                  onChange={e => setForm(f => ({ ...f, showOnAllPages: e.target.checked }))}
                />
                <span className="text-sm">عرض في جميع صفحات المتجر</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button onClick={save}>{editing ? 'حفظ' : 'إنشاء'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
