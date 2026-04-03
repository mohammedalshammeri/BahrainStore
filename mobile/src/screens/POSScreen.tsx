// ─── POS Screen — Point of Sale with barcode scanner ─────────────────────────

import React, { useState, useRef, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput,
  Alert, Modal, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useMutation, useQuery } from '@tanstack/react-query'
import { posApi, productsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { usePOSStore } from '@/store/pos.store'
import { COLORS } from '@/constants'
import type { Product, POSCartItem } from '@/types'

type PaymentMethod = 'CASH' | 'CARD' | 'BENEFIT_PAY'

function CartItem({ item, onInc, onDec, onRemove }: {
  item: POSCartItem
  onInc: () => void
  onDec: () => void
  onRemove: () => void
}) {
  return (
    <View style={styles.cartItem}>
      <View style={styles.cartItemInfo}>
        <Text style={styles.cartItemName} numberOfLines={2}>{item.productName}</Text>
        <Text style={styles.cartItemPrice}>{Number(item.unitPrice).toFixed(3)} BD</Text>
      </View>
      <View style={styles.qtyCtrl}>
        <TouchableOpacity onPress={onDec} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>−</Text></TouchableOpacity>
        <Text style={styles.qtyNum}>{item.quantity}</Text>
        <TouchableOpacity onPress={onInc} style={styles.qtyBtn}><Text style={styles.qtyBtnText}>+</Text></TouchableOpacity>
      </View>
      <View style={styles.cartItemTotal}>
        <Text style={styles.cartItemTotalText}>{(Number(item.unitPrice) * item.quantity).toFixed(3)}</Text>
        <TouchableOpacity onPress={onRemove} style={styles.removeBtn}><Text style={styles.removeBtnText}>✕</Text></TouchableOpacity>
      </View>
    </View>
  )
}

export default function POSScreen() {
  const { currentStore } = useAuthStore()
  const {
    session, addItem, removeItem, updateQuantity,
    setDiscount, setPaymentMethod, setCashReceived, clearSession, initSession,
  } = usePOSStore()

  const storeId = currentStore?.id || ''
  const [mode, setMode] = useState<'cart' | 'scanner' | 'search'>('cart')
  const [searchText, setSearchText] = useState('')
  const [scanned, setScanned] = useState(false)
  const [cashInput, setCashInput] = useState('')
  const [discountInput, setDiscountInput] = useState('')
  const [receiptModal, setReceiptModal] = useState(false)
  const [lastReceipt, setLastReceipt] = useState<any>(null)
  const [permission, requestPermission] = useCameraPermissions()

  // Init session when storeId is available
  React.useEffect(() => {
    if (storeId && !session) initSession(storeId)
  }, [storeId])

  // Product search query
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['pos-search', storeId, searchText],
    queryFn: async () => {
      if (!searchText.trim()) return []
      const res = await posApi.searchProducts(storeId, searchText.trim())
      return (res.data?.products || []) as Product[]
    },
    enabled: !!storeId && searchText.length > 1,
  })

  // Checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!session) throw new Error('No active session')
      return posApi.checkout({
        storeId,
        items: session.items.map(i => ({ productId: i.productId, quantity: i.quantity, price: i.unitPrice })),
        paymentMethod: session.paymentMethod || 'CASH',
        cashReceived: session.cashReceived,
        discountAmount: session.discountAmount,
        customerId: session.customerId,
      })
    },
    onSuccess: (res) => {
      setLastReceipt(res.data)
      setReceiptModal(true)
      clearSession()
      initSession(storeId)
      setCashInput('')
      setDiscountInput('')
    },
    onError: () => Alert.alert('خطأ', 'فشل إتمام عملية البيع'),
  })

  // Barcode scanned callback
  const onBarcodeScanned = useCallback(async ({ data }: { data: string }) => {
    if (scanned) return
    setScanned(true)
    try {
      const res = await posApi.getByBarcode(storeId, data)
      const product: Product = res.data?.product
      if (product) {
        addItem(product, 1)
        setMode('cart')
        Alert.alert('✓', `تمت إضافة: ${product.name}`)
      } else {
        Alert.alert('غير موجود', `لم يُعثر على منتج لهذا الباركود: ${data}`)
      }
    } catch {
      Alert.alert('خطأ', 'فشل البحث عن الباركود')
    } finally {
      setTimeout(() => setScanned(false), 2000)
    }
  }, [scanned, storeId, addItem])

  const onDiscountApply = () => {
    const pct = parseFloat(discountInput)
    if (isNaN(pct) || pct < 0 || pct > 100) {
      Alert.alert('خطأ', 'أدخل نسبة خصم صحيحة (0-100)')
      return
    }
    setDiscount(pct)
  }

  const onCheckout = () => {
    if (!session || session.items.length === 0) {
      Alert.alert('السلة فارغة', 'أضف منتجات للمتابعة')
      return
    }
    if (!session.paymentMethod) {
      Alert.alert('طريقة الدفع', 'اختر طريقة الدفع')
      return
    }
    if (session.paymentMethod === 'CASH') {
      const cash = parseFloat(cashInput)
      if (isNaN(cash) || cash < (session.total || 0)) {
        Alert.alert('المبلغ غير كافٍ', 'المبلغ المستلم أقل من الإجمالي')
        return
      }
      setCashReceived(cash)
    }
    Alert.alert('تأكيد البيع', `الإجمالي: ${session.total?.toFixed(3)} BD`, [
      { text: 'إلغاء', style: 'cancel' },
      { text: 'تأكيد', onPress: () => checkoutMutation.mutate() },
    ])
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Mode Tabs */}
      <View style={styles.modeTabs}>
        {(['cart', 'search', 'scanner'] as const).map((m) => {
          const labels = { cart: '🛒 السلة', search: '🔍 بحث', scanner: '📷 باركود' }
          return (
            <TouchableOpacity
              key={m}
              style={[styles.modeTab, mode === m && styles.modeTabActive]}
              onPress={() => setMode(m)}
            >
              <Text style={[styles.modeTabText, mode === m && styles.modeTabTextActive]}>
                {labels[m]}
              </Text>
            </TouchableOpacity>
          )
        })}
      </View>

      {/* Scanner Mode */}
      {mode === 'scanner' && (
        <View style={styles.scannerContainer}>
          {!permission?.granted ? (
            <View style={styles.permissionBox}>
              <Text style={styles.permText}>يلزم إذن الكاميرا</Text>
              <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
                <Text style={styles.permBtnText}>منح الإذن</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <CameraView
              style={styles.camera}
              facing="back"
              onBarcodeScanned={onBarcodeScanned}
            >
              <View style={styles.scanOverlay}>
                <View style={styles.scanFrame} />
                <Text style={styles.scanHint}>وجّه الكاميرا نحو الباركود</Text>
              </View>
            </CameraView>
          )}
        </View>
      )}

      {/* Search Mode */}
      {mode === 'search' && (
        <View style={styles.searchContainer}>
          <View style={styles.searchBar}>
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="ابحث عن منتج..."
              placeholderTextColor={COLORS.gray400}
              autoFocus
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => setSearchText('')} style={styles.clearBtn}>
                <Text>✕</Text>
              </TouchableOpacity>
            )}
          </View>
          {searchLoading && <ActivityIndicator color={COLORS.primary} style={{ marginTop: 20 }} />}
          <FlatList
            data={searchResults || []}
            keyExtractor={(p) => p.id}
            contentContainerStyle={{ padding: 12, gap: 8 }}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.searchResult}
                onPress={() => { addItem(item, 1); setMode('cart'); setSearchText('') }}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.srName}>{item.name}</Text>
                  {item.sku && <Text style={styles.srSku}>{item.sku}</Text>}
                </View>
                <View style={styles.srRight}>
                  <Text style={styles.srPrice}>{Number(item.price).toFixed(3)} BD</Text>
                  <Text style={styles.srStock}>مخزون: {item.stock ?? 0}</Text>
                </View>
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              searchText.length > 1 ? (
                <Text style={styles.noResults}>لا توجد نتائج</Text>
              ) : null
            }
          />
        </View>
      )}

      {/* Cart Mode */}
      {mode === 'cart' && (
        <View style={styles.cartContainer}>
          {/* Cart Items */}
          {session?.items.length === 0 ? (
            <View style={styles.emptyCart}>
              <Text style={styles.emptyCartIcon}>🛒</Text>
              <Text style={styles.emptyCartText}>السلة فارغة</Text>
              <Text style={styles.emptyCartHint}>ابحث عن منتج أو امسح باركود</Text>
            </View>
          ) : (
            <FlatList
              data={session?.items || []}
              keyExtractor={(i) => i.productId}
              style={{ flex: 1 }}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              renderItem={({ item }) => (
                <CartItem
                  item={item}
                  onInc={() => updateQuantity(item.productId, item.quantity + 1)}
                  onDec={() => {
                    if (item.quantity > 1) updateQuantity(item.productId, item.quantity - 1)
                    else removeItem(item.productId)
                  }}
                  onRemove={() => removeItem(item.productId)}
                />
              )}
            />
          )}

          {/* Checkout Panel */}
          <View style={styles.checkoutPanel}>
            {/* Discount */}
            <View style={styles.discountRow}>
              <TextInput
                style={styles.discountInput}
                value={discountInput}
                onChangeText={setDiscountInput}
                placeholder="خصم %"
                placeholderTextColor={COLORS.gray400}
                keyboardType="numeric"
              />
              <TouchableOpacity style={styles.discountApply} onPress={onDiscountApply}>
                <Text style={styles.discountApplyText}>تطبيق</Text>
              </TouchableOpacity>
            </View>

            {/* Totals */}
            <View style={styles.totalsBox}>
              <TotalLine label="المجموع الفرعي" value={`${session?.subtotal?.toFixed(3) || '0.000'} BD`} />
              {(session?.discountAmount || 0) > 0 && (
                <TotalLine label="الخصم" value={`- ${session?.discountAmount?.toFixed(3)} BD`} color={COLORS.success} />
              )}
              <TotalLine label="ضريبة القيمة المضافة (10%)" value={`${session?.vatAmount?.toFixed(3) || '0.000'} BD`} />
              <View style={styles.divider} />
              <TotalLine label="الإجمالي" value={`${session?.total?.toFixed(3) || '0.000'} BD`} bold />
            </View>

            {/* Payment Method */}
            <View style={styles.paymentRow}>
              {(['CASH', 'CARD', 'BENEFIT_PAY'] as PaymentMethod[]).map((pm) => {
                const labels = { CASH: '💵 نقد', CARD: '💳 بطاقة', BENEFIT_PAY: '📱 BenefitPay' }
                return (
                  <TouchableOpacity
                    key={pm}
                    style={[styles.payBtn, session?.paymentMethod === pm && styles.payBtnActive]}
                    onPress={() => setPaymentMethod(pm)}
                  >
                    <Text style={[styles.payBtnText, session?.paymentMethod === pm && styles.payBtnTextActive]}>
                      {labels[pm]}
                    </Text>
                  </TouchableOpacity>
                )
              })}
            </View>

            {/* Cash Received (only for CASH) */}
            {session?.paymentMethod === 'CASH' && (
              <View style={styles.cashRow}>
                <Text style={styles.cashLabel}>المبلغ المستلم:</Text>
                <TextInput
                  style={styles.cashInput}
                  value={cashInput}
                  onChangeText={(t) => { setCashInput(t); setCashReceived(parseFloat(t) || 0) }}
                  placeholder="0.000"
                  placeholderTextColor={COLORS.gray400}
                  keyboardType="decimal-pad"
                />
                {cashInput && (
                  <Text style={styles.changeText}>
                    باقي: {Math.max(0, (parseFloat(cashInput) || 0) - (session?.total || 0)).toFixed(3)} BD
                  </Text>
                )}
              </View>
            )}

            {/* Checkout Button */}
            <TouchableOpacity
              style={[styles.checkoutBtn, (session?.items.length === 0 || checkoutMutation.isPending) && styles.checkoutBtnDisabled]}
              onPress={onCheckout}
              disabled={session?.items.length === 0 || checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.checkoutBtnText}>إتمام البيع — {session?.total?.toFixed(3) || '0.000'} BD</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Receipt Modal */}
      <Modal visible={receiptModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.receiptBox}>
            <Text style={styles.receiptTitle}>✓ تمت عملية البيع</Text>
            {lastReceipt && (
              <>
                <Text style={styles.receiptNum}>طلب #{lastReceipt.orderNumber}</Text>
                <Text style={styles.receiptAmount}>{Number(lastReceipt.total).toFixed(3)} BD</Text>
              </>
            )}
            <TouchableOpacity style={styles.receiptClose} onPress={() => setReceiptModal(false)}>
              <Text style={styles.receiptCloseText}>إغلاق</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  )
}

