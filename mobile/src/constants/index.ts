// ─── App Constants ────────────────────────────────────────────────────────────

import Constants from 'expo-constants'

export const API_URL: string =
  Constants.expoConfig?.extra?.apiUrl ?? 'https://api.bazar.bh/api/v1'

export const COLORS = {
  primary: '#FF6B00',
  primaryDark: '#E55A00',
  primaryLight: '#FFF0E6',
  secondary: '#1A1A2E',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#EF4444',
  info: '#3B82F6',
  white: '#FFFFFF',
  black: '#000000',
  gray50: '#F9FAFB',
  gray100: '#F3F4F6',
  gray200: '#E5E7EB',
  gray300: '#D1D5DB',
  gray400: '#9CA3AF',
  gray500: '#6B7280',
  gray600: '#4B5563',
  gray700: '#374151',
  gray800: '#1F2937',
  gray900: '#111827',
  background: '#F8F9FA',
  card: '#FFFFFF',
  border: '#E5E7EB',
  text: '#111827',
  textSecondary: '#6B7280',
  textLight: '#9CA3AF',
}

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
  },
}

export const ORDER_STATUS_LABELS: Record<string, { ar: string; en: string; color: string }> = {
  DRAFT:      { ar: 'مسودة',      en: 'Draft',      color: '#9CA3AF' },
  PENDING:    { ar: 'معلق',       en: 'Pending',     color: '#F59E0B' },
  CONFIRMED:  { ar: 'مؤكد',       en: 'Confirmed',   color: '#3B82F6' },
  PROCESSING: { ar: 'قيد التجهيز', en: 'Processing',  color: '#8B5CF6' },
  SHIPPED:    { ar: 'تم الشحن',   en: 'Shipped',     color: '#06B6D4' },
  DELIVERED:  { ar: 'تم التسليم', en: 'Delivered',   color: '#22C55E' },
  CANCELLED:  { ar: 'ملغي',       en: 'Cancelled',   color: '#EF4444' },
  REFUNDED:   { ar: 'مسترد',      en: 'Refunded',    color: '#F97316' },
}

export const PAYMENT_STATUS_LABELS: Record<string, { ar: string; color: string }> = {
  PENDING:            { ar: 'لم يُدفع',       color: '#F59E0B' },
  PAID:               { ar: 'مدفوع',          color: '#22C55E' },
  FAILED:             { ar: 'فشل الدفع',      color: '#EF4444' },
  REFUNDED:           { ar: 'مسترد',          color: '#F97316' },
  PARTIALLY_REFUNDED: { ar: 'مسترد جزئياً',   color: '#FB923C' },
}

export const STORAGE_KEYS = {
  authToken: 'bazar_auth_token',
  refreshToken: 'bazar_refresh_token',
  currentStoreId: 'bazar_current_store',
  user: 'bazar_user',
}

export const PAGINATION_LIMIT = 20
