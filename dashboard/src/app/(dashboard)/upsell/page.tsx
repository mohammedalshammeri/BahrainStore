'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface UpsellRule {
  id: string
  name: string
  title: string | null
  titleAr: string | null
  isActive: boolean
  triggerType: string
  offerProductIds: string[]
  discountPct: string | null
  createdAt: string
}

interface Product {
  id: string
  name: string
  nameAr: string
  price: number
}

export default function UpsellPage() {
  const { store } = useAuthStore()
  const [rules, setRules] = useState<UpsellRule[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<UpsellRule | null>(null)
  const [form, setForm] = useState({
    name: '',
    title: '',
    titleAr: '',
    triggerType: 'ANY',
    triggerProductId: '',
    offerProductIds: [] as string[],
    discountPct: '',
    isActive: true,
  })

  const loadData = useCallback(async () => {
    if (!store?.id) return
    setLoading(true)
    try {
      const [r, p] = await Promise.all([
        api.get(`/upsell/rules?storeId=${store.id}`),
        api.get(`/products?storeId=${store.id}&limit=100`),
      ])
      setRules(r.data)
      setProducts(p.data?.products ?? p.data ?? [])
    } finally {
      setLoading(false)
    }
  }, [store?.id])

  useEffect(() => { loadData() }, [loadData])

  function openCreate() {
    setEditing(null)
    setForm({ name: '', title: '', titleAr: '', triggerType: 'ANY', triggerProductId: '', offerProductIds: [], discountPct: '', isActive: true })
    setShowModal(true)
  }

  function openEdit(r: UpsellRule) {
    setEditing(r)
    setForm({
      name: r.name,
      title: r.title ?? '',
      titleAr: r.titleAr ?? '',
      triggerType: r.triggerType,
      triggerProductId: '',
      offerProductIds: r.offerProductIds,
      discountPct: r.discountPct ?? '',
      isActive: r.isActive,
    })
    setShowModal(true)
  }

  async function save() {
    if (!store?.id) return
    const payload = { ...form, storeId: store.id }
    if (editing) {
      await api.put(`/upsell/rules/${editing.id}`, payload)
    } else {
      await api.post('/upsell/rules', payload)
    }
    setShowModal(false)
    loadData()
  }

  async function deleteRule(id: string) {
    if (!confirm('حذف هذه القاعدة؟')) return
    await api.delete(`/upsell/rules/${id}`)
    loadData()
  }

  async function toggleActive(rule: UpsellRule) {
    await api.put(`/upsell/rules/${rule.id}`, { isActive: !rule.isActive, storeId: store?.id })
    loadData()
  }

  function toggleOfferProduct(id: string) {
    setForm(f => ({
      ...f,
      offerProductIds: f.offerProductIds.includes(id)
        ? f.offerProductIds.filter(x => x !== id)
        : [...f.offerProductIds, id],
    }))
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">البيع الإضافي (Upsell)</h1>
          <p className="text-gray-500 text-sm">عرض منتجات إضافية لزيادة متوسط قيمة الطلب</p>
        </div>
        <Button onClick={openCreate}>+ إضافة قاعدة</Button>
      </div>

      <Card>
        <CardHeader title="قواعد البيع الإضافي" />
        <CardBody>
          {loading ? (
            <p className="text-center py-8 text-gray-400">جاري التحميل...</p>
          ) : !rules.length ? (
            <p className="text-center py-8 text-gray-400">لا توجد قواعد. أنشئ قاعدتك الأولى!</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-right">
                  <th className="p-3 font-medium">الاسم</th>
                  <th className="p-3 font-medium">نوع المشغّل</th>
                  <th className="p-3 font-medium">المنتجات المعروضة</th>
                  <th className="p-3 font-medium">خصم</th>
                  <th className="p-3 font-medium">نشط</th>
                  <th className="p-3 font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {rules.map(r => (
                  <tr key={r.id} className="border-t hover:bg-gray-50">
                    <td className="p-3 font-medium">{r.name}</td>
                    <td className="p-3 text-gray-500">
                      {r.triggerType === 'ANY' ? 'أي منتج' : r.triggerType === 'SPECIFIC_PRODUCT' ? 'منتج محدد' : 'فئة محددة'}
                    </td>
                    <td className="p-3">{r.offerProductIds.length} منتج</td>
                    <td className="p-3">{r.discountPct ? `${r.discountPct}%` : '—'}</td>
                    <td className="p-3">
                      <button
                        onClick={() => toggleActive(r)}
                        className={`relative inline-flex h-5 w-9 rounded-full transition-colors ${r.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${r.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                      </button>
                    </td>
                    <td className="p-3 flex gap-2">
                      <button onClick={() => openEdit(r)} className="text-blue-600 hover:underline text-xs">تعديل</button>
                      <button onClick={() => deleteRule(r.id)} className="text-red-500 hover:underline text-xs">حذف</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl p-6 space-y-4 my-4">
            <h2 className="text-lg font-bold">{editing ? 'تعديل القاعدة' : 'إنشاء قاعدة جديدة'}</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">اسم القاعدة *</label>
                <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="مثال: بيع إضافي للجوالات" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">عنوان العرض (عربي)</label>
                  <Input value={form.titleAr} onChange={e => setForm(f => ({ ...f, titleAr: e.target.value }))} placeholder="قد يعجبك أيضاً" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Title (EN)</label>
                  <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="You might also like" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نوع المشغّل</label>
                <select
                  value={form.triggerType}
                  onChange={e => setForm(f => ({ ...f, triggerType: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg p-2 text-sm"
                >
                  <option value="ANY">أي منتج في السلة</option>
                  <option value="SPECIFIC_PRODUCT">منتج محدد</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">نسبة الخصم (اختياري %)</label>
                <Input
                  type="number"
                  value={form.discountPct}
                  onChange={e => setForm(f => ({ ...f, discountPct: e.target.value }))}
                  placeholder="مثال: 10"
                  min={0}
                  max={100}
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">اختر المنتجات المعروضة</label>
                <div className="max-h-48 overflow-y-auto border rounded-lg divide-y">
                  {products.map(p => (
                    <label key={p.id} className="flex items-center gap-2 p-2 cursor-pointer hover:bg-gray-50">
                      <input
                        type="checkbox"
                        checked={form.offerProductIds.includes(p.id)}
                        onChange={() => toggleOfferProduct(p.id)}
                      />
                      <span className="text-sm">{p.nameAr || p.name}</span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-gray-400 mt-1">تم اختيار {form.offerProductIds.length} منتج</p>
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
