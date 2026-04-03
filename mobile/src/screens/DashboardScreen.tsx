// ─── Dashboard Screen — KPI cards + charts + recent orders ───────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { analyticsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS, ORDER_STATUS_LABELS } from '@/constants'
import type { DashboardStats, Order } from '@/types'

const { width } = Dimensions.get('window')
const PERIODS = [
  { key: 'today', label: 'اليوم' },
  { key: '7d', label: '7 أيام' },
  { key: '30d', label: '30 يوم' },
  { key: '90d', label: '90 يوم' },
] as const
type Period = typeof PERIODS[number]['key']

function StatCard({ title, value, growth, icon, color }: {
  title: string; value: string; growth?: number; icon: string; color: string
}) {
  return (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={styles.statHeader}>
        <Text style={styles.statIcon}>{icon}</Text>
        {growth !== undefined && (
          <View style={[styles.growthBadge, { backgroundColor: growth >= 0 ? '#DCFCE7' : '#FEE2E2' }]}>
            <Text style={[styles.growthText, { color: growth >= 0 ? '#16A34A' : '#DC2626' }]}>
              {growth >= 0 ? '▲' : '▼'} {Math.abs(growth).toFixed(1)}%
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  )
}

function OrderRow({ order, onPress }: { order: Order; onPress: () => void }) {
  const status = ORDER_STATUS_LABELS[order.status]
  return (
    <TouchableOpacity style={styles.orderRow} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.orderInfo}>
        <Text style={styles.orderNumber}>#{order.orderNumber}</Text>
        <Text style={styles.orderCustomer}>{order.customer?.name || 'عميل'}</Text>
      </View>
      <View style={styles.orderRight}>
        <Text style={styles.orderTotal}>{Number(order.total).toFixed(3)} BD</Text>
        <View style={[styles.statusBadge, { backgroundColor: status?.color + '20' }]}>
          <Text style={[styles.statusText, { color: status?.color }]}>{status?.ar}</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function DashboardScreen() {
  const router = useRouter()
  const { currentStore } = useAuthStore()
  const [period, setPeriod] = useState<Period>('7d')
  const [refreshing, setRefreshing] = useState(false)
  const storeId = currentStore?.id || ''

  const { data, isLoading, refetch } = useQuery<DashboardStats>({
    queryKey: ['dashboard', storeId, period],
    queryFn: async () => {
      const res = await analyticsApi.getDashboard(storeId, period)
      return res.data
    },
    enabled: !!storeId,
    staleTime: 60_000,
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  if (isLoading && !data) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    )
  }

  const currency = currentStore?.currency || 'BHD'

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
    >
      {/* Store Name Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>مرحباً 👋</Text>
        <Text style={styles.storeName}>{currentStore?.nameAr || currentStore?.name}</Text>
      </View>

      {/* Period Selector */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.periodBar}>
        {PERIODS.map(p => (
          <TouchableOpacity
            key={p.key}
            style={[styles.periodBtn, period === p.key && styles.periodBtnActive]}
            onPress={() => setPeriod(p.key)}
          >
            <Text style={[styles.periodBtnText, period === p.key && styles.periodBtnTextActive]}>
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* KPI Cards */}
      <View style={styles.statsGrid}>
        <StatCard
          title="الإيرادات"
          value={`${Number(data?.revenue ?? 0).toFixed(3)} ${currency}`}
          growth={data?.revenueGrowth}
          icon="💰"
          color={COLORS.success}
        />
        <StatCard
          title="الطلبات"
          value={String(data?.orders ?? 0)}
          growth={data?.ordersGrowth}
          icon="📦"
          color={COLORS.info}
        />
        <StatCard
          title="العملاء"
          value={String(data?.customers ?? 0)}
          growth={data?.customersGrowth}
          icon="👥"
          color={COLORS.primary}
        />
        <StatCard
          title="المنتجات"
          value={String(data?.products ?? 0)}
          icon="🏷️"
          color={COLORS.warning}
        />
      </View>

      {/* Quick Actions */}
      <View style={styles.quickActions}>
        <Text style={styles.sectionTitle}>إجراءات سريعة</Text>
        <View style={styles.actionRow}>
          {[
            { icon: '📷', label: 'نقطة البيع', route: '/(tabs)/pos' },
            { icon: '➕', label: 'منتج جديد', route: '/products/new' },
            { icon: '📋', label: 'الطلبات', route: '/(tabs)/orders' },
            { icon: '📊', label: 'التقارير', route: '/(tabs)/analytics' },
          ].map((a) => (
            <TouchableOpacity
              key={a.route}
              style={styles.actionBtn}
              onPress={() => router.push(a.route as any)}
            >
              <Text style={styles.actionIcon}>{a.icon}</Text>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Top Products */}
      {(data?.topProducts?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أعلى المنتجات مبيعاً</Text>
          {data?.topProducts?.slice(0, 5).map((p, i) => (
            <View key={i} style={styles.topProductRow}>
              <Text style={styles.topProductRank}>#{i + 1}</Text>
              <View style={styles.topProductInfo}>
                <Text style={styles.topProductName} numberOfLines={1}>{p.name}</Text>
                <Text style={styles.topProductSales}>{p.totalSold} مبيعة</Text>
              </View>
              <Text style={styles.topProductRevenue}>
                {Number(p.revenue).toFixed(3)} {currency}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Recent Orders */}
      {(data?.recentOrders?.length ?? 0) > 0 && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>أحدث الطلبات</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/orders')}>
              <Text style={styles.seeAll}>عرض الكل</Text>
            </TouchableOpacity>
          </View>
          {data?.recentOrders?.slice(0, 5).map(order => (
            <OrderRow
              key={order.id}
              order={order}
              onPress={() => router.push(`/orders/${order.id}` as any)}
            />
          ))}
        </View>
      )}

      <View style={{ height: 20 }} />
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  greeting: { fontSize: 14, color: COLORS.textSecondary },
  storeName: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  periodBar: { paddingHorizontal: 16, paddingVertical: 12 },
  periodBtn: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    marginRight: 8, backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  periodBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  periodBtnText: { fontSize: 13, color: COLORS.textSecondary },
  periodBtnTextActive: { color: '#fff', fontWeight: '600' },
  statsGrid: {
    flexDirection: 'row', flexWrap: 'wrap',
    paddingHorizontal: 12, gap: 10, marginBottom: 16,
  },
  statCard: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    width: (width - 44) / 2, borderLeftWidth: 4,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  statHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  statIcon: { fontSize: 22 },
  growthBadge: { borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  growthText: { fontSize: 10, fontWeight: '600' },
  statValue: { fontSize: 22, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  statTitle: { fontSize: 12, color: COLORS.textSecondary },
  quickActions: {
    backgroundColor: COLORS.card, marginHorizontal: 12, borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between' },
  actionBtn: { alignItems: 'center', flex: 1 },
  actionIcon: { fontSize: 26, marginBottom: 6 },
  actionLabel: { fontSize: 11, color: COLORS.textSecondary, textAlign: 'center' },
  section: {
    backgroundColor: COLORS.card, marginHorizontal: 12, borderRadius: 14,
    padding: 16, marginBottom: 16,
  },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  seeAll: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  topProductRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 12 },
  topProductRank: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary, width: 24 },
  topProductInfo: { flex: 1 },
  topProductName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  topProductSales: { fontSize: 12, color: COLORS.textSecondary },
  topProductRevenue: { fontSize: 14, color: COLORS.text, fontWeight: '600' },
  orderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: COLORS.gray100,
  },
  orderInfo: { flex: 1 },
  orderNumber: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  orderCustomer: { fontSize: 12, color: COLORS.textSecondary },
  orderRight: { alignItems: 'flex-end', gap: 4 },
  orderTotal: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2 },
  statusText: { fontSize: 11, fontWeight: '600' },
})
