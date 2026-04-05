// ─── Order Detail Screen ──────────────────────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Modal,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ordersApi } from '@/api'
import { COLORS, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/constants'
import type { Order, OrderStatus } from '@/types'

const STATUS_FLOW: OrderStatus[] = ['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>
}

export default function OrderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [trackingNumber, setTrackingNumber] = useState('')
  const [trackingCompany, setTrackingCompany] = useState('Aramex')
  const [trackingModal, setTrackingModal] = useState(false)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['order', id],
    queryFn: async () => {
      const res = await ordersApi.get(id)
      return res.data as Order
    },
    enabled: !!id,
  })

  const updateMutation = useMutation({
    mutationFn: (status: OrderStatus) => ordersApi.updateStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: () => Alert.alert('خطأ', 'فشل تحديث حالة الطلب'),
  })

  const trackingMutation = useMutation({
    mutationFn: (number: string) => ordersApi.addTracking(id, number, trackingCompany),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      setTrackingModal(false)
      setTrackingNumber('')
      setTrackingCompany('Aramex')
    },
    onError: () => Alert.alert('خطأ', 'فشل تحديث رقم التتبع'),
  })

  const onUpdateStatus = (status: OrderStatus) => {
    Alert.alert(
      'تحديث الطلب',
      `هل تريد تغيير الحالة إلى "${ORDER_STATUS_LABELS[status]?.ar}"؟`,
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'تأكيد', onPress: () => updateMutation.mutate(status) },
      ]
    )
  }

  if (isLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.primary} size="large" />
      </View>
    )
  }

  if (!data) return null

  const order = data
  const status = ORDER_STATUS_LABELS[order.status]
  const payment = PAYMENT_STATUS_LABELS[order.paymentStatus]
  const currentIdx = STATUS_FLOW.indexOf(order.status as OrderStatus)

  const nextStatus: OrderStatus | null =
    currentIdx >= 0 && currentIdx < STATUS_FLOW.length - 1
      ? STATUS_FLOW[currentIdx + 1]
      : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 16 }}>
      {/* Header */}
      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={styles.orderNum}>طلب #{order.orderNumber}</Text>
          <View style={[styles.badge, { backgroundColor: status?.color + '20' }]}>
            <Text style={[styles.badgeText, { color: status?.color }]}>{status?.ar}</Text>
          </View>
        </View>
        <Text style={styles.meta}>
          {new Date(order.createdAt).toLocaleDateString('ar-BH', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            hour: '2-digit', minute: '2-digit',
          })}
        </Text>
      </View>

      {/* Status Progress */}
      <View style={styles.card}>
        <SectionTitle title="مسار الطلب" />
        <View style={styles.progressRow}>
          {STATUS_FLOW.filter(s => s !== 'CANCELLED').map((s, i) => {
            const done = STATUS_FLOW.indexOf(order.status as OrderStatus) >= i
            const lbl = ORDER_STATUS_LABELS[s]
            return (
              <View key={s} style={styles.progressStep}>
                <View style={[styles.dot, done && { backgroundColor: COLORS.primary }]}>
                  <Text style={styles.dotText}>{done ? '✓' : ''}</Text>
                </View>
                <Text style={[styles.stepLabel, done && { color: COLORS.primary }]}>{lbl?.ar}</Text>
                {i < STATUS_FLOW.filter(s => s !== 'CANCELLED').length - 1 && (
                  <View style={[styles.line, done && { backgroundColor: COLORS.primary }]} />
                )}
              </View>
            )
          })}
        </View>
      </View>

      {/* Action Buttons */}
      {order.status !== 'DELIVERED' && order.status !== 'CANCELLED' && (
        <View style={styles.card}>
          <SectionTitle title="إجراءات" />
          <View style={styles.actionRow}>
            {nextStatus && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.primaryBtn]}
                onPress={() => onUpdateStatus(nextStatus)}
                disabled={updateMutation.isPending}
              >
                <Text style={styles.primaryBtnText}>
                  {updateMutation.isPending ? '...' : `→ ${ORDER_STATUS_LABELS[nextStatus]?.ar}`}
                </Text>
              </TouchableOpacity>
            )}
            {order.status === 'SHIPPED' && (
              <TouchableOpacity
                style={[styles.actionBtn, styles.outlineBtn]}
                onPress={() => setTrackingModal(true)}
              >
                <Text style={styles.outlineBtnText}>📦 رقم التتبع</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[styles.actionBtn, styles.dangerBtn]}
              onPress={() => onUpdateStatus('CANCELLED')}
            >
              <Text style={styles.dangerBtnText}>إلغاء الطلب</Text>
            </TouchableOpacity>
          </View>
          {order.trackingNumber ? (
            <Text style={styles.trackingInfo}>رقم التتبع: {order.trackingNumber}</Text>
          ) : null}
        </View>
      )}

      {/* Customer */}
      <View style={styles.card}>
        <SectionTitle title="العميل" />
        <InfoRow icon="👤" label="الاسم" value={order.customer?.name || '—'} />
        <InfoRow icon="📱" label="الهاتف" value={order.customer?.phone || '—'} />
        <InfoRow icon="📧" label="البريد" value={order.customer?.email || '—'} />
      </View>

      {/* Shipping */}
      {order.shippingAddress && (
        <View style={styles.card}>
          <SectionTitle title="عنوان الشحن" />
          <InfoRow icon="📍" label="الشارع" value={order.shippingAddress.street || ''} />
          <InfoRow icon="🏙️" label="المدينة" value={order.shippingAddress.city || ''} />
          <InfoRow icon="🌐" label="الدولة" value={order.shippingAddress.country || ''} />
        </View>
      )}

      {/* Items */}
      <View style={styles.card}>
        <SectionTitle title="المنتجات" />
        {order.items?.map((item) => (
          <View key={item.id} style={styles.itemRow}>
            <View style={styles.itemInfo}>
              <Text style={styles.itemName}>{item.productName}</Text>
              {item.variantOptions && (
                <Text style={styles.itemVariant}>{item.variantOptions}</Text>
              )}
            </View>
            <View style={styles.itemRight}>
              <Text style={styles.itemQty}>×{item.quantity}</Text>
              <Text style={styles.itemPrice}>{Number(item.price).toFixed(3)} BD</Text>
            </View>
          </View>
        ))}
      </View>

      {/* Totals */}
      <View style={styles.card}>
        <SectionTitle title="الإجمالي" />
        <TotalRow label="المجموع الفرعي" value={`${Number(order.subtotal || 0).toFixed(3)} BD`} />
        {Number(order.discount) > 0 && (
          <TotalRow label="الخصم" value={`- ${Number(order.discount).toFixed(3)} BD`} color={COLORS.success} />
        )}
        <TotalRow label="الشحن" value={`${Number(order.shippingCost || 0).toFixed(3)} BD`} />
        {Number(order.tax) > 0 && (
          <TotalRow label="الضريبة (VAT)" value={`${Number(order.tax).toFixed(3)} BD`} />
        )}
        <View style={styles.divider} />
        <TotalRow label="الإجمالي" value={`${Number(order.total).toFixed(3)} BD`} bold />
        <View style={[styles.payBadge, { backgroundColor: payment?.color + '20', alignSelf: 'flex-start', marginTop: 8 }]}>
          <Text style={[styles.payBadgeText, { color: payment?.color }]}>{payment?.ar}</Text>
        </View>
      </View>

      {/* Notes */}
      {order.notes && (
        <View style={styles.card}>
          <SectionTitle title="ملاحظات" />
          <Text style={styles.notes}>{order.notes}</Text>
        </View>
      )}

      {/* Tracking Modal */}
      <Modal visible={trackingModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>إضافة رقم التتبع</Text>
            {/* Shipping company picker */}
            <Text style={[styles.modalTitle, { fontSize: 13, color: COLORS.textSecondary, marginBottom: 6 }]}>شركة الشحن</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              {['Aramex', 'DHL', 'FedEx', 'Bosta', 'Fastlo', 'أخرى'].map(c => (
                <TouchableOpacity
                  key={c}
                  style={{
                    paddingHorizontal: 14, paddingVertical: 6, borderRadius: 20,
                    backgroundColor: trackingCompany === c ? COLORS.primary : COLORS.background,
                    borderWidth: 1,
                    borderColor: trackingCompany === c ? COLORS.primary : COLORS.border,
                  }}
                  onPress={() => setTrackingCompany(c)}
                >
                  <Text style={{ fontSize: 13, color: trackingCompany === c ? '#fff' : COLORS.text }}>{c}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.modalInput}
              value={trackingNumber}
              onChangeText={setTrackingNumber}
              placeholder="أدخل رقم التتبع..."
              placeholderTextColor={COLORS.gray400}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setTrackingModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={() => trackingMutation.mutate(trackingNumber)}
                disabled={!trackingNumber.trim() || trackingMutation.isPending}
              >
                <Text style={styles.modalConfirmText}>
                  {trackingMutation.isPending ? '...' : 'حفظ'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

function InfoRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoIcon}>{icon}</Text>
      <Text style={styles.infoLabel}>{label}:</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  )
}

function TotalRow({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={styles.totalRow}>
      <Text style={[styles.totalLabel, bold && { fontWeight: 'bold', fontSize: 16 }]}>{label}</Text>
      <Text style={[styles.totalValue, bold && { fontWeight: 'bold', fontSize: 16 }, color ? { color } : {}]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderNum: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  meta: { fontSize: 12, color: COLORS.textSecondary, marginTop: 4 },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 12 },
  progressRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  progressStep: { alignItems: 'center', flex: 1, position: 'relative' },
  dot: {
    width: 28, height: 28, borderRadius: 14,
    backgroundColor: COLORS.border, alignItems: 'center', justifyContent: 'center',
  },
  dotText: { color: '#fff', fontSize: 14 },
  stepLabel: { fontSize: 10, color: COLORS.textSecondary, marginTop: 4, textAlign: 'center' },
  line: {
    position: 'absolute', top: 14,
    height: 2, width: '100%', backgroundColor: COLORS.border,
    zIndex: -1,
  },
  actionRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  actionBtn: { borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  primaryBtn: { backgroundColor: COLORS.primary },
  primaryBtnText: { color: '#fff', fontWeight: '600' },
  outlineBtn: { borderWidth: 1, borderColor: COLORS.primary },
  outlineBtnText: { color: COLORS.primary, fontWeight: '600' },
  dangerBtn: { borderWidth: 1, borderColor: COLORS.danger },
  dangerBtnText: { color: COLORS.danger },
  trackingInfo: { marginTop: 8, color: COLORS.textSecondary, fontSize: 13 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  infoIcon: { fontSize: 16 },
  infoLabel: { fontSize: 13, color: COLORS.textSecondary, width: 60 },
  infoValue: { fontSize: 13, color: COLORS.text, flex: 1 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: COLORS.border },
  itemInfo: { flex: 1 },
  itemName: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  itemVariant: { fontSize: 12, color: COLORS.textSecondary },
  itemRight: { alignItems: 'flex-end' },
  itemQty: { fontSize: 12, color: COLORS.textSecondary },
  itemPrice: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 8 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  totalLabel: { fontSize: 14, color: COLORS.textSecondary },
  totalValue: { fontSize: 14, color: COLORS.text },
  payBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  payBadgeText: { fontSize: 11, fontWeight: '600' },
  notes: { fontSize: 14, color: COLORS.textSecondary, lineHeight: 20 },
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 16 },
  modalInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 14, fontSize: 14, color: COLORS.text, marginBottom: 16,
  },
  modalBtns: { flexDirection: 'row', gap: 12 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
})
