// ─── New Product Screen — إضافة منتج جديد ────────────────────────────────────

import React, { useState } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { productsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'

function Field({
  label, value, onChange, placeholder, keyboardType = 'default', multiline = false, required = false,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: any; multiline?: boolean; required?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}{required && <Text style={{ color: COLORS.danger }}> *</Text>}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder || label}
        placeholderTextColor={COLORS.gray400}
        keyboardType={keyboardType}
        multiline={multiline}
        numberOfLines={multiline ? 4 : 1}
        textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  )
}

export default function NewProductScreen() {
  const router = useRouter()
  const { currentStore } = useAuthStore()
  const queryClient = useQueryClient()
  const storeId = currentStore?.id || ''

  const [name, setName]               = useState('')
  const [nameAr, setNameAr]           = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice]             = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [costPrice, setCostPrice]     = useState('')
  const [sku, setSku]                 = useState('')
  const [barcode, setBarcode]         = useState('')
  const [stock, setStock]             = useState('0')
  const [weight, setWeight]           = useState('')
  const [isActive, setIsActive]       = useState(true)
  const [isFeatured, setIsFeatured]   = useState(false)
  const [trackInventory, setTrackInventory] = useState(true)

  const createMutation = useMutation({
    mutationFn: (data: any) => productsApi.create(data),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['products', storeId] })
      Alert.alert('✓ تم الحفظ', 'تم إضافة المنتج بنجاح', [
        { text: 'عرض المنتج', onPress: () => router.replace(`/products/${res.data?.product?.id || res.data?.id}` as any) },
        { text: 'إضافة منتج آخر', onPress: () => resetForm() },
      ])
    },
    onError: (err: any) => Alert.alert('خطأ', err?.response?.data?.message || 'فشل إضافة المنتج'),
  })

  const resetForm = () => {
    setName(''); setNameAr(''); setDescription(''); setPrice('')
    setComparePrice(''); setCostPrice(''); setSku(''); setBarcode('')
    setStock('0'); setWeight(''); setIsActive(true); setIsFeatured(false)
  }

  const onSubmit = () => {
    if (!name.trim()) { Alert.alert('مطلوب', 'أدخل اسم المنتج'); return }
    if (!price.trim() || isNaN(parseFloat(price))) { Alert.alert('مطلوب', 'أدخل سعراً صحيحاً'); return }

    const payload: Record<string, any> = {
      storeId,
      name: name.trim(),
      nameAr: nameAr.trim() || name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      isActive,
      isFeatured,
      trackInventory,
    }
    if (comparePrice) payload.comparePrice = parseFloat(comparePrice)
    if (costPrice)    payload.costPrice    = parseFloat(costPrice)
    if (sku)          payload.sku          = sku.trim()
    if (barcode)      payload.barcode      = barcode.trim()
    if (weight)       payload.weight       = parseFloat(weight)
    if (trackInventory) payload.stock      = parseInt(stock) || 0

    createMutation.mutate(payload)
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>

        {/* الأساسي */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 المعلومات الأساسية</Text>
          <Field label="اسم المنتج (English)" value={name} onChange={setName} required />
          <Field label="اسم المنتج (عربي)" value={nameAr} onChange={setNameAr} />
          <Field label="الوصف" value={description} onChange={setDescription} multiline placeholder="وصف المنتج..." />
        </View>

        {/* التسعير */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💰 التسعير</Text>
          <Field label="السعر (BD)" value={price} onChange={setPrice} keyboardType="decimal-pad" required placeholder="0.000" />
          <Field label="السعر قبل الخصم (BD)" value={comparePrice} onChange={setComparePrice} keyboardType="decimal-pad" placeholder="0.000" />
          <Field label="سعر التكلفة (BD)" value={costPrice} onChange={setCostPrice} keyboardType="decimal-pad" placeholder="0.000" />
        </View>

        {/* المخزون */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📦 المخزون والتعريف</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>تتبع المخزون</Text>
            <Switch
              value={trackInventory}
              onValueChange={setTrackInventory}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
          {trackInventory && (
            <Field label="الكمية الأولية" value={stock} onChange={setStock} keyboardType="number-pad" placeholder="0" />
          )}
          <Field label="SKU" value={sku} onChange={setSku} placeholder="رمز المنتج (اختياري)" />
          <Field label="Barcode" value={barcode} onChange={setBarcode} keyboardType="number-pad" placeholder="رمز الباركود (اختياري)" />
          <Field label="الوزن (kg)" value={weight} onChange={setWeight} keyboardType="decimal-pad" placeholder="0.000" />
        </View>

        {/* الإعدادات */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⚙️ الإعدادات</Text>
          <View style={styles.toggleRow}>
            <View>
              <Text style={styles.toggleLabel}>ظاهر في المتجر</Text>
              <Text style={styles.toggleHint}>السماح للعملاء بمشاهدة المنتج</Text>
            </View>
            <Switch
              value={isActive}
              onValueChange={setIsActive}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.toggleRow, { marginTop: 10 }]}>
            <View>
              <Text style={styles.toggleLabel}>منتج مميز</Text>
              <Text style={styles.toggleHint}>إظهاره في قسم المنتجات المميزة</Text>
            </View>
            <Switch
              value={isFeatured}
              onValueChange={setIsFeatured}
              trackColor={{ false: COLORS.border, true: COLORS.primary }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Save Button */}
        <TouchableOpacity
          style={[styles.saveBtn, createMutation.isPending && styles.saveBtnDisabled]}
          onPress={onSubmit}
          disabled={createMutation.isPending}
        >
          {createMutation.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.saveBtnText}>💾 حفظ المنتج</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 16,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 14 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  fieldInput: {
    borderWidth: 1, borderColor: COLORS.border, borderRadius: 12,
    padding: 12, fontSize: 14, color: COLORS.text,
    backgroundColor: COLORS.background,
  },
  fieldInputMulti: { height: 100 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  toggleHint: { fontSize: 12, color: COLORS.textSecondary, marginTop: 2 },
  saveBtn: {
    backgroundColor: COLORS.primary, borderRadius: 14,
    paddingVertical: 16, alignItems: 'center', marginTop: 4,
  },
  saveBtnDisabled: { backgroundColor: COLORS.gray400 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
