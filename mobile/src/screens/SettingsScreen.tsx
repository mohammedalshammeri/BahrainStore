// ─── Settings Screen ──────────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, Switch, ActivityIndicator, Modal,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { storeApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'
import type { Store } from '@/types'

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>
}

function SettingRow({
  icon, label, value, onPress,
  toggle, toggleValue, onToggle,
}: {
  icon: string; label: string; value?: string; onPress?: () => void;
  toggle?: boolean; toggleValue?: boolean; onToggle?: (v: boolean) => void;
}) {
  return (
    <TouchableOpacity style={styles.settingRow} onPress={onPress} activeOpacity={onPress ? 0.7 : 1}>
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingLabel}>
        <Text style={styles.settingLabelText}>{label}</Text>
        {value && <Text style={styles.settingValue}>{value}</Text>}
      </View>
      {toggle ? (
        <Switch
          value={toggleValue}
          onValueChange={onToggle}
          trackColor={{ false: COLORS.border, true: COLORS.primary }}
          thumbColor="#fff"
        />
      ) : onPress ? (
        <Text style={styles.chevron}>›</Text>
      ) : null}
    </TouchableOpacity>
  )
}

export default function SettingsScreen() {
  const { user, currentStore, logout, switchStore } = useAuthStore()
  const queryClient = useQueryClient()
  const storeId = currentStore?.id || ''
  const [editModal, setEditModal] = useState(false)
  const [storeName, setStoreName] = useState('')
  const [storePhone, setStorePhone] = useState('')
  const [notifications, setNotifications] = useState(true)

  const { data: storeData, isLoading } = useQuery({
    queryKey: ['store-settings', storeId],
    queryFn: async () => {
      const res = await storeApi.get(storeId)
      return res.data as Store
    },
    enabled: !!storeId,
  })

  // Sync local state when storeData loads
  React.useEffect(() => {
    if (storeData) {
      setStoreName(storeData.name || '')
      setStorePhone(storeData.phone || '')
    }
  }, [storeData])

  const updateMutation = useMutation({
    mutationFn: (updates: Partial<Store>) => storeApi.update(storeId, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['store-settings', storeId] })
      setEditModal(false)
      Alert.alert('✓', 'تم تحديث إعدادات المتجر')
    },
    onError: () => Alert.alert('خطأ', 'فشل تحديث إعدادات المتجر'),
  })

  const onLogout = () => {
    Alert.alert('تسجيل الخروج', 'هل تريد تسجيل الخروج؟', [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'خروج', style: 'destructive', onPress: logout },
    ])
  }

  const store = storeData

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ gap: 20, padding: 16 }}>
      {/* Profile Card */}
      <View style={styles.profileCard}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{(user?.name || 'U')[0].toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.profileName}>{user?.name || '—'}</Text>
          <Text style={styles.profileEmail}>{user?.email || '—'}</Text>
          <View style={[styles.roleBadge, { backgroundColor: COLORS.primaryLight }]}>
            <Text style={[styles.roleText, { color: COLORS.primary }]}>
              {user?.role === 'OWNER' ? 'مالك' : user?.role === 'MANAGER' ? 'مدير' : 'موظف'}
            </Text>
          </View>
        </View>
      </View>

      {/* Store Info */}
      {isLoading ? (
        <ActivityIndicator color={COLORS.primary} />
      ) : store ? (
        <View style={styles.card}>
          <SectionHeader title="إعدادات المتجر" />
          <SettingRow icon="🏪" label="اسم المتجر" value={store.name} onPress={() => setEditModal(true)} />
          <SettingRow icon="🌐" label="رابط المتجر" value={store.domain || store.subdomain} />
          <SettingRow icon="📱" label="هاتف المتجر" value={store.phone || '—'} onPress={() => setEditModal(true)} />
          <SettingRow icon="🌍" label="العملة" value={'BHD'} />
        </View>
      ) : null}

      {/* Notifications */}
      <View style={styles.card}>
        <SectionHeader title="الإشعارات" />
        <SettingRow
          icon="🔔"
          label="إشعارات الطلبات الجديدة"
          toggle toggleValue={notifications}
          onToggle={setNotifications}
        />
        <SettingRow
          icon="📦"
          label="تحذيرات المخزون المنخفض"
          toggle toggleValue={notifications}
          onToggle={setNotifications}
        />
      </View>

      {/* App Info */}
      <View style={styles.card}>
        <SectionHeader title="التطبيق" />
        <SettingRow icon="ℹ️" label="الإصدار" value="1.0.0" />
        <SettingRow icon="📄" label="شروط الاستخدام" onPress={() => {}} />
        <SettingRow icon="🔒" label="سياسة الخصوصية" onPress={() => {}} />
      </View>

      {/* Logout */}
      <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
        <Text style={styles.logoutText}>🚪 تسجيل الخروج</Text>
      </TouchableOpacity>

      {/* Edit Store Modal */}
      <Modal visible={editModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>تعديل إعدادات المتجر</Text>

            <Text style={styles.fieldLabel}>اسم المتجر</Text>
            <TextInput
              style={styles.fieldInput}
              value={storeName}
              onChangeText={setStoreName}
              placeholder="اسم المتجر"
              placeholderTextColor={COLORS.gray400}
            />

            <Text style={styles.fieldLabel}>رقم الهاتف</Text>
            <TextInput
              style={styles.fieldInput}
              value={storePhone}
              onChangeText={setStorePhone}
              placeholder="+973 XXXX XXXX"
              placeholderTextColor={COLORS.gray400}
              keyboardType="phone-pad"
            />

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setEditModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => updateMutation.mutate({ name: storeName, phone: storePhone })}
                disabled={updateMutation.isPending}
              >
                <Text style={styles.modalConfirmText}>
                  {updateMutation.isPending ? '...' : 'حفظ'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  profileCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: COLORS.card, borderRadius: 16, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  avatar: {
    width: 60, height: 60, borderRadius: 30,
    backgroundColor: COLORS.primary, alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 24, fontWeight: 'bold', color: '#fff' },
  profileName: { fontSize: 17, fontWeight: 'bold', color: COLORS.text },
  profileEmail: { fontSize: 13, color: COLORS.textSecondary, marginTop: 2 },
  roleBadge: { marginTop: 6, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  roleText: { fontSize: 11, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionHeader: { fontSize: 12, fontWeight: '600', color: COLORS.textSecondary, padding: 14, paddingBottom: 6, textTransform: 'uppercase' },
  settingRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 13, borderTopWidth: 1, borderTopColor: COLORS.border },
  settingIcon: { fontSize: 18, marginRight: 12 },
  settingLabel: { flex: 1 },
  settingLabelText: { fontSize: 14, color: COLORS.text },
  settingValue: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  chevron: { fontSize: 20, color: COLORS.gray400 },
  logoutBtn: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.danger,
  },
  logoutText: { fontSize: 16, fontWeight: '600', color: COLORS.danger },
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 12,
  },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
})
