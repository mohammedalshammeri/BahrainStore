"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCompareStore } from "@/lib/compare.store";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";
import { X, ShoppingCart, Package, ArrowRight } from "lucide-react";
import { useState } from "react";

export default function ComparePage() {
  const params = useParams() as { subdomain: string };
  const { subdomain } = params;
  const { items, removeItem, clear } = useCompareStore();
  const addItem = useCartStore((s) => s.addItem);
  const [addedIds, setAddedIds] = useState<string[]>([]);

  function handleAddToCart(product: (typeof items)[0]) {
    addItem({
      productId: product.id,
      name: product.name,
      nameAr: product.nameAr,
      price: product.price,
      quantity: 1,
      stock: product.stock,
      image: product.images?.[0]?.url,
    });
    setAddedIds((ids) => [...ids, product.id]);
    setTimeout(() => setAddedIds((ids) => ids.filter((id) => id !== product.id)), 2000);
  }

  if (items.length === 0) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-24 text-center">
        <Package className="w-20 h-20 mx-auto text-gray-200 mb-4" />
        <h2 className="text-xl font-bold text-gray-900 mb-2">لا توجد منتجات للمقارنة</h2>
        <p className="text-gray-500 mb-6">أضف منتجات من صفحة المنتجات بالنقر على زر المقارنة</p>
        <Link
          href={`/${subdomain}/products`}
          className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-full font-semibold text-sm hover:opacity-80 transition"
        >
          <ArrowRight className="w-4 h-4" />
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  const rows = [
    { label: "السعر", render: (p: (typeof items)[0]) => <span className="font-bold text-lg text-primary">{formatBHD(p.price)}</span> },
    { label: "سعر المقارنة", render: (p: (typeof items)[0]) => p.comparePrice ? <span className="text-gray-400 line-through">{formatBHD(p.comparePrice)}</span> : <span className="text-gray-300">—</span> },
    { label: "التصنيف", render: (p: (typeof items)[0]) => <span className="text-sm text-gray-700">{p.category ? (p.category.nameAr || p.category.name) : "—"}</span> },
    { label: "المخزون", render: (p: (typeof items)[0]) => p.stock > 0 ? <span className="text-green-600 font-medium text-sm">متوفر ({p.stock})</span> : <span className="text-red-500 text-sm">نفد</span> },
    { label: "الوصف", render: (p: (typeof items)[0]) => <span className="text-xs text-gray-500 line-clamp-3">{p.descriptionAr || p.description || "—"}</span> },
    { label: "المتغيرات", render: (p: (typeof items)[0]) => p.variants && p.variants.length > 0 ? <span className="text-sm text-gray-700">{p.variants.map(v => v.name).join("، ")}</span> : <span className="text-gray-300">—</span> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">مقارنة المنتجات</h1>
          <p className="text-sm text-gray-500 mt-0.5">{items.length} منتج مختار</p>
        </div>
        <button
          onClick={clear}
          className="text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition"
        >
          مسح الكل
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-right" style={{ minWidth: `${items.length * 200 + 180}px` }}>
          {/* Product header row */}
          <thead>
            <tr className="border-b border-gray-100">
              <th className="w-44 px-4 py-4 text-sm font-medium text-gray-500 bg-gray-50 sticky right-0 z-10">المنتج</th>
              {items.map((product) => (
                <th key={product.id} className="px-4 py-4 align-top">
                  <div className="relative">
                    <button
                      onClick={() => removeItem(product.id)}
                      className="absolute -top-1 -left-1 w-6 h-6 flex items-center justify-center bg-red-100 hover:bg-red-200 text-red-500 rounded-full transition z-10"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <Link href={`/${subdomain}/products/${product.slug}`}>
                      <div className="w-28 h-28 mx-auto rounded-xl overflow-hidden bg-gray-100 mb-2 relative">
                        {product.images?.[0]?.url ? (
                          <Image src={product.images[0].url} alt={product.nameAr || product.name} fill className="object-cover" />
                        ) : (
                          <div className="flex items-center justify-center h-full">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-semibold text-gray-900 text-center line-clamp-2 hover:text-primary transition">
                        {product.nameAr || product.name}
                      </p>
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Comparison rows */}
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                <td className="px-4 py-3 text-sm font-medium text-gray-600 bg-gray-50 sticky right-0">{row.label}</td>
                {items.map((product) => (
                  <td key={product.id} className="px-4 py-3 text-center">
                    {row.render(product)}
                  </td>
                ))}
              </tr>
            ))}

            {/* Add to cart row */}
            <tr>
              <td className="px-4 py-4 text-sm font-medium text-gray-600 bg-gray-50 sticky right-0">الإجراء</td>
              {items.map((product) => (
                <td key={product.id} className="px-4 py-4 text-center">
                  <button
                    onClick={() => handleAddToCart(product)}
                    disabled={product.stock === 0}
                    className={`flex items-center justify-center gap-1.5 mx-auto px-4 py-2 rounded-full text-sm font-semibold transition
                      ${addedIds.includes(product.id) ? "bg-green-500 text-white" : "bg-primary text-white hover:opacity-80"}
                      ${product.stock === 0 ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <ShoppingCart className="w-3.5 h-3.5" />
                    {addedIds.includes(product.id) ? "تمت الإضافة" : "أضف للسلة"}
                  </button>
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-center">
        <Link href={`/${subdomain}/products`} className="text-sm text-primary hover:underline">
          ← العودة للمنتجات وإضافة المزيد
        </Link>
      </div>
    </div>
  );
}
