'use client'

import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface HelpArticle {
  id: string
  slug: string
  title: string
  titleAr: string
  category: string
  categoryAr: string
  isPublished: boolean
  sortOrder: number
  viewCount: number
}

export default function HelpCenterPage() {
  const [articles, setArticles] = useState<HelpArticle[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<HelpArticle | null>(null)
  const [fullArticle, setFullArticle] = useState<any>(null)
  const [form, setForm] = useState({
    slug: '',
    title: '',
    titleAr: '',
    body: '',
    bodyAr: '',
    category: 'general',
    categoryAr: 'عام',
    isPublished: false,
    sortOrder: 0,
  })

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api.get('/help/articles')
      setArticles(res.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setFullArticle(null)
    setForm({ slug: '', title: '', titleAr: '', body: '', bodyAr: '', category: 'general', categoryAr: 'عام', isPublished: false, sortOrder: 0 })
    setShowModal(true)
  }

  async function openEdit(a: HelpArticle) {
    setEditing(a)
    // Load full article for body fields
    const res = await api.get(`/help/articles`)
    const full = res.data.find((x: any) => x.id === a.id)
    setFullArticle(full)
    setForm({
      slug: a.slug,
      title: a.title,
      titleAr: a.titleAr,
      body: full?.body ?? '',
      bodyAr: full?.bodyAr ?? '',
      category: a.category,
      categoryAr: a.categoryAr,
      isPublished: a.isPublished,
      sortOrder: a.sortOrder,
    })
    setShowModal(true)
  }

  async function save() {
    if (!form.slug || !form.title || !form.titleAr) return
    if (editing) {
      await api.put(`/help/articles/${editing.id}`, form)
    } else {
      await api.post('/help/articles', form)
    }
    setShowModal(false)
    loadData()
  }

  async function deleteArticle(id: string) {
    if (!confirm('حذف هذه المقالة؟')) return
    await api.delete(`/help/articles/${id}`)
    loadData()
  }

  function generateSlug(titleAr: string) {
    return titleAr
      .trim()
      .replace(/[\s]+/g, '-')
      .replace(/[^\w\u0600-\u06FF-]/g, '')
      .toLowerCase()
      .slice(0, 60)
  }

  // Group by category
  const categories = [...new Set(articles.map(a => a.categoryAr))]

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مركز المساعدة</h1>
          <p className="text-gray-500 text-sm">إدارة مقالات وفئات مركز المساعدة</p>
        </div>
        <Button onClick={openCreate}>+ مقالة جديدة</Button>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">جاري التحميل...</div>
      ) : !articles.length ? (
        <Card><CardBody className="py-12 text-center text-gray-400">لا توجد مقالات بعد</CardBody></Card>
      ) : (
        categories.map(cat => (
          <Card key={cat}>
            <CardHeader title="{cat}" />
            <CardBody>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-right">
                    <th className="p-2 font-medium">العنوان</th>
                    <th className="p-2 font-medium">Slug</th>
                    <th className="p-2 font-medium">الحالة</th>
                    <th className="p-2 font-medium">المشاهدات</th>
                    <th className="p-2 font-medium">إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {articles.filter(a => a.categoryAr === cat).map(a => (
                    <tr key={a.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{a.titleAr}</td>
                      <td className="p-2 text-gray-400 font-mono text-xs">{a.slug}</td>
                      <td className="p-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${a.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {a.isPublished ? 'منشور' : 'مسودة'}
                        </span>
                      </td>
                      <td className="p-2 text-gray-500">{a.viewCount}</td>
                      <td className="p-2 flex gap-2">
                        <button onClick={() => openEdit(a)} className="text-blue-600 hover:underline text-xs">تعديل</button>
                        <button onClick={() => deleteArticle(a.id)} className="text-red-500 hover:underline text-xs">حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardBody>
          </Card>
        ))
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl p-6 space-y-4 my-4">
            <h2 className="text-lg font-bold">{editing ? 'تعديل مقالة' : 'مقالة جديدة'}</h2>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">العنوان (عربي) *</label>
                  <Input
                    value={form.titleAr}
                    onChange={e => {
                      const titleAr = e.target.value
                      setForm(f => ({ ...f, titleAr, slug: f.slug || generateSlug(titleAr) }))
                    }}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title (EN) *</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Slug (رابط) *</label>
                <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} className="font-mono" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">الفئة (عربي)</label>
                  <Input value={form.categoryAr} onChange={e => setForm(f => ({ ...f, categoryAr: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Category (EN)</label>
                  <Input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">المحتوى (عربي) *</label>
                <textarea value={form.bodyAr} onChange={e => setForm(f => ({ ...f, bodyAr: e.target.value }))} rows={6} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none" placeholder="محتوى مقالة المساعدة..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content (EN)</label>
                <textarea value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} rows={4} className="w-full border border-gray-200 rounded-lg p-3 text-sm resize-none" placeholder="Article content..." />
              </div>
              <div className="flex gap-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={form.isPublished} onChange={e => setForm(f => ({ ...f, isPublished: e.target.checked }))} />
                  <span className="text-sm">نشر المقالة</span>
                </label>
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium">الترتيب:</label>
                  <Input type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: parseInt(e.target.value) || 0 }))} className="w-20" />
                </div>
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
