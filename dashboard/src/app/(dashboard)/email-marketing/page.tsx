'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Campaign {
  id: string
  name: string
  subject: string | null
  status: string
  scheduledAt: string | null
  sentAt: string | null
  recipientCount: number
  openCount: number
  clickCount: number
  createdAt: string
}

interface Stats {
  totalSubscribers: number
  activeSubscribers: number
  campaignsSent: number
  avgOpenRate: number
}

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'مسودة',
  SCHEDULED: 'مجدول',
  SENDING: 'يُرسل',
  SENT: 'أُرسل',
  CANCELLED: 'ملغى',
}
const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SCHEDULED: 'bg-blue-100 text-blue-700',
  SENDING: 'bg-yellow-100 text-yellow-700',
  SENT: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-700',
}

export default function EmailMarketingPage() {
  const { store } = useAuthStore()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Campaign | null>(null)
  const [form, setForm] = useState({ name: '', subject: '', subjectAr: '', body: '', bodyAr: '', scheduledAt: '' })

  const loadData = useCallback(async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const [c, s] = await Promise.all([
        api.get(`/email-marketing/campaigns?storeId=${store.id}`),
        api.get(`/email-marketing/stats?storeId=${store.id}`),
      ])
      setCampaigns(c.data)
      setStats(s.data)
    } finally {
      setLoading(false)
    }
  }, [store?.id])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', subject: '', subjectAr: '', body: '', bodyAr: '', scheduledAt: '' })
    setShowModal(true)
  }
  function openEdit(c: Campaign) {
    setEditing(c)
    setForm({
      name: c.name,
      subject: c.subject ?? '',
      subjectAr: '',
      body: '',
      bodyAr: '',
      scheduledAt: c.scheduledAt ? c.scheduledAt.slice(0, 16) : '',
    })
    setShowModal(true)
  }

  async function save() {
    if (!store?.id) return
    if (editing) {
      await api.put(`/email-marketing/campaigns/${editing.id}`, { ...form, storeId: store.id })
    } else {
      await api.post('/email-marketing/campaigns', { ...form, storeId: store.id })
    }
    setShowModal(false)
    loadData()
  }

  async function sendNow(id: string) {
    if (!confirm('هل تريد إرسال الحملة الآن؟')) return
    await api.post(`/email-marketing/campaigns/${id}/send`)
    loadData()
  }

  async function deleteCampaign(id: string) {
    if (!confirm('حذف هذه الحملة؟')) return
    await api.delete(`/email-marketing/campaigns/${id}`)
    loadData()
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التسويق بالبريد الإلكتروني</h1>
          <p className="text-gray-500 text-sm">إدارة الحملات والمشتركين</p>
        </div>
        <Button onClick={openCreate}>+ إنشاء حملة</Button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card><CardBody className="pt-4"><p className="text-xs text-gray-500">إجمالي المشتركين</p><p className="text-2xl font-bold">{stats.totalSubscribers}</p></CardBody></Card>
          <Card><CardBody className="pt-4"><p className="text-xs text-gray-500">المشتركون النشطون</p><p className="text-2xl font-bold text-green-700">{stats.activeSubscribers}</p></CardBody></Card>
          <Card><CardBody className="pt-4"><p className="text-xs text-gray-500">الحملات المرسلة</p><p className="text-2xl font-bold">{stats.campaignsSent}</p></CardBody></Card>
          <Card><CardBody className="pt-4"><p className="text-xs text-gray-500">معدل الفتح</p><p className="text-2xl font-bold text-blue-700">{stats.avgOpenRate.toFixed(1)}%</p></CardBody></Card>
        </div>
      )}

      {/* Campaigns table */}
      <Card>
        <CardHeader title="الحملات" />
        <CardBody>
          {loading ? (
            <p className="text-center py-8 text-gray-400">جاري التحميل...</p>
          ) : !campaigns.length ? (
            <p className="text-center py-8 text-gray-400">لا توجد حملات بعد. أنشئ حملتك الأولى!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="p-3 font-medium">اسم الحملة</th>
                  <th className="p-3 font-medium">الموضوع</th>
                  <th className="p-3 font-medium">الحالة</th>
                  <th className="p-3 font-medium">المستلمون</th>
                  <th className="p-3 font-medium">معدل الفتح</th>
                  <th className="p-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map(c => (
                  <tr key={c.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{c.name}</td>
                    <td className="p-3 text-gray-500">{c.subject ?? '—'}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_COLORS[c.status] ?? ''}`}>
                        {STATUS_LABELS[c.status] ?? c.status}
                      </span>
                    </td>
                    <td className="p-3">{c.recipientCount}</td>
                    <td className="p-3">
                      {c.recipientCount > 0 ? `${((c.openCount / c.recipientCount) * 100).toFixed(1)}%` : '—'}
                    </td>
                    <td className="p-3 flex gap-2">
                      {c.status !== 'SENT' && (
                        <button onClick={() => sendNow(c.id)} className="text-green-600 hover:underline text-xs">إرسال</button>
                      )}
                      <button onClick={() => openEdit(c)} className="text-blue-600 hover:underline text-xs">تعديل</button>
                      <button onClick={() => deleteCampaign(c.id)} className="text-red-500 hover:underline text-xs">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {/* Campaign Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4">
            <h2 className="text-lg font-bold">{editing ? 'تعديل الحملة' : 'إنشاء حملة جديدة'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">اسم الحملة *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: عرض رمضان" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">الموضوع (عربي)</label>
                  <Input value={form.subjectAr} onChange={e => setForm(f => ({ ...f, subjectAr: e.target.value }))} placeholder="موضوع البريد" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Subject (EN)</label>
                  <Input value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Email subject" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">محتوى البريد (عربي)</label>
                <textarea
                  value={form.bodyAr}
                  onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))}
                  rows={4}
                  className="w-full rounded-lg border border-gray-200 p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="محتوى البريد الإلكتروني..."
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">تاريخ الجدولة (اختياري)</label>
                <Input type="datetime-local" value={form.scheduledAt} onChange={e => setForm(f => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => setShowModal(false)}>إلغاء</Button>
              <Button onClick={save}>{editing ? 'حفظ التغييرات' : 'إنشاء الحملة'}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
