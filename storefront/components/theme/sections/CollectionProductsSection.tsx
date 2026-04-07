"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, GitCompare, Search, ShoppingBag, SlidersHorizontal, X } from "lucide-react";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { useCompareStore } from "@/lib/compare.store";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";
import { formatBHD } from "@/lib/utils";

function parsePositiveNumber(input: unknown, fallback: number) {
  return typeof input === "number" && Number.isFinite(input) && input > 0 ? input : fallback;
}

export default function CollectionProductsSection({ section, globalData }: SectionProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const settings = section.settings as Record<string, unknown>;

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [minPrice, setMinPrice] = useState(searchParams.get("minPrice") ?? "");
  const [maxPrice, setMaxPrice] = useState(searchParams.get("maxPrice") ?? "");

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inStock = searchParams.get("inStock") === "true";
  const categoryId = searchParams.get("categoryId") ?? "";
  const sort = searchParams.get("sort") ?? "newest";
  const page = Number(searchParams.get("page") ?? "1");
  const productsPerPage = parsePositiveNumber(settings.productsPerPage, 20);
  const showSearch = settings.showSearch !== false;
  const showSort = settings.showSort !== false;
  const showFilters = settings.showFilters !== false;
  const showCompareBar = settings.showCompareBar !== false;
  const emptyTitle = typeof settings.emptyTitleAr === "string" && settings.emptyTitleAr.trim()
    ? settings.emptyTitleAr
    : "لا توجد منتجات";

  useEffect(() => {
    setSearch(searchParams.get("q") ?? "");
    setMinPrice(searchParams.get("minPrice") ?? "");
    setMaxPrice(searchParams.get("maxPrice") ?? "");
  }, [searchParams]);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    if (key !== "page") {
      params.delete("page");
    }
    router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
  }

  function handleSearchChange(value: string) {
    setSearch(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setParam("q", value);
    }, 350);
  }

  const queryParams: Record<string, string> = { sort, page: String(page), limit: String(productsPerPage) };
  if (search) queryParams.q = search;
  if (categoryId) queryParams.categoryId = categoryId;
  if (minPrice) queryParams.minPrice = minPrice;
  if (maxPrice) queryParams.maxPrice = maxPrice;
  if (inStock) queryParams.inStock = "true";

  const { data, isLoading } = useQuery({
    queryKey: ["collection-products", globalData.store.id, queryParams],
    queryFn: async () => {
      const query = new URLSearchParams(queryParams).toString();
      const response = await api.get(`/products/store/${globalData.store.id}?${query}`);
      return response.data as { products: Product[]; total: number; pages: number; page: number };
    },
  });

  const compareItems = useCompareStore((state) => state.items);
  const clearCompare = useCompareStore((state) => state.clear);

  const sortOptions = [
    { value: "newest", label: "الأحدث" },
    { value: "featured", label: "المميزة" },
    { value: "price_asc", label: "الأرخص أولاً" },
    { value: "price_desc", label: "الأغلى أولاً" },
  ];

  return (
    <SectionLayout section={section}>
      <div className="w-full" dir="rtl">
        <div className="mx-auto max-w-6xl px-0 py-2">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row">
            {showSearch ? (
              <div className="flex flex-1 items-center gap-2 rounded-full border border-gray-200 bg-white px-4 shadow-sm">
                <Search className="h-4 w-4 flex-shrink-0 text-gray-400" />
                <input
                  value={search}
                  onChange={(event) => handleSearchChange(event.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="flex-1 bg-transparent py-2.5 text-sm outline-none placeholder:text-gray-400"
                />
                {search ? (
                  <button onClick={() => handleSearchChange("")}>
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                ) : null}
              </div>
            ) : null}

            {showSort ? (
              <div className="relative">
                <select
                  value={sort}
                  onChange={(event) => setParam("sort", event.target.value)}
                  className="appearance-none rounded-full border border-gray-200 bg-white px-4 py-2.5 pr-9 text-sm shadow-sm outline-none"
                >
                  {sortOptions.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <ChevronDown className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              </div>
            ) : null}

            {showFilters ? (
              <button
                className="flex items-center justify-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2.5 text-sm shadow-sm sm:hidden"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <SlidersHorizontal className="h-4 w-4" />
                فلترة
              </button>
            ) : null}
          </div>

          <div className="flex gap-6">
            {showFilters ? (
              <aside className={`${filtersOpen ? "block" : "hidden"} w-full flex-shrink-0 sm:block sm:w-56`}>
                <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-semibold text-gray-900">التصنيف</h3>
                  <ul className="space-y-1.5">
                    <li>
                      <button
                        onClick={() => setParam("categoryId", "")}
                        className={`w-full rounded-lg px-2 py-1.5 text-right text-sm transition ${!categoryId ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100"}`}
                      >
                        الكل
                      </button>
                    </li>
                    {globalData.categories.map((category) => (
                      <li key={category.id}>
                        <button
                          onClick={() => setParam("categoryId", category.id)}
                          className={`w-full rounded-lg px-2 py-1.5 text-right text-sm transition ${categoryId === category.id ? "bg-primary text-white" : "text-gray-700 hover:bg-gray-100"}`}
                        >
                          {category.nameAr || category.name}
                          {category._count ? <span className="mr-1 text-xs opacity-60">({category._count.products})</span> : null}
                        </button>
                        {category.children?.map((child) => (
                          <button
                            key={child.id}
                            onClick={() => setParam("categoryId", child.id)}
                            className={`mt-0.5 w-full rounded-lg px-4 py-1 text-right text-xs transition ${categoryId === child.id ? "bg-gray-700 text-white" : "text-gray-500 hover:bg-gray-50"}`}
                          >
                            {child.nameAr || child.name}
                          </button>
                        ))}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="mb-3 rounded-2xl border border-gray-200 bg-white p-4">
                  <h3 className="mb-3 font-semibold text-gray-900">نطاق السعر</h3>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      min="0"
                      value={minPrice}
                      onChange={(event) => setMinPrice(event.target.value)}
                      onBlur={() => setParam("minPrice", minPrice)}
                      placeholder="من"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                    <span className="flex-shrink-0 text-sm text-gray-400">—</span>
                    <input
                      type="number"
                      min="0"
                      value={maxPrice}
                      onChange={(event) => setMaxPrice(event.target.value)}
                      onBlur={() => setParam("maxPrice", maxPrice)}
                      placeholder="إلى"
                      className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                  {minPrice || maxPrice ? (
                    <button
                      onClick={() => {
                        setMinPrice("");
                        setMaxPrice("");
                        const params = new URLSearchParams(searchParams.toString());
                        params.delete("minPrice");
                        params.delete("maxPrice");
                        params.delete("page");
                        router.push(params.toString() ? `${pathname}?${params.toString()}` : pathname);
                      }}
                      className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-red-500"
                    >
                      <X className="h-3 w-3" /> مسح الفلتر
                    </button>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-gray-200 bg-white p-4">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={inStock}
                      onChange={(event) => setParam("inStock", event.target.checked ? "true" : "")}
                      className="h-4 w-4 rounded accent-primary"
                    />
                    <span className="text-sm font-medium text-gray-700">متوفر في المخزون فقط</span>
                  </label>
                </div>
              </aside>
            ) : null}

            <div className="flex-1">
              {isLoading ? (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, index) => (
                    <div key={index} className="aspect-square rounded-2xl bg-gray-100 animate-pulse" />
                  ))}
                </div>
              ) : data?.products.length === 0 ? (
                <div className="py-24 text-center text-gray-400">
                  <ShoppingBag className="mx-auto mb-3 h-16 w-16 opacity-30" />
                  <p>{emptyTitle}</p>
                </div>
              ) : (
                <>
                  <p className="mb-4 text-sm text-gray-500">{data?.total ?? 0} منتج</p>
                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {data?.products.map((product) => (
                      <ProductCard key={product.id} product={product} subdomain={globalData.subdomain} />
                    ))}
                  </div>

                  {data && data.pages > 1 ? (
                    <div className="mt-8 flex justify-center gap-2">
                      {Array.from({ length: data.pages }, (_, index) => index + 1).map((pageNumber) => (
                        <button
                          key={pageNumber}
                          onClick={() => setParam("page", String(pageNumber))}
                          className={`h-9 w-9 rounded-full text-sm font-medium transition ${pageNumber === page ? "bg-primary text-white" : "border border-gray-200 bg-white text-gray-600 hover:bg-gray-50"}`}
                        >
                          {pageNumber}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </div>
          </div>
        </div>

        {showCompareBar && compareItems.length > 0 ? (
          <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-2xl border border-gray-200 bg-white px-5 py-3 shadow-xl">
            <GitCompare className="h-4 w-4 flex-shrink-0 text-primary" />
            <span className="text-sm font-medium text-gray-700">{compareItems.length} منتج للمقارنة</span>
            <Link
              href={`/${globalData.subdomain}/compare`}
              className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white transition hover:opacity-80"
            >
              مقارنة الآن
            </Link>
            <button onClick={clearCompare} className="text-gray-400 transition hover:text-gray-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </SectionLayout>
  );
}

function ProductCard({ product, subdomain }: { product: Product; subdomain: string }) {
  const thumb = product.images?.[0]?.url;
  const { toggleItem, isComparing } = useCompareStore();
  const comparing = isComparing(product.id);

  return (
    <div className="group relative overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-md">
      <Link href={`/${subdomain}/products/${product.slug}`}>
        <div className="relative aspect-square bg-gray-100">
          {thumb ? (
            <Image src={thumb} alt={product.nameAr || product.name} fill className="object-cover transition duration-300 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-gray-300">
              <ShoppingBag className="h-10 w-10" />
            </div>
          )}
          {product.comparePrice && product.comparePrice > product.price ? (
            <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">-خصم</span>
          ) : null}
        </div>
      </Link>
      <WishlistButton
        className="absolute left-2 top-2"
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
        <p className="truncate text-sm font-medium text-gray-900">{product.nameAr || product.name}</p>
        <div className="mt-1 flex items-center justify-between gap-2">
          <div className="flex items-baseline gap-2">
            <span className="font-bold text-gray-900">{formatBHD(product.price)}</span>
            {product.comparePrice && product.comparePrice > product.price ? (
              <span className="text-xs text-gray-400 line-through">{formatBHD(product.comparePrice)}</span>
            ) : null}
          </div>
          <button
            onClick={() => toggleItem(product)}
            title={comparing ? "إزالة من المقارنة" : "مقارنة"}
            className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg border transition ${comparing ? "border-primary bg-primary text-white" : "border-gray-200 text-gray-400 hover:border-primary hover:text-primary"}`}
          >
            <GitCompare className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}