function TotalLine({ label, value, bold, color }: { label: string; value: string; bold?: boolean; color?: string }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 }}>
      <Text style={[{ fontSize: 13, color: COLORS.textSecondary }, bold && { fontWeight: 'bold', color: COLORS.text, fontSize: 15 }]}>{label}</Text>
      <Text style={[{ fontSize: 13, color: COLORS.text }, bold && { fontWeight: 'bold', fontSize: 15 }, color ? { color } : {}]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  modeTabs: {
    flexDirection: 'row', backgroundColor: COLORS.card,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
  modeTab: { flex: 1, paddingVertical: 12, alignItems: 'center' },
  modeTabActive: { borderBottomWidth: 2, borderBottomColor: COLORS.primary },
  modeTabText: { fontSize: 13, color: COLORS.textSecondary },
  modeTabTextActive: { color: COLORS.primary, fontWeight: '600' },
  // Scanner
  scannerContainer: { flex: 1 },
  camera: { flex: 1 },
  scanOverlay: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scanFrame: {
    width: 240, height: 180, borderWidth: 3, borderColor: COLORS.primary,
    borderRadius: 16, backgroundColor: 'transparent',
  },
  scanHint: { color: '#fff', marginTop: 16, fontSize: 14, textShadowColor: '#000', textShadowRadius: 4 },
  permissionBox: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  permText: { fontSize: 16, color: COLORS.text, marginBottom: 12 },
  permBtn: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  permBtnText: { color: '#fff', fontWeight: 'bold' },
  // Search
  searchContainer: { flex: 1 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  clearBtn: { padding: 8 },
  searchResult: {
    flexDirection: 'row', backgroundColor: COLORS.card, borderRadius: 12,
    padding: 12, shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1,
  },
  srName: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  srSku: { fontSize: 11, color: COLORS.gray400 },
  srRight: { alignItems: 'flex-end' },
  srPrice: { fontSize: 14, fontWeight: 'bold', color: COLORS.primary },
  srStock: { fontSize: 11, color: COLORS.textSecondary },
  noResults: { textAlign: 'center', color: COLORS.textSecondary, marginTop: 24 },
  // Cart
  cartContainer: { flex: 1 },
  emptyCart: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyCartIcon: { fontSize: 56, marginBottom: 12 },
  emptyCartText: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, marginBottom: 4 },
  emptyCartHint: { fontSize: 14, color: COLORS.textSecondary },
  cartItem: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card,
    borderRadius: 12, padding: 10, gap: 8,
  },
  cartItemInfo: { flex: 1 },
  cartItemName: { fontSize: 13, fontWeight: '600', color: COLORS.text },
  cartItemPrice: { fontSize: 12, color: COLORS.textSecondary },
  qtyCtrl: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    width: 28, height: 28, borderRadius: 8, backgroundColor: COLORS.background,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.border,
  },
  qtyBtnText: { fontSize: 18, fontWeight: 'bold', color: COLORS.text, lineHeight: 22 },
  qtyNum: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, minWidth: 24, textAlign: 'center' },
  cartItemTotal: { alignItems: 'flex-end' },
  cartItemTotalText: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  removeBtn: { marginTop: 4 },
  removeBtnText: { fontSize: 12, color: COLORS.danger },
  // Checkout panel
  checkoutPanel: {
    backgroundColor: COLORS.card, borderTopWidth: 1, borderTopColor: COLORS.border, padding: 14, gap: 10,
  },
  discountRow: { flexDirection: 'row', gap: 8 },
  discountInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 10, fontSize: 14, color: COLORS.text, textAlign: 'center',
  },
  discountApply: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' },
  discountApplyText: { color: '#fff', fontWeight: '600' },
  totalsBox: { backgroundColor: COLORS.background, borderRadius: 12, padding: 12 },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 6 },
  paymentRow: { flexDirection: 'row', gap: 6 },
  payBtn: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    paddingVertical: 10, alignItems: 'center',
  },
  payBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  payBtnText: { fontSize: 12, color: COLORS.textSecondary },
  payBtnTextActive: { color: '#fff', fontWeight: '600' },
  cashRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cashLabel: { fontSize: 13, color: COLORS.textSecondary },
  cashInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: 10,
    padding: 10, fontSize: 14, color: COLORS.text,
  },
  changeText: { fontSize: 13, fontWeight: 'bold', color: COLORS.success },
  checkoutBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 4,
  },
  checkoutBtnDisabled: { backgroundColor: COLORS.gray400 },
  checkoutBtnText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  // Receipt Modal
  modalOverlay: { flex: 1, backgroundColor: '#00000080', justifyContent: 'center', alignItems: 'center' },
  receiptBox: {
    backgroundColor: COLORS.card, borderRadius: 20, padding: 32,
    alignItems: 'center', width: '80%',
  },
  receiptTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.success, marginBottom: 12 },
  receiptNum: { fontSize: 14, color: COLORS.textSecondary, marginBottom: 8 },
  receiptAmount: { fontSize: 28, fontWeight: 'bold', color: COLORS.text, marginBottom: 24 },
  receiptClose: { backgroundColor: COLORS.primary, borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12 },
  receiptCloseText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
