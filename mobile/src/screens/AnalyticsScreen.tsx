// ─── Analytics Screen ─────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'

const { width: SCREEN_W } = Dimensions.get('window')

const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: '7d',    label: '7 أيام' },
  { key: '30d',   label: '30 يوم' },
  { key: '90d',   label: '3 أشهر' },
]

function StatBox({ label, value, sub, color = COLORS.primary }: {
  label: string; value: string; sub?: string; color?: string
}) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
      {sub && <Text style={styles.statSub}>{sub}</Text>}
    </View>
  )
}

// Simple inline bar chart — no external chart library required
function BarChart({ data, color = COLORS.primary }: { data: { label: string; value: number }[]; color?: string }) {
  if (!data || data.length === 0) return null
  const max = Math.max(...data.map(d => d.value), 1)
  const CHART_H = 100
  const barWidth = Math.floor((SCREEN_W - 48) / data.length) - 4

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H + 24, gap: 4 }}>
      {data.map((d, i) => {
        const h = Math.max(4, Math.round((d.value / max) * CHART_H))
        return (
          <View key={i} style={{ alignItems: 'center', width: barWidth }}>
            <View style={{ width: barWidth, height: h, backgroundColor: color, borderRadius: 4 }} />
            <Text style={{ fontSize: 9, color: COLORS.textSecondary, marginTop: 3 }} numberOfLines={1}>{d.label}</Text>
          </View>
        )
      })}
    </View>
  )
}

export default function AnalyticsScreen() {
  const { currentStore } = useAuthStore()
  const [period, setPeriod] = useState<'today' | '7d' | '30d' | '90d'>('30d')
  const [refreshing, setRefreshing] = useState(false)
  const storeId = currentStore?.id || ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['analytics', storeId, period],
    queryFn: async () => {
      const res = await analyticsApi.getDashboard(storeId, period)
      return res.data
    },
    enabled: !!storeId,
  })

  const { data: revenueData, isLoading: revLoading } = useQuery({
    queryKey: ['revenue-chart', storeId, period],
    queryFn: async () => {
      const endDate = new Date().toISOString().split('T')[0]
      const days = period === 'today' ? 1 : period === '7d' ? 7 : period === '90d' ? 90 : 30
      const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0]
      const res = await analyticsApi.getRevenue(storeId, startDate, endDate)
      return res.data
    },
    enabled: !!storeId,
  })

  const { data: topProducts } = useQuery({
    queryKey: ['top-products', storeId, period],
    queryFn: async () => {
      const res = await analyticsApi.getTopProducts(storeId, 10)
      return res.data?.products || []
    },
    enabled: !!storeId,
  })

  const onRefresh = async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }

  const stats = data

  const chartData: { label: string; value: number }[] = (revenueData?.daily || [])
    .slice(-14)
    .map((d: any) => ({
      label: new Date(d.date).toLocaleDateString('ar', { day: 'numeric', month: 'numeric' }),
      value: Number(d.revenue || 0),
    }))

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Period Selector */}
      <View style={styles.periodRow}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key as any)}
          >
            <Text style={[styles.periodText, period === p.key && styles.periodTextActive]}>{p.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
      ) : (
        <>
          {/* KPI Grid */}
          <View style={styles.statsGrid}>
            <StatBox
              label="الإيرادات"
              value={`${Number(stats?.revenue || 0).toFixed(3)} BD`}
              sub={stats?.revenueGrowth ? `${stats.revenueGrowth > 0 ? '+' : ''}${stats.revenueGrowth.toFixed(1)}%` : undefined}
              color={COLORS.primary}
            />
            <StatBox
              label="الطلبات"
              value={String(stats?.orders || 0)}
              sub={stats?.ordersGrowth ? `${stats.ordersGrowth > 0 ? '+' : ''}${stats.ordersGrowth.toFixed(1)}%` : undefined}
              color={COLORS.info}
            />
            <StatBox
              label="العملاء"
              value={String(stats?.customers || 0)}
              sub={stats?.customersGrowth ? `${stats.customersGrowth > 0 ? '+' : ''}${stats.customersGrowth.toFixed(1)}%` : undefined}
              color={COLORS.success}
            />
            <StatBox
              label="متوسط الطلب"
              value={`${Number(stats?.avgOrderValue || 0).toFixed(3)} BD`}
              color={COLORS.warning}
            />
          </View>

          {/* Revenue Chart */}
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📈 الإيرادات اليومية</Text>
            {revLoading ? (
              <ActivityIndicator color={COLORS.primary} />
            ) : chartData.length > 0 ? (
              <BarChart data={chartData} color={COLORS.primary} />
            ) : (
              <Text style={styles.noData}>لا توجد بيانات</Text>
            )}
          </View>

          {/* Conversion Rates */}
          {stats && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>📊 مؤشرات الأداء</Text>
              <PerformanceRow label="معدل التحويل" value={`${(stats.conversionRate || 0).toFixed(1)}%`} />
              <PerformanceRow label="متوسط قيمة السلة" value={`${Number(stats.avgOrderValue || 0).toFixed(3)} BD`} />
              <PerformanceRow label="الطلبات الملغاة" value={`${stats.cancelledOrders || 0}`} />
            </View>
          )}

          {/* Top Products */}
          {topProducts && topProducts.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🏆 أفضل المنتجات</Text>
              {topProducts.slice(0, 8).map((p: any, i: number) => (
                <View key={p.id || i} style={styles.topProductRow}>
                  <Text style={styles.topProductRank}>{i + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
                    <Text style={styles.topProductSales}>{p.totalSold} مبيعة</Text>
                  </View>
                  <Text style={styles.topProductRevenue}>{Number(p.revenue || 0).toFixed(3)} BD</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  )
}

function PerformanceRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.perfRow}>
      <Text style={styles.perfLabel}>{label}</Text>
      <Text style={styles.perfValue}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  periodRow: { flexDirection: 'row', gap: 8 },
  periodBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center',
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodText: { fontSize: 13, color: COLORS.textSecondary },
  periodTextActive: { color: '#fff', fontWeight: '600' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statBox: {
    flex: 1, minWidth: '45%', backgroundColor: COLORS.card, borderRadius: 14,
    padding: 14, alignItems: 'center',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statLabel: { fontSize: 12, color: COLORS.textSecondary, marginBottom: 6 },
  statValue: { fontSize: 20, fontWeight: 'bold' },
  statSub: { fontSize: 11, color: COLORS.success, marginTop: 4 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 14 },
  noData: { color: COLORS.textSecondary, textAlign: 'center', paddingVertical: 20 },
  perfRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  perfLabel: { fontSize: 14, color: COLORS.textSecondary },
  perfValue: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  topProductRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  topProductRank: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, width: 22 },
  topProductName: { fontSize: 14, color: COLORS.text },
  topProductSales: { fontSize: 12, color: COLORS.textSecondary },
  topProductRevenue: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
})
