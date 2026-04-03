"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Eye, Sparkles, TrendingUp } from "lucide-react";
import { useConvertedPrice } from "./currency-selector";

interface Product {
  id: string;
  name: string;
  nameAr?: string;
  price: number;
  images: string[];
  slug: string;
}

function ProductCard({ product, storeSubdomain }: { product: Product; storeSubdomain: string }) {
  const { price, symbol } = useConvertedPrice(product.price);
  const name = product.nameAr || product.name;

  return (
    <Link
      href={`/${storeSubdomain}/products/${product.slug || product.id}`}
      className="group flex-shrink-0 w-40 md:w-48"
    >
      <div className="aspect-square rounded-xl overflow-hidden bg-gray-100 dark:bg-gray-800 mb-2">
        {product.images?.[0] ? (
          <img
            src={product.images[0]}
            alt={name}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-gray-400 text-xs">
            لا صورة
          </div>
        )}
      </div>
      <div className="text-sm font-medium text-gray-900 dark:text-white line-clamp-2">{name}</div>
      <div className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-0.5">
        {price.toFixed(3)} {symbol}
      </div>
    </Link>
  );
}

// Also Viewed Widget
export function AlsoViewedWidget({ productId, storeSubdomain }: { productId: string; storeSubdomain: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`/api/recommendations/also-viewed/${productId}`)
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, [productId]);

  if (products.length === 0) return null;

  return (
    <section className="py-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Eye className="w-5 h-5 text-indigo-500" />
        شاهد أيضاً
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {products.map(p => (
          <ProductCard key={p.id} product={p} storeSubdomain={storeSubdomain} />
        ))}
      </div>
    </section>
  );
}

// Complete the Look Widget
export function CompleteTheLookWidget({ productId, storeSubdomain }: { productId: string; storeSubdomain: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`/api/recommendations/complete-the-look/${productId}`)
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, [productId]);

  if (products.length === 0) return null;

  return (
    <section className="py-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-pink-500" />
        أكمل الإطلالة
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {products.map(p => (
          <ProductCard key={p.id} product={p} storeSubdomain={storeSubdomain} />
        ))}
      </div>
    </section>
  );
}

// Trending Products Widget
export function TrendingProductsWidget({ storeId, storeSubdomain }: { storeId: string; storeSubdomain: string }) {
  const [products, setProducts] = useState<Product[]>([]);

  useEffect(() => {
    fetch(`/api/recommendations/trending/${storeId}?limit=8`)
      .then(r => r.json())
      .then(d => setProducts(d.products || []))
      .catch(() => {});
  }, [storeId]);

  if (products.length === 0) return null;

  return (
    <section className="py-6">
      <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-orange-500" />
        الأكثر مبيعاً
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
        {products.map(p => (
          <ProductCard key={p.id} product={p} storeSubdomain={storeSubdomain} />
        ))}
      </div>
    </section>
  );
}

// Product View Tracker (call on product page mount)
export function ProductViewTracker({ productId, customerId }: { productId: string; customerId?: string }) {
  useEffect(() => {
    fetch("/api/recommendations/view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ productId, customerId }),
    }).catch(() => {});
  }, [productId, customerId]);

  return null;
}
