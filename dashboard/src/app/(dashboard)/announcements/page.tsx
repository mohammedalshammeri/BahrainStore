'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Announcement {
  id: string
  title: string
  titleAr: string
  body: string | null
  bodyAr: string | null
  type: string
  isActive: boolean
  isPinned: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

const TYPE_LABELS: Record<string, string> = {
  INFO: 'معلومة',
  WARNING: 'تحذير',
  MAINTENANCE: 'صيانة',
  FEATURE: 'ميزة جديدة',
}
const TYPE_COLORS: Record<string, string> = {
  INFO: 'bg-blue-100 text-blue-700',
  WARNING: 'bg-yellow-100 text-yellow-700',
  MAINTENANCE: 'bg-orange-100 text-orange-700',
  FEATURE: 'bg-purple-100 text-purple-700',
}

export default function AnnouncementsPage() {
  const router = useRouter()
  const { merchant } = useAuthStore()

  useEffect(() => {
    if (merchant !== null && !(merchant as any).isAdmin) {
      router.replace('/')
    }
  }, [merchant, router])

  const [announcements, setAnnouncements] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Announcement | null>(null)
  const [form, setForm] = useState({ title: '', titleAr: '', body: '', bodyAr: '', type: 'INFO', isPinned: false, isActive: true, startsAt: '', endsAt: '' })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/announcements/admin')
      setAnnouncements(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm({ title: '', titleAr: '', body: '', bodyAr: '', type: 'INFO', isPinned: false, isActive: true, startsAt: '', endsAt: '' })
    setShowModal(true)
  }

  function openEdit(a: Announcement) {
    setEditing(a)
    setForm({
      title: a.title,
      titleAr: a.titleAr,
      body: a.body ?? '',
      bodyAr: a.bodyAr ?? '',
      type: a.type,
      isPinned: a.isPinned,
      isActive: a.isActive,
      startsAt: a.startsAt ? a.startsAt.slice(0, 16) : '',
      endsAt: a.endsAt ? a.endsAt.slice(0, 16) : '',
    })
    setShowModal(true)
  }

  async function save() {
    if (editing) {
      await api.put(`/announcements/admin/${editing.id}`, form)
    } else {
      await api.post('/announcements/admin', form)
    }
    setShowModal(false)
    loadData()
  }

  async function deleteAnn(id: string) {
    if (!confirm('حذف هذا الإعلان؟')) return
    await api.delete(`/announcements/admin/${id}`)
    loadData()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">الإعلانات</h1>
          <p className="text-gray-500 text-sm">رسائل المنصة للتجار</p>
        </div>
        <Button onClick={openCreate}>+ إضافة إعلان</Button>
      </div>

      <Card>
        <CardHeader title="جميع الإعلانات" />
        <CardBody>
          {loading ? (
            <p className="text-center py-8 text-gray-400">جاري التحميل...</p>
          ) : !announcements.length ? (
            <p className="text-center py-8 text-gray-400">لا توجد إعلانات</p>
          ) : (
            <div className="space-y-3">
              {announcements.map(a => (
                <div key={a.id} className={`p-4 rounded-xl border ${a.isActive ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.isPinned && <span className="text-xs">📌</span>}
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[a.type] ?? ''}`}>{TYPE_LABELS[a.type] ?? a.type}</span>
                        {!a.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">غير نشط</span>}
                      </div>
                      <p className="font-medium mt-1">{a.titleAr}</p>
                      {a.bodyAr && <p className="text-sm text-gray-600 mt-0.5">{a.bodyAr}</p>}
                      {(a.startsAt || a.endsAt) && (
                        <p className="text-xs text-gray-400 mt-1">
                          {a.startsAt ? `من: ${new Date(a.startsAt).toLocaleDateString('ar-BH')}` : ''}{' '}
                          {a.endsAt ? `إلى: ${new Date(a.endsAt).toLocaleDateString('ar-BH')}` : ''}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button onClick={() => openEdit(a)} className="text-blue-600 text-sm hover:underline">تعديل</button>
                      <button onClick={() => deleteAnn(a.id)} className="text-red-500 text-sm hover:underline">حذف</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4 my-4">
            <h2 className="text-lg font-bold">{editing ? 'تعديل الإعلان' : 'إعلان جديد'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان (عربي) *</label>
                  <Input value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title (EN) *</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المحتوى (عربي)</label>
                <textarea value={form.bodyAr} onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))} rows={3} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع الإعلان</label>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className="w-full border border-gray-200 rounded-lg p-2 text-sm">
                  {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">يبدأ من</label>
                  <Input type="datetime-local" value={form.startsAt} onChange={e => setForm(f => ({ ...f, startsAt: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ينتهي في</label>
                  <Input type="datetime-local" value={form.endsAt} onChange={e => setForm(f => ({ ...f, endsAt: e.target.value }))} />
                </div>
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPinned} onChange={e => setForm(f => ({ ...f, isPinned: e.target.checked }))} />
                  <span className="text-sm">تثبيت</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isActive} onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} />
                  <span className="text-sm">نشط</span>
                </label>
              </div>
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
