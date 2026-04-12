// ─── Auth Store — Zustand with SecureStore persistence ───────────────────────

import { create } from 'zustand'
import * as SecureStore from 'expo-secure-store'
import { authApi } from '@/api'
import { STORAGE_KEYS } from '@/constants'
import type { AuthUser, Store } from '@/types'

interface AuthState {
  user: AuthUser | null
  token: string | null
  currentStore: Store | null
  isLoading: boolean
  isAuthenticated: boolean

  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loadFromStorage: () => Promise<void>
  switchStore: (storeId: string) => void
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  token: null,
  currentStore: null,
  isLoading: true,
  isAuthenticated: false,

  loadFromStorage: async () => {
    try {
      const [token, userStr, storeId] = await Promise.all([
        SecureStore.getItemAsync(STORAGE_KEYS.authToken),
        SecureStore.getItemAsync(STORAGE_KEYS.user),
        SecureStore.getItemAsync(STORAGE_KEYS.currentStoreId),
      ])

      if (token && userStr) {
        const user: AuthUser = JSON.parse(userStr)
        const currentStore = (user.stores ?? []).find(s => s.id === (storeId || (user.stores ?? [])[0]?.id))
          || (user.stores ?? [])[0] || null
        set({ user, token, currentStore, isAuthenticated: true, isLoading: false })
      } else {
        set({ isLoading: false })
      }
    } catch {
      set({ isLoading: false })
    }
  },

  login: async (email, password) => {
    const { data } = await authApi.login(email, password)
    const user: AuthUser = {
      id: data.user.id,
      name: data.user.name,
      email: data.user.email,
      token: data.token,
      stores: data.stores || [],
      currentStoreId: data.stores?.[0]?.id || '',
    }

    await Promise.all([
      SecureStore.setItemAsync(STORAGE_KEYS.authToken, data.token || data.accessToken || ''),
      SecureStore.setItemAsync(STORAGE_KEYS.refreshToken, data.refreshToken || ''),
      SecureStore.setItemAsync(STORAGE_KEYS.user, JSON.stringify(user)),
      SecureStore.setItemAsync(STORAGE_KEYS.currentStoreId, user.currentStoreId ?? ''),
    ])

    set({
      user,
      token: data.token,
      currentStore: data.stores?.[0] || null,
      isAuthenticated: true,
    })
  },

  logout: async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(STORAGE_KEYS.authToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.refreshToken),
      SecureStore.deleteItemAsync(STORAGE_KEYS.user),
      SecureStore.deleteItemAsync(STORAGE_KEYS.currentStoreId),
    ])
    set({ user: null, token: null, currentStore: null, isAuthenticated: false })
  },

  switchStore: (storeId) => {
    const { user } = get()
    if (!user) return
    const store = (user.stores ?? []).find(s => s.id === storeId)
    if (!store) return
    SecureStore.setItemAsync(STORAGE_KEYS.currentStoreId, storeId).catch(() => {})
    set({ currentStore: store })
  },
}))
