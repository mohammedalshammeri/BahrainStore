// Edit Product — reuses NewProductScreen with prefilled data
import React, { useState, useEffect } from 'react'
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  TextInput, Alert, ActivityIndicator, Switch, KeyboardAvoidingView, Platform,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { productsApi } from '@/api'
import { COLORS } from '@/constants'
import type { Product } from '@/types'

function Field({ label, value, onChange, placeholder, keyboardType = 'default', multiline = false }: {
  label: string; value: string; onChange: (v: string) => void;
  placeholder?: string; keyboardType?: any; multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={[styles.fieldInput, multiline && styles.fieldInputMulti]}
        value={value} onChangeText={onChange}
        placeholder={placeholder || label} placeholderTextColor={COLORS.gray400}
        keyboardType={keyboardType} multiline={multiline}
        numberOfLines={multiline ? 4 : 1} textAlignVertical={multiline ? 'top' : 'center'}
      />
    </View>
  )
}

export default function EditProductScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [name, setName]             = useState('')
  const [nameAr, setNameAr]         = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice]           = useState('')
  const [comparePrice, setComparePrice] = useState('')
  const [costPrice, setCostPrice]   = useState('')
  const [sku, setSku]               = useState('')
  const [barcode, setBarcode]       = useState('')
  const [stock, setStock]           = useState('0')
  const [isActive, setIsActive]     = useState(true)
  const [isFeatured, setIsFeatured] = useState(false)
  const [loaded, setLoaded]         = useState(false)

  const { data: productData, isLoading } = useQuery({
    queryKey: ['product', id],
    queryFn: async () => {
      const res = await productsApi.get(id)
      return res.data as Product
    },
    enabled: !!id && !loaded,
  })

  useEffect(() => {
    if (productData && !loaded) {
      const p = productData
      setName(p.name || ''); setNameAr(p.nameAr || '')
      setDescription((p as any).description || '')
      setPrice(String(p.price || '')); setComparePrice(String(p.comparePrice || ''))
      setCostPrice(String(p.costPrice || '')); setSku(p.sku || '')
      setBarcode(p.barcode || ''); setStock(String(p.stock ?? 0))
      setIsActive(p.isActive ?? true); setIsFeatured(p.isFeatured ?? false)
      setLoaded(true)
    }
  }, [productData])

  const updateMutation = useMutation({
    mutationFn: (data: any) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['product', id] })
      queryClient.invalidateQueries({ queryKey: ['products'] })
      Alert.alert('✓', 'تم حفظ التعديلات', [{ text: 'رجوع', onPress: () => router.back() }])
    },
    onError: (err: any) => Alert.alert('خطأ', err?.response?.data?.message || 'فشل التحديث'),
  })

  const onSave = () => {
    if (!name.trim()) { Alert.alert('مطلوب', 'أدخل اسم المنتج'); return }
    if (!price.trim() || isNaN(parseFloat(price))) { Alert.alert('مطلوب', 'أدخل سعراً صحيحاً'); return }
    const payload: Record<string, any> = {
      name: name.trim(), nameAr: nameAr.trim() || name.trim(),
      description: description.trim(), price: parseFloat(price),
      isActive, isFeatured, stock: parseInt(stock) || 0,
    }
    if (comparePrice) payload.comparePrice = parseFloat(comparePrice)
    if (costPrice)    payload.costPrice    = parseFloat(costPrice)
    if (sku)          payload.sku          = sku.trim()
    if (barcode)      payload.barcode      = barcode.trim()
    updateMutation.mutate(payload)
  }

  if (isLoading && !loaded) {
    return <View style={styles.center}><ActivityIndicator color={COLORS.primary} size="large" /></View>
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={{ padding: 16, gap: 14, paddingBottom: 40 }}>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📝 المعلومات الأساسية</Text>
          <Field label="الاسم (English)" value={name} onChange={setName} />
          <Field label="الاسم (عربي)" value={nameAr} onChange={setNameAr} />
          <Field label="الوصف" value={description} onChange={setDescription} multiline />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>💰 التسعير</Text>
          <Field label="السعر (BD)" value={price} onChange={setPrice} keyboardType="decimal-pad" />
          <Field label="السعر قبل الخصم (BD)" value={comparePrice} onChange={setComparePrice} keyboardType="decimal-pad" />
          <Field label="سعر التكلفة (BD)" value={costPrice} onChange={setCostPrice} keyboardType="decimal-pad" />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>📦 المخزون</Text>
          <Field label="الكمية" value={stock} onChange={setStock} keyboardType="number-pad" />
          <Field label="SKU" value={sku} onChange={setSku} />
          <Field label="Barcode" value={barcode} onChange={setBarcode} keyboardType="number-pad" />
        </View>
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>⚙️ الإعدادات</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>ظاهر في المتجر</Text>
            <Switch value={isActive} onValueChange={setIsActive}
              trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
          </View>
          <View style={[styles.toggleRow, { marginTop: 10 }]}>
            <Text style={styles.toggleLabel}>منتج مميز</Text>
            <Switch value={isFeatured} onValueChange={setIsFeatured}
              trackColor={{ false: COLORS.border, true: COLORS.primary }} thumbColor="#fff" />
          </View>
        </View>
        <TouchableOpacity
          style={[styles.saveBtn, updateMutation.isPending && styles.saveBtnDisabled]}
          onPress={onSave} disabled={updateMutation.isPending}
        >
          {updateMutation.isPending
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.saveBtnText}>💾 حفظ التعديلات</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: { backgroundColor: COLORS.card, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2 },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: COLORS.text, marginBottom: 14 },
  field: { marginBottom: 12 },
  fieldLabel: { fontSize: 13, color: COLORS.textSecondary, marginBottom: 4 },
  fieldInput: { borderWidth: 1, borderColor: COLORS.border, borderRadius: 12, padding: 12, fontSize: 14, color: COLORS.text, backgroundColor: COLORS.background },
  fieldInputMulti: { height: 100 },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  toggleLabel: { fontSize: 14, color: COLORS.text, fontWeight: '500' },
  saveBtn: { backgroundColor: COLORS.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 4 },
  saveBtnDisabled: { backgroundColor: COLORS.gray400 },
  saveBtnText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
})
