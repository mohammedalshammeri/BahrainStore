// ─── Product Detail Screen — view & edit product info ────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  Image, Alert, ActivityIndicator, Modal, TextInput,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { productsApi, inventoryApi } from '@/api'
import { COLORS } from '@/constants'
import type { Product } from '@/types'

function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) return <View style={[styles.badge, { backgroundColor: COLORS.danger + '20' }]}><Text style={[styles.badgeText, { color: COLORS.danger }]}>نفد المخزون</Text></View>
  if (stock <= 5)  return <View style={[styles.badge, { backgroundColor: COLORS.warning + '20' }]}><Text style={[styles.badgeText, { color: COLORS.warning }]}>مخزون منخفض</Text></View>
  return <View style={[styles.badge, { backgroundColor: COLORS.success + '20' }]}><Text style={[styles.badgeText, { color: COLORS.success }]}>متوفر</Text></View>
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()
  const [stockModal, setStockModal] = useState(false)
  const [stockAdjust, setStockAdjust] = useState('')
  const [adjustNote, setAdjustNote] = useState('')

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await productsApi.get(id)
      return res.data as Product
    },
    enabled: !!id,
  })

  const deleteMutation = useMutation({
    mutationFn: () => productsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] })
      router.back()
    },
    onError: () => Alert.alert('خطأ', 'فشل حذف المنتج'),
  })

  const stockMutation = useMutation({
    mutationFn: (data: { quantity: number; note: string }) =>
      inventoryApi.adjust(id, data.quantity, data.note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      setStockModal(false)
      setStockAdjust('')
      setAdjustNote('')
    },
    onError: () => Alert.alert('خطأ', 'فشل تعديل المخزون'),
  })

  const toggleActiveMutation = useMutation({
    mutationFn: () => productsApi.update(id, { isActive: !product?.isActive }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['product', id] }),
    onError: () => Alert.alert('خطأ', 'فشل تغيير حالة المنتج'),
  })

  const onDelete = () => {
    Alert.alert('حذف المنتج', `هل تريد حذف "${product?.name}"؟ لا يمكن التراجع.`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'حذف', style: 'destructive', onPress: () => deleteMutation.mutate() },
    ])
  }

  const onStockSave = () => {
    const qty = parseInt(stockAdjust)
    if (isNaN(qty) || qty === 0) {
      Alert.alert('خطأ', 'أدخل كمية صحيحة (موجبة للإضافة، سالبة للخصم)')
      return
    }
    stockMutation.mutate({ quantity: qty, note: adjustNote })
  }

  if (isLoading) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
  }
  if (!product) return null

  const hasImage = product.images && product.images.length > 0
  const imageUri = hasImage ? (typeof product.images![0] === 'string' ? product.images![0] : (product.images![0] as any)?.url) : null

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14 }}>
      {/* Product Image */}
      <View style={styles.imageBox}>
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.image} resizeMode="contain" />
        ) : (
          <Text style={styles.imagePlaceholder}>📦</Text>
        )}
        {!product.isActive && (
          <View style={styles.inactiveBanner}>
            <Text style={styles.inactiveBannerText}>مخفي</Text>
          </View>
        )}
      </View>

      {/* Basic Info */}
      <View style={styles.card}>
        <Text style={styles.productName}>{product.name}</Text>
        {product.nameAr && product.nameAr !== product.name && (
          <Text style={styles.productNameAr}>{product.nameAr}</Text>
        )}
        {product.sku && <Text style={styles.sku}>SKU: {product.sku}</Text>}
        {product.barcode && <Text style={styles.sku}>Barcode: {product.barcode}</Text>}

        <View style={styles.priceRow}>
          <Text style={styles.price}>{Number(product.price).toFixed(3)} BD</Text>
          {product.comparePrice && Number(product.comparePrice) > Number(product.price) && (
            <>
              <Text style={styles.comparePrice}>{Number(product.comparePrice).toFixed(3)} BD</Text>
              <View style={styles.discountBadge}>
                <Text style={styles.discountBadgeText}>
                  -{Math.round((1 - Number(product.price) / Number(product.comparePrice)) * 100)}%
                </Text>
              </View>
            </>
          )}
        </View>

        {product.costPrice && (
          <Text style={styles.costPrice}>التكلفة: {Number(product.costPrice).toFixed(3)} BD</Text>
        )}
      </View>

      {/* Stock */}
      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.cardTitle}>المخزون</Text>
          <TouchableOpacity style={styles.adjustBtn} onPress={() => setStockModal(true)}>
            <Text style={styles.adjustBtnText}>تعديل المخزون</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.stockRow}>
          <Text style={styles.stockNum}>{product.stock ?? 0}</Text>
          <Text style={styles.stockUnit}>وحدة</Text>
          <StockBadge stock={product.stock ?? 0} />
        </View>
      </View>

      {/* Category */}
      {product.category && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>التصنيف</Text>
          <Text style={styles.categoryName}>{product.category.name}</Text>
        </View>
      )}

      {/* Status & Actions */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>الحالة</Text>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>حالة المنتج:</Text>
          <TouchableOpacity
            style={[styles.toggleBtn, product.isActive ? styles.toggleActive : styles.toggleInactive]}
            onPress={() => toggleActiveMutation.mutate()}
            disabled={toggleActiveMutation.isPending}
          >
            <Text style={styles.toggleBtnText}>
              {toggleActiveMutation.isPending ? '...' : product.isActive ? '● ظاهر' : '○ مخفي'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => router.push(`/products/${id}/edit` as any)}
        >
          <Text style={styles.editBtnText}>✏️ تعديل المنتج</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={onDelete}
          disabled={deleteMutation.isPending}
        >
          <Text style={styles.deleteBtnText}>
            {deleteMutation.isPending ? '...' : '🗑️ حذف'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stock Adjust Modal */}
      <Modal visible={stockModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalBox}>
            <Text style={styles.modalTitle}>تعديل المخزون</Text>
            <Text style={styles.modalHint}>المخزون الحالي: {product.stock ?? 0} وحدة</Text>

            <Text style={styles.fieldLabel}>الكمية (+ إضافة / − خصم)</Text>
            <TextInput
              style={styles.fieldInput}
              value={stockAdjust}
              onChangeText={setStockAdjust}
              placeholder="مثال: 10 أو -5"
              placeholderTextColor={COLORS.gray400}
              keyboardType="numbers-and-punctuation"
              autoFocus
            />

            <Text style={styles.fieldLabel}>ملاحظة (اختياري)</Text>
            <TextInput
              style={styles.fieldInput}
              value={adjustNote}
              onChangeText={setAdjustNote}
              placeholder="سبب التعديل..."
              placeholderTextColor={COLORS.gray400}
            />

            {stockAdjust ? (
              <Text style={styles.previewText}>
                المخزون بعد التعديل: {(product.stock ?? 0) + (parseInt(stockAdjust) || 0)} وحدة
              </Text>
            ) : null}

            <View style={styles.modalBtns}>
              <TouchableOpacity style={styles.modalCancel} onPress={() => setStockModal(false)}>
                <Text style={styles.modalCancelText}>إلغاء</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalConfirm}
                onPress={onStockSave}
                disabled={stockMutation.isPending}
              >
                <Text style={styles.modalConfirmText}>
                  {stockMutation.isPending ? '...' : 'حفظ'}
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  imageBox: {
    backgroundColor: COLORS.card, borderRadius: 16, height: 220,
    alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  image: { width: '100%', height: '100%' },
  imagePlaceholder: { fontSize: 72 },
  inactiveBanner: {
    position: 'absolute', top: 12, right: 12,
    backgroundColor: COLORS.gray700, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4,
  },
  inactiveBannerText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  productName: { fontSize: 20, fontWeight: 'bold', color: COLORS.text, marginBottom: 2 },
  productNameAr: { fontSize: 16, color: COLORS.textSecondary, marginBottom: 6 },
  sku: { fontSize: 12, color: COLORS.gray400, marginBottom: 2 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  price: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary },
  comparePrice: { fontSize: 14, color: COLORS.gray400, textDecorationLine: 'line-through' },
  discountBadge: { backgroundColor: COLORS.danger + '20', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  discountBadgeText: { fontSize: 12, color: COLORS.danger, fontWeight: '600' },
  costPrice: { fontSize: 12, color: COLORS.textSecondary, marginTop: 6 },
  cardTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 10 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  adjustBtn: { backgroundColor: COLORS.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6 },
  adjustBtnText: { color: COLORS.primary, fontWeight: '600', fontSize: 13 },
  stockRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stockNum: { fontSize: 32, fontWeight: 'bold', color: COLORS.text },
  stockUnit: { fontSize: 14, color: COLORS.textSecondary },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  categoryName: { fontSize: 15, color: COLORS.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusLabel: { fontSize: 14, color: COLORS.textSecondary },
  toggleBtn: { borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  toggleActive: { backgroundColor: COLORS.success + '20' },
  toggleInactive: { backgroundColor: COLORS.gray200 },
  toggleBtnText: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  actionsRow: { flexDirection: 'row', gap: 10 },
  editBtn: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  editBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 15 },
  deleteBtn: { borderWidth: 1, borderColor: COLORS.danger, borderRadius: 12, padding: 14, paddingHorizontal: 20, alignItems: 'center' },
  deleteBtnText: { color: COLORS.danger, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'flex-end' },
  modalBox: { backgroundColor: COLORS.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  modalHint: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 16 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.text, marginBottom: 10,
  },
  previewText: { fontSize: 14, color: COLORS.primary, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  modalBtns: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalCancel: { flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalCancelText: { color: COLORS.textSecondary, fontWeight: '600' },
  modalConfirm: { flex: 1, backgroundColor: COLORS.primary, borderRadius: 12, padding: 14, alignItems: 'center' },
  modalConfirmText: { color: '#fff', fontWeight: 'bold' },
})
