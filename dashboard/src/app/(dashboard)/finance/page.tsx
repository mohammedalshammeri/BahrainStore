'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/store/auth.store'
import { api } from '@/lib/api'
import { Card, CardBody, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface FinanceSummary {
  revenue: number
  vat: number
  net: number
  refunded: number
  ordersCount: number
  prevRevenue: number
  growth: number | null
  daily: { date: string; amount: number }[]
}

export default function FinancePage() {
  const { store } = useAuthStore()
  const [period, setPeriod] = useState('30')
  const [summary, setSummary] = useState<FinanceSummary | null>(null)
  const [vatReport, setVatReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'vat'>('overview')

  useEffect(() => {
    if (!store?.id) return
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store?.id, period])

  async function loadData() {
    setLoading(true)
    try {
      const [sum, vat] = await Promise.all([
        api.get(`/finance/summary?storeId=${store!.id}&period=${period}`),
        api.get(`/finance/vat-report?storeId=${store!.id}&year=${new Date().getFullYear()}`),
      ])
      setSummary(sum.data)
      setVatReport(vat.data)
    } finally {
      setLoading(false)
    }
  }

  async function exportCSV() {
    const url = `${process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001'}/api/v1/finance/export?storeId=${store!.id}&period=${period}&format=csv`
    window.open(url, '_blank')
  }

  const fmt = (n: number) =>
    new Intl.NumberFormat('ar-BH', { minimumFractionDigits: 3, maximumFractionDigits: 3 }).format(n)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">التقارير المالية</h1>
          <p className="text-gray-500 text-sm">ملخص الإيرادات، الضريبة، والأرباح</p>
        </div>
        <div className="flex gap-2">
          {['7', '30', '90', '365'].map(d => (
            <button
              key={d}
              onClick={() => setPeriod(d)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                period === d ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {d === '365' ? 'سنة' : d === '90' ? '3 أشهر' : d === '30' ? '30 يوم' : '7 أيام'}
            </button>
          ))}
          <Button onClick={exportCSV} variant="outline" size="sm">
            ⬇ تصدير CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-4 border-b">
        {(['overview', 'vat'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`pb-2 px-1 text-sm font-medium border-b-2 transition-colors ${
              tab === t ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'overview' ? 'نظرة عامة' : 'تقرير ضريبة القيمة المضافة'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">جاري التحميل...</div>
      ) : tab === 'overview' ? (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardBody className="pt-5">
                <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{fmt(summary?.revenue ?? 0)} BHD</p>
                {summary?.growth !== null && summary?.growth !== undefined && (
                  <p className={`text-xs mt-1 ${summary.growth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {summary.growth >= 0 ? '↑' : '↓'} {Math.abs(summary.growth).toFixed(1)}% مقارنة بالفترة السابقة
                  </p>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardBody className="pt-5">
                <p className="text-sm text-gray-500">صافي الإيرادات</p>
                <p className="text-2xl font-bold text-green-700 mt-1">{fmt(summary?.net ?? 0)} BHD</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="pt-5">
                <p className="text-sm text-gray-500">ضريبة القيمة المضافة</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">{fmt(summary?.vat ?? 0)} BHD</p>
              </CardBody>
            </Card>
            <Card>
              <CardBody className="pt-5">
                <p className="text-sm text-gray-500">المبالغ المستردة</p>
                <p className="text-2xl font-bold text-red-600 mt-1">{fmt(summary?.refunded ?? 0)} BHD</p>
                <p className="text-xs text-gray-400 mt-1">عدد الطلبات: {summary?.ordersCount ?? 0}</p>
              </CardBody>
            </Card>
          </div>

          {/* Daily chart — simple bar table */}
          <Card>
            <CardHeader title="الإيرادات اليومية" />
            <CardBody>
              {!summary?.daily?.length ? (
                <p className="text-gray-400 text-sm text-center py-6">لا توجد بيانات</p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="flex items-end gap-1 h-32 min-w-[400px]">
                    {summary.daily.map(d => {
                      const max = Math.max(...summary.daily.map(x => x.amount), 1)
                      const pct = (d.amount / max) * 100
                      return (
                        <div key={d.date} className="flex flex-col items-center flex-1 gap-1">
                          <span className="text-[9px] text-gray-400">{fmt(d.amount)}</span>
                          <div
                            className="bg-blue-500 rounded-t w-full"
                            style={{ height: `${pct}%`, minHeight: '2px' }}
                          />
                          <span className="text-[9px] text-gray-400 rotate-90 origin-left mt-2">
                            {d.date.slice(5)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        </>
      ) : (
        /* VAT Report */
        <Card>
          <CardHeader title="تقرير ضريبة القيمة المضافة — {new Date().getFullYear()}" />
          <CardBody>
            <div className="grid grid-cols-3 gap-4 mb-6">
              <div className="text-center">
                <p className="text-sm text-gray-500">إجمالي الإيرادات</p>
                <p className="text-xl font-bold">{fmt(vatReport?.totalRevenue ?? 0)} BHD</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">الإيرادات قبل الضريبة</p>
                <p className="text-xl font-bold text-blue-700">{fmt(vatReport?.totalNet ?? 0)} BHD</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-500">إجمالي الضريبة (5%)</p>
                <p className="text-xl font-bold text-orange-600">{fmt(vatReport?.totalVat ?? 0)} BHD</p>
              </div>
            </div>
            {vatReport?.monthly?.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-right p-2 font-medium">الشهر</th>
                    <th className="text-right p-2 font-medium">الإيرادات</th>
                    <th className="text-right p-2 font-medium">الضريبة</th>
                    <th className="text-right p-2 font-medium">عدد الطلبات</th>
                  </tr>
                </thead>
                <tbody>
                  {vatReport.monthly.map((m: any) => (
                    <tr key={m.month} className="border-t hover:bg-gray-50">
                      <td className="p-2">الشهر {m.month}</td>
                      <td className="p-2">{fmt(m.revenue)} BHD</td>
                      <td className="p-2 text-orange-600">{fmt(m.vat)} BHD</td>
                      <td className="p-2">{m.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-gray-400 text-sm text-center py-6">لا توجد بيانات لهذا العام</p>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  )
}
