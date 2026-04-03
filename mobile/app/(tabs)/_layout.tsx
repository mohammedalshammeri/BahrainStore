// ─── Main Tabs Layout ─────────────────────────────────────────────────────────

import React from 'react'
import { Tabs } from 'expo-router'
import { View, Text, StyleSheet } from 'react-native'
import { useQuery } from '@tanstack/react-query'
import { notificationsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'

function TabIcon({ label, emoji, focused }: { label: string; emoji: string; focused: boolean }) {
  return (
    <View style={[tabStyles.iconBox, focused && tabStyles.iconBoxActive]}>
      <Text style={tabStyles.emoji}>{emoji}</Text>
      <Text style={[tabStyles.label, focused && tabStyles.labelActive]}>{label}</Text>
    </View>
  )
}

function NotifTabIcon({ focused }: { focused: boolean }) {
  const { currentStore } = useAuthStore()
  const storeId = currentStore?.id || ''

  const { data } = useQuery({
    queryKey: ['notifications-count', storeId],
    queryFn: async () => {
      const res = await notificationsApi.list(storeId)
      const notifs = res.data?.notifications || []
      return notifs.filter((n: any) => !n.isRead).length
    },
    enabled: !!storeId,
    refetchInterval: 30000, // poll every 30s
  })

  return (
    <View style={{ position: 'relative' }}>
      <TabIcon label="الطلبات" emoji="📋" focused={focused} />
      {data > 0 && (
        <View style={tabStyles.badge}>
          <Text style={tabStyles.badgeText}>{data > 9 ? '9+' : data}</Text>
        </View>
      )}
    </View>
  )
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarStyle: {
          backgroundColor: COLORS.card,
          borderTopColor: COLORS.border,
          height: 62,
          paddingBottom: 8,
        },
        tabBarShowLabel: false,
        headerStyle: { backgroundColor: COLORS.card },
        headerTintColor: COLORS.text,
        headerTitleStyle: { fontWeight: 'bold', fontSize: 17 },
        headerTitleAlign: 'center',
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'لوحة التحكم',
          tabBarIcon: ({ focused }) => <TabIcon label="الرئيسية" emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="orders"
        options={{
          title: 'الطلبات',
          tabBarIcon: ({ focused }) => <TabIcon label="الطلبات" emoji="📋" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pos"
        options={{
          title: 'نقطة البيع',
          tabBarIcon: ({ focused }) => (
            <View style={[tabStyles.posBtn, focused && tabStyles.posBtnActive]}>
              <Text style={tabStyles.posEmoji}>🛒</Text>
            </View>
          ),
        }}
      />
      <Tabs.Screen
        name="products"
        options={{
          title: 'المنتجات',
          tabBarIcon: ({ focused }) => <TabIcon label="المنتجات" emoji="🛍️" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'الإعدادات',
          tabBarIcon: ({ focused }) => <TabIcon label="الإعدادات" emoji="⚙️" focused={focused} />,
        }}
      />
    </Tabs>
  )
}

const tabStyles = StyleSheet.create({
  iconBox: { alignItems: 'center', paddingTop: 4 },
  iconBoxActive: {},
  emoji: { fontSize: 22 },
  label: { fontSize: 10, color: COLORS.textSecondary, marginTop: 2 },
  labelActive: { color: COLORS.primary, fontWeight: '600' },
  badge: {
    position: 'absolute', top: 0, right: -4,
    backgroundColor: COLORS.danger, borderRadius: 8,
    minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 3,
  },
  badgeText: { color: '#fff', fontSize: 9, fontWeight: 'bold' },
  posBtn: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
    marginBottom: 20,
    shadowColor: COLORS.primary, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  posBtnActive: { backgroundColor: COLORS.primary },
  posEmoji: { fontSize: 26 },
})
