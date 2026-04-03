// ─── Root Layout ── auth guard + providers ────────────────────────────────────

import React, { useEffect } from 'react'
import { Stack, useRouter, useSegments } from 'expo-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import * as Notifications from 'expo-notifications'
import { useAuthStore } from '@/store/auth.store'
import { notificationsApi } from '@/api'
import { View, ActivityIndicator } from 'react-native'
import { COLORS } from '@/constants'

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
})

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 min
      retry: 2,
    },
  },
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading, loadFromStorage, currentStore, token } = useAuthStore()
  const router = useRouter()
  const segments = useSegments()

  useEffect(() => {
    loadFromStorage()
  }, [])

  useEffect(() => {
    if (isLoading) return
    const inAuthGroup = segments[0] === '(auth)'
    if (!isAuthenticated && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (isAuthenticated && inAuthGroup) {
      router.replace('/(tabs)/dashboard')
    }
  }, [isAuthenticated, isLoading, segments])

  // Register push notification token after login
  useEffect(() => {
    if (!isAuthenticated || !token || !currentStore?.id) return
    const registerPush = async () => {
      try {
        const { status } = await Notifications.requestPermissionsAsync()
        if (status !== 'granted') return
        const tokenData = await Notifications.getExpoPushTokenAsync()
        if (tokenData.data) {
          await notificationsApi.registerToken(tokenData.data, currentStore.id)
        }
      } catch {
        // Push notifications are optional — fail silently
      }
    }
    registerPush()
  }, [isAuthenticated, token, currentStore?.id])

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.background }}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    )
  }

  return <>{children}</>
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" options={{ headerShown: false }} />
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="orders/[id]"
            options={{
              headerShown: true,
              title: 'تفاصيل الطلب',
              headerBackTitle: 'رجوع',
              headerTintColor: COLORS.primary,
            }}
          />
          <Stack.Screen
            name="products/[id]"
            options={{
              headerShown: true,
              title: 'تفاصيل المنتج',
              headerBackTitle: 'رجوع',
              headerTintColor: COLORS.primary,
            }}
          />
          <Stack.Screen
            name="products/new"
            options={{
              headerShown: true,
              title: 'إضافة منتج جديد',
              headerBackTitle: 'رجوع',
              headerTintColor: COLORS.primary,
            }}
          />
          <Stack.Screen
            name="products/[id]/edit"
            options={{
              headerShown: true,
              title: 'تعديل المنتج',
              headerBackTitle: 'رجوع',
              headerTintColor: COLORS.primary,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{
              headerShown: true,
              title: 'الإشعارات',
              headerBackTitle: 'رجوع',
              headerTintColor: COLORS.primary,
            }}
          />
        </Stack>
      </AuthGuard>
    </QueryClientProvider>
  )
}

