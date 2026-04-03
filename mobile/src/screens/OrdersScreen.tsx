// ─── Orders Screen — filterable list with status management ──────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Alert,
} from 'react-native'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { ordersApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/constants'
import type { Order, OrderStatus } from '@/types'

const STATUS_FILTERS: { key: OrderStatus | 'ALL'; label: string }[] = [
  { key: 'ALL', label: 'الكل' },
  { key: 'PENDING', label: 'معلق' },
  { key: 'CONFIRMED', label: 'مؤكد' },
  { key: 'PROCESSING', label: 'جاري' },
  { key: 'SHIPPED', label: 'شُحن' },
  { key: 'DELIVERED', label: 'تسليم' },
  { key: 'CANCELLED', label: 'ملغي' },
]

function OrderCard({ order, onPress }: { order: Order; onPress: () => void }) {
  const status = ORDER_STATUS_LABELS[order.status]
  const payment = PAYMENT_STATUS_LABELS[order.paymentStatus]
  const date = new Date(order.createdAt).toLocaleDateString('ar-BH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardHeader}>
        <View>
          <Text style={styles.orderNum}>طلب #{order.orderNumber}</Text>
          <Text style={styles.orderDate}>{date}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status?.color + '20' }]}>
          <Text style={[styles.badgeText, { color: status?.color }]}>{status?.ar}</Text>
        </View>
      </View>

      <View style={styles.cardBody}>
        <View style={styles.customerRow}>
          <Text style={styles.label}>👤</Text>
          <Text style={styles.value}>{order.customer?.name || '—'}</Text>
        </View>
        <View style={styles.customerRow}>
          <Text style={styles.label}>📦</Text>
          <Text style={styles.value}>{order.items?.length || 0} منتجات</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <View style={[styles.payBadge, { backgroundColor: payment?.color + '20' }]}>
          <Text style={[styles.payBadgeText, { color: payment?.color }]}>{payment?.ar}</Text>
        </View>
        <Text style={styles.total}>{Number(order.total).toFixed(3)} BD</Text>
      </View>
    </TouchableOpacity>
  )
}

export default function OrdersScreen() {
  const router = useRouter()
  const { currentStore } = useAuthStore()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'ALL'>('ALL')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [refreshing, setRefreshing] = useState(false)
  const storeId = currentStore?.id || ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', storeId, statusFilter, search, page],
    queryFn: async () => {
      const params: Record<string, any> = { page, limit: 20 }
      if (statusFilter !== 'ALL') params.status = statusFilter
      if (search.trim()) params.search = search.trim()
      const res = await ordersApi.list(storeId, params)
      return res.data
    },
    enabled: !!storeId,
  })

  const orders: Order[] = data?.orders || []

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={(t) => { setSearch(t); setPage(1) }}
          placeholder="ابحث برقم الطلب أو اسم العميل..."
          placeholderTextColor={COLORS.gray400}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Status Filter */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, statusFilter === item.key && styles.filterBtnActive]}
            onPress={() => { setStatusFilter(item.key); setPage(1) }}
          >
            <Text style={[styles.filterText, statusFilter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {isLoading && page === 1 ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push(`/orders/${item.id}` as any)}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>📋</Text>
              <Text style={styles.emptyText}>لا توجد طلبات</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  clearBtn: { padding: 8 },
  filterBar: { maxHeight: 48 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 },
  orderNum: { fontSize: 15, fontWeight: 'bold', color: COLORS.text },
  orderDate: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  cardBody: { gap: 6, marginBottom: 10 },
  customerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 14 },
  value: { fontSize: 13, color: COLORS.textSecondary },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  payBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  payBadgeText: { fontSize: 11, fontWeight: '600' },
  total: { fontSize: 16, fontWeight: 'bold', color: COLORS.text },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
})
