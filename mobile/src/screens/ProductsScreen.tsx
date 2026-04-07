// ─── Products Screen ──────────────────────────────────────────────────────────

import React, { useState, useCallback } from 'react'
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  TextInput, RefreshControl, ActivityIndicator, Image,
} from 'react-native'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'expo-router'
import { productsApi } from '@/api'
import { useAuthStore } from '@/store/auth.store'
import { COLORS } from '@/constants'
import type { Product } from '@/types'

const STOCK_FILTERS = [
  { key: 'ALL', label: 'الكل' },
  { key: 'IN_STOCK', label: 'متوفر' },
  { key: 'LOW_STOCK', label: 'ينفد' },
  { key: 'OUT_OF_STOCK', label: 'نفد' },
]

function StockBadge({ stock, lowStockThreshold = 5 }: { stock: number; lowStockThreshold?: number }) {
  if (stock === 0) return <View style={[styles.stockBadge, styles.stockOut]}><Text style={styles.stockBadgeText}>نفد</Text></View>
  if (stock <= lowStockThreshold) return <View style={[styles.stockBadge, styles.stockLow]}><Text style={styles.stockBadgeText}>ينفد</Text></View>
  return <View style={[styles.stockBadge, styles.stockIn]}><Text style={styles.stockBadgeText}>متوفر</Text></View>
}

function ProductCard({ product, onPress }: { product: Product; onPress: () => void }) {
  const hasImage = product.images && product.images.length > 0
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.8}>
      <View style={styles.cardInner}>
        {/* Image placeholder */}
        <View style={styles.imagePlaceholder}>
          {hasImage ? (
            <Image source={{ uri: product.images![0] }} style={styles.image} resizeMode="cover" />
          ) : (
            <Text style={styles.imageEmoji}>📦</Text>
          )}
        </View>
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={2}>{product.name}</Text>
          {product.sku && <Text style={styles.sku}>SKU: {product.sku}</Text>}
          <View style={styles.priceRow}>
            <Text style={styles.price}>{Number(product.price).toFixed(3)} BD</Text>
            {product.comparePrice && Number(product.comparePrice) > Number(product.price) && (
              <Text style={styles.comparePrice}>{Number(product.comparePrice).toFixed(3)} BD</Text>
            )}
          </View>
        </View>
        <View style={styles.rightSide}>
          <StockBadge stock={product.stock ?? 0} />
          <Text style={styles.stockCount}>{product.stock ?? 0}</Text>
          <Text style={styles.stockUnit}>وحدة</Text>
        </View>
      </View>
    </TouchableOpacity>
  )
}

export default function ProductsScreen() {
  const router = useRouter()
  const { currentStore } = useAuthStore()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [stockFilter, setStockFilter] = useState('ALL')
  const [refreshing, setRefreshing] = useState(false)
  const storeId = currentStore?.id || ''

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['products', storeId, search, stockFilter],
    queryFn: async () => {
      const params: Record<string, any> = {}
      if (search.trim()) params.search = search.trim()
      const res = await productsApi.list(storeId, params)
      return res.data
    },
    enabled: !!storeId,
  })

  const products: Product[] = (data?.products || []).filter((product: Product) => {
    if (stockFilter === 'IN_STOCK') return product.stock > 5
    if (stockFilter === 'LOW_STOCK') return product.stock > 0 && product.stock <= 5
    if (stockFilter === 'OUT_OF_STOCK') return product.stock === 0
    return true
  })

  const onRefresh = useCallback(async () => {
    setRefreshing(true)
    await refetch()
    setRefreshing(false)
  }, [refetch])

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          value={search}
          onChangeText={setSearch}
          placeholder="ابحث باسم المنتج أو SKU..."
          placeholderTextColor={COLORS.gray400}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Stock Filter */}
      <FlatList
        horizontal
        data={STOCK_FILTERS}
        keyExtractor={(i) => i.key}
        showsHorizontalScrollIndicator={false}
        style={styles.filterBar}
        contentContainerStyle={{ paddingHorizontal: 12, gap: 8 }}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.filterBtn, stockFilter === item.key && styles.filterBtnActive]}
            onPress={() => setStockFilter(item.key)}
          >
            <Text style={[styles.filterText, stockFilter === item.key && styles.filterTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Products List */}
      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={COLORS.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={products}
          keyExtractor={(p) => p.id}
          renderItem={({ item }) => (
            <ProductCard
              product={item}
              onPress={() => router.push(`/products/${item.id}` as any)}
            />
          )}
          contentContainerStyle={{ padding: 12, gap: 10 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} />}
          ListHeaderComponent={
            <View style={styles.listHeader}>
              <Text style={styles.listCount}>{products.length} منتج</Text>
              <TouchableOpacity
                style={styles.addBtn}
                onPress={() => router.push('/products/new' as any)}
              >
                <Text style={styles.addBtnText}>+ إضافة منتج</Text>
              </TouchableOpacity>
            </View>
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyIcon}>🛍️</Text>
              <Text style={styles.emptyText}>لا توجد منتجات</Text>
              <TouchableOpacity
                style={[styles.addBtn, { marginTop: 16 }]}
                onPress={() => router.push('/products/new' as any)}
              >
                <Text style={styles.addBtnText}>+ إضافة أول منتج</Text>
              </TouchableOpacity>
            </View>
          }
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  searchBar: {
    flexDirection: 'row', alignItems: 'center',
    margin: 12, backgroundColor: COLORS.card,
    borderRadius: 12, borderWidth: 1, borderColor: COLORS.border,
    paddingHorizontal: 14,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 14, color: COLORS.text },
  clearBtn: { padding: 8 },
  filterBar: { maxHeight: 48 },
  filterBtn: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: COLORS.card, borderWidth: 1, borderColor: COLORS.border,
  },
  filterBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  filterText: { fontSize: 13, color: COLORS.textSecondary },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  listHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  listCount: { fontSize: 14, color: COLORS.textSecondary },
  addBtn: { backgroundColor: COLORS.primary, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  addBtnText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  card: {
    backgroundColor: COLORS.card, borderRadius: 14, padding: 12,
    shadowColor: '#000', shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardInner: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  imagePlaceholder: {
    width: 64, height: 64, borderRadius: 12,
    backgroundColor: COLORS.background, alignItems: 'center', justifyContent: 'center',
    overflow: 'hidden',
  },
  image: { width: 64, height: 64 },
  imageEmoji: { fontSize: 28 },
  productInfo: { flex: 1 },
  productName: { fontSize: 14, fontWeight: '600', color: COLORS.text, marginBottom: 4 },
  sku: { fontSize: 11, color: COLORS.gray400, marginBottom: 4 },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  price: { fontSize: 15, fontWeight: 'bold', color: COLORS.primary },
  comparePrice: { fontSize: 12, color: COLORS.gray400, textDecorationLine: 'line-through' },
  rightSide: { alignItems: 'center', minWidth: 52 },
  stockBadge: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, marginBottom: 4 },
  stockBadgeText: { fontSize: 10, fontWeight: '600', color: '#fff' },
  stockIn: { backgroundColor: COLORS.success },
  stockLow: { backgroundColor: COLORS.warning },
  stockOut: { backgroundColor: COLORS.danger },
  stockCount: { fontSize: 18, fontWeight: 'bold', color: COLORS.text },
  stockUnit: { fontSize: 10, color: COLORS.textSecondary },
  empty: { alignItems: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { fontSize: 16, color: COLORS.textSecondary },
})
