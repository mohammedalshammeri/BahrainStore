"use client";

import Image from "next/image";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { api } from "@/lib/api";
import type { Category, Product } from "@/lib/types";
import { formatBHD } from "@/lib/utils";
import { Search, SlidersHorizontal, ShoppingBag, ChevronDown, X, GitCompare } from "lucide-react";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { useCompareStore } from "@/lib/compare.store";
import { useState, useEffect, useRef } from "react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

async function fetchStoreId(subdomain: string) {
  const res = await api.get(`/stores/s/${subdomain}`);
  return res.data.store as { id: string };
}

async function fetchCategories(storeId: string) {
  const res = await api.get(`/categories/store/${storeId}`);
  return res.data.categories as Category[];
}

async function fetchProducts(storeId: string, params: Record<string, string>) {
  const q = new URLSearchParams({ ...params, limit: "20" }).toString();
  const res = await api.get(`/products/store/${storeId}?${q}`);
  return res.data as { products: Product[]; total: number; pages: number; page: number };
}

export default function ProductsPage({ params }: Props) {
  const [subdomain, setSubdomain] = useState<string>("");
  useEffect(() => {
    params.then(({ subdomain: s }) => setSubdomain(s));
  }, [params]);

  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");
  const inStock = searchParams.get("inStock") === "true";
  const categoryId = searchParams.get("categoryId") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Number(searchParams.get("page") ?? "1");

  // Debounce search input
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  function handleSearchChange(val: string) {
    setSearch(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      const p = new URLSearchParams(searchParams.toString());
      if (val) p.set("q", val); else p.delete("q");
      p.delete("page");
      router.push(`${pathname}?${p.toString()}`);
    }, 350);
  }

  const compareItems = useCompareStore((s) => s.items);
  const clearCompare = useCompareStore((s) => s.clear);

  const { data: storeData } = useQuery({
    queryKey: ["store", subdomain],
    queryFn: () => fetchStoreId(subdomain),
    enabled: !!subdomain,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories", storeData?.id],
    queryFn: () => fetchCategories(storeData!.id),
    enabled: !!storeData?.id,
  });

  const queryParams: Record<string, string> = { sort, page: String(page) };
  if (search) queryParams.q = search;
  if (categoryId) queryParams.categoryId = categoryId;
  if (minPrice) queryParams.minPrice = minPrice;
  if (maxPrice) queryParams.maxPrice = maxPrice;
  if (inStock) queryParams.inStock = "true";

  const { data, isLoading } = useQuery({
    queryKey: ["products", storeData?.id, queryParams],
    queryFn: () => fetchProducts(storeData!.id, queryParams),
    enabled: !!storeData?.id,
  });

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete("page");
    router.push(`${pathname}?${p.toString()}`);
  }

  const sortOptions = [
    { value: "newest", label: "الأحدث" },
    { value: "featured", label: "المميزة" },
    { value: "price_asc", label: "الأرخص أولاً" },
    { value: "price_desc", label: "الأغلى أولاً" },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        {/* Search */}
        <div className="flex flex-1 items-center bg-white border border-gray-200 rounded-full px-4 gap-2 shadow-sm">
          <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <input
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder="ابحث عن منتج..."
            className="flex-1 text-sm py-2.5 outline-none placeholder:text-gray-400"
          />
          {search && (
            <button onClick={() => handleSearchChange("")}>
              <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>

        {/* Sort */}
        <div className="relative">
          <select
            value={sort}
            onChange={(e) => setParam("sort", e.target.value)}
            className="appearance-none bg-white border border-gray-200 rounded-full px-4 pr-8 py-2.5 text-sm shadow-sm outline-none cursor-pointer"
          >
            {sortOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400" />
        </div>

        {/* Filter toggle mobile */}
        <button
          className="sm:hidden flex items-center gap-2 bg-white border border-gray-200 rounded-full px-4 py-2.5 text-sm shadow-sm"
          onClick={() => setFiltersOpen((v) => !v)}
        >
          <SlidersHorizontal className="w-4 h-4" />
          فلترة
        </button>
      </div>

      <div className="flex gap-6">
        {/* Sidebar filters */}
        <aside className={`${filtersOpen ? "block" : "hidden"} sm:block w-full sm:w-52 flex-shrink-0`}>
          {/* Category filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <h3 className="font-semibold text-gray-900 mb-3">التصنيف</h3>
            <ul className="space-y-1.5">
              <li>
                <button
                  onClick={() => setParam("categoryId", "")}
                  className={`w-full text-right text-sm px-2 py-1.5 rounded-lg transition ${!categoryId ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-700"}`}
                >
                  الكل
                </button>
              </li>
              {categories?.map((cat) => (
                <li key={cat.id}>
                  <button
                    onClick={() => setParam("categoryId", cat.id)}
                    className={`w-full text-right text-sm px-2 py-1.5 rounded-lg transition ${categoryId === cat.id ? "bg-primary text-white" : "hover:bg-gray-100 text-gray-700"}`}
                  >
                    {cat.nameAr || cat.name}
                    {cat._count && (
                      <span className="text-xs opacity-60 mr-1">({cat._count.products})</span>
                    )}
                  </button>
                  {/* Sub categories */}
                  {cat.children?.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => setParam("categoryId", child.id)}
                      className={`w-full text-right text-xs px-4 py-1 rounded-lg transition mt-0.5 ${categoryId === child.id ? "bg-gray-700 text-white" : "hover:bg-gray-50 text-gray-500"}`}
                    >
                      {child.nameAr || child.name}
                    </button>
                  ))}
                </li>
              ))}
            </ul>
          </div>

          {/* Price range filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <h3 className="font-semibold text-gray-900 mb-3">نطاق السعر</h3>
            <div className="flex gap-2 items-center">
              <input
                type="number"
                min="0"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                onBlur={() => setParam("minPrice", minPrice)}
                placeholder="من"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-gray-400 text-sm flex-shrink-0">—</span>
              <input
                type="number"
                min="0"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                onBlur={() => setParam("maxPrice", maxPrice)}
                placeholder="إلى"
                className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
            {(minPrice || maxPrice) && (
              <button
                onClick={() => { setMinPrice(""); setMaxPrice(""); const p = new URLSearchParams(searchParams.toString()); p.delete("minPrice"); p.delete("maxPrice"); p.delete("page"); router.push(`${pathname}?${p.toString()}`); }}
                className="mt-2 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1"
              >
                <X className="w-3 h-3" /> مسح الفلتر
              </button>
            )}
          </div>

          {/* In-stock filter */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={inStock}
                onChange={(e) => setParam("inStock", e.target.checked ? "true" : "")}
                className="w-4 h-4 accent-primary rounded"
              />
              <span className="text-sm font-medium text-gray-700">متوفر في المخزون فقط</span>
            </label>
          </div>
        </aside>

        {/* Products grid */}
        <div className="flex-1">
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="bg-gray-100 rounded-xl aspect-square animate-pulse" />
              ))}
            </div>
          ) : data?.products.length === 0 ? (
            <div className="text-center py-24 text-gray-400">
              <ShoppingBag className="w-16 h-16 mx-auto mb-3 opacity-30" />
              <p>لا توجد منتجات</p>
            </div>
          ) : (
            <>
              <p className="text-sm text-gray-500 mb-4">{data?.total} منتج</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {data?.products.map((product) => (
                  <ProductCard key={product.id} product={product} subdomain={subdomain} />
                ))}
              </div>

              {/* Pagination */}
              {data && data.pages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  {Array.from({ length: data.pages }, (_, i) => i + 1).map((p) => (
                    <button
                      key={p}
                      onClick={() => setParam("page", String(p))}
                      className={`w-9 h-9 rounded-full text-sm font-medium transition ${p === page ? "bg-primary text-white" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Floating Compare Bar */}
      {compareItems.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-white border border-gray-200 shadow-xl rounded-2xl px-5 py-3">
          <GitCompare className="w-4 h-4 text-primary flex-shrink-0" />
          <span className="text-sm font-medium text-gray-700">
            {compareItems.length} منتج للمقارنة
          </span>
          <Link
            href={`/${subdomain}/compare`}
            className="bg-primary text-white text-sm font-semibold px-4 py-1.5 rounded-full hover:opacity-80 transition"
          >
            مقارنة الآن
          </Link>
          <button onClick={clearCompare} className="text-gray-400 hover:text-gray-600 transition">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

function ProductCard({ product, subdomain }: { product: Product; subdomain: string }) {
  const thumb = product.images?.[0]?.url;
  const { toggleItem, isComparing } = useCompareStore();
  const comparing = isComparing(product.id);
  return (
    <div className="relative group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
      <Link href={`/${subdomain}/products/${product.slug}`}>
        <div className="aspect-square relative bg-gray-100">
          {thumb ? (
            <Image src={thumb} alt={product.nameAr || product.name} fill className="object-cover group-hover:scale-105 transition duration-300" />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-300">
              <ShoppingBag className="w-10 h-10" />
            </div>
          )}
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">-خصم</span>
          )}
        </div>
      </Link>
      <WishlistButton
        className="absolute top-2 left-2"
        item={{
          productId: product.id,
          subdomain,
          name: product.name,
          nameAr: product.nameAr,
          slug: product.slug,
          price: product.price,
          comparePrice: product.comparePrice,
          image: thumb ?? null,
        }}
      />
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate">{product.nameAr || product.name}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900">{formatBHD(product.price)}</span>
            {product.comparePrice && product.comparePrice > product.price && (
              <span className="text-xs text-gray-400 line-through">{formatBHD(product.comparePrice)}</span>
            )}
          </div>
          <button
            onClick={() => toggleItem(product)}
            title={comparing ? "إزالة من المقارنة" : "مقارنة"}
            className={`flex-shrink-0 flex items-center justify-center w-7 h-7 rounded-lg border transition ${
              comparing ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-400 hover:border-primary hover:text-primary"
            }`}
          >
            <GitCompare className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
