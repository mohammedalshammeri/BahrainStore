// ─── Notifications Screen ─────────────────────────────────────────────────────

import React, { useCallback } from 'react'
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert } from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { notificationsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'
import type { NotificationItem } from '@/types'

const ICONS: Record<string, string> = {
  NEW_ORDER:       '🛒',
  LOW_STOCK:       '📦',
  ORDER_CANCELLED: '❌',
  PAYMENT:         '💳',
  REVIEW:          '⭐',
  SYSTEM:          '🔔',
}

function NotifCard({ item, onPress, onMarkRead }: {
  item: NotificationItem; onPress: () => void; onMarkRead: () => void
}) {
  const icon = ICONS[item.type] || '🔔'
  const date = new Date(item.createdAt).toLocaleDateString('ar-BH', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  })

  return (
    <TouchableOpacity
      style={[styles.card, !item.isRead && styles.cardUnread]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.iconBox}>
        <Text style={styles.icon}>{icon}</Text>
        {!item.isRead && <View style={styles.unreadDot} />}
      </View>
      <View style={styles.content}>
        <Text style={[styles.title, !item.isRead && styles.titleBold]}>{item.title}</Text>
        <Text style={styles.body} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.date}>{date}</Text>
      </View>
      {!item.isRead && (
        <TouchableOpacity style={styles.readBtn} onPress={onMarkRead} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Text style={styles.readBtnText}>✓</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  )
}

export default function NotificationsScreen() {
  const router = useRouter()
  const { currentStore } = useAuthStore()
  const queryClient = useQueryClient()
  const storeId = currentStore?.id || ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['notifications', storeId],
    queryFn: async () => {
      const res = await notificationsApi.list(storeId)
      return (res.data?.notifications || []) as NotificationItem[]
    },
    enabled: !!storeId,
  })

  const markReadMutation = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', storeId] }),
  })

  const markAllMutation = useMutation({
    mutationFn: () => notificationsApi.markAllRead(storeId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications', storeId] }),
  })

  const [refreshing, setRefreshing] = React.useState(false)
  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  const notifications = data || []
  const unreadCount = notifications.filter(n => !n.isRead).length

  const onNotifPress = (n: NotificationItem) => {
    if (!n.isRead) markReadMutation.mutate(n.id)
    // Navigate based on notification type
    if (n.type === 'NEW_ORDER' && n.data?.orderId) {
      router.push(`/orders/${n.data.orderId}` as any)
    } else if (n.type === 'LOW_STOCK' && n.data?.productId) {
      router.push(`/products/${n.data.productId}` as any)
    }
  }

  return (
    <View style={styles.container}>
      {/* Header Actions */}
      {unreadCount > 0 && (
        <View style={styles.header}>
          <Text style={styles.unreadCount}>{unreadCount} غير مقروء</Text>
          <TouchableOpacity
            onPress={() => markAllMutation.mutate()}
            disabled={markAllMutation.isPending}
          >
            <Text style={styles.markAllText}>
              {markAllMutation.isPending ? '...' : 'تحديد الكل كمقروء'}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => n.id}
          renderItem={({ item }) => (
            <NotifCard
              item={item}
              onPress={() => onNotifPress(item)}
              onMarkRead={() => markReadMutation.mutate(item.id)}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 8 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🔔</Text>
              <Text style={styles.emptyText}>لا توجد إشعارات</Text>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 10,
    backgroundColor: COLORS.card, borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  unreadCount: { fontSize: 13, color: COLORS.textSecondary },
  markAllText: { fontSize: 13, color: COLORS.primary, fontWeight: '600' },
  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: COLORS.card, borderRadius: 14, padding: 14,
    shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  cardUnread: { borderLeftWidth: 3, borderLeftColor: COLORS.primary },
  iconBox: { position: 'relative' },
  icon: { fontSize: 26 },
  unreadDot: {
    position: 'absolute', top: -2, right: -2,
    width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary,
  },
  content: { flex: 1 },
  title: { fontSize: 14, color: COLORS.text, marginBottom: 3 },
  titleBold: { fontWeight: 'bold' },
  body: { fontSize: 13, color: COLORS.textSecondary, lineHeight: 18, marginBottom: 4 },
  date: { fontSize: 11, color: COLORS.gray400 },
  readBtn: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.primaryLight, alignItems: 'center', justifyContent: 'center',
  },
  readBtnText: { fontSize: 14, color: COLORS.primary, fontWeight: 'bold' },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
})
