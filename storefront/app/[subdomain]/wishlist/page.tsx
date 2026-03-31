"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Heart, ShoppingBag, Trash2 } from "lucide-react";
import { useWishlistStore } from "@/lib/wishlist.store";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";

export default function WishlistPage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const [subdomain, setSubdomain] = useState("");
  const { items, toggle } = useWishlistStore();
  const { addItem } = useCartStore();

  useEffect(() => {
    params.then((p) => setSubdomain(p.subdomain));
  }, [params]);

  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-24 text-center">
        <Heart className="w-20 h-20 mx-auto text-gray-200 mb-6" />
        <h1 className="text-2xl font-bold text-gray-800 mb-3">قائمة المفضلة فارغة</h1>
        <p className="text-gray-500 mb-8">احفظ المنتجات التي تعجبك لتجدها هنا لاحقاً</p>
        <Link
          href={subdomain ? `/${subdomain}/products` : "#"}
          className="inline-flex items-center gap-2 bg-primary text-white font-semibold px-8 py-3 rounded-full hover:opacity-80 transition"
        >
          <ShoppingBag className="w-5 h-5" />
          تصفح المنتجات
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Heart className="w-6 h-6 text-red-500 fill-current" />
          المفضلة ({items.length})
        </h1>
        <button
          onClick={() => useWishlistStore.getState().clear()}
          className="text-sm text-gray-400 hover:text-red-500 transition flex items-center gap-1.5"
        >
          <Trash2 className="w-4 h-4" />
          مسح الكل
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {items.map((item) => (
          <div key={item.productId} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
            <Link href={`/${item.subdomain}/products/${item.slug}`} className="block relative aspect-square bg-gray-100">
              {item.image ? (
                <Image
                  src={item.image}
                  alt={item.nameAr || item.name}
                  fill
                  className="object-cover group-hover:scale-105 transition duration-300"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-300">
                  <ShoppingBag className="w-12 h-12" />
                </div>
              )}
              <button
                onClick={() => toggle(item)}
                className="absolute top-2 left-2 p-1.5 bg-white/90 rounded-full text-red-500 shadow-sm hover:bg-white transition"
                aria-label="إزالة من المفضلة"
              >
                <Heart className="w-4 h-4 fill-current" />
              </button>
            </Link>
            <div className="p-3">
              <p className="text-sm font-medium text-gray-900 truncate">{item.nameAr || item.name}</p>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-bold text-gray-900">{formatBHD(item.price)}</span>
                {item.comparePrice && item.comparePrice > item.price && (
                  <span className="text-xs text-gray-400 line-through">{formatBHD(item.comparePrice)}</span>
                )}
              </div>
              <button
                onClick={() =>
                  addItem({
                    productId: item.productId,
                    name: item.name,
                    nameAr: item.nameAr,
                    price: item.price,
                    quantity: 1,
                    image: item.image,
                    stock: 999,
                  })
                }
                className="mt-2 w-full text-xs font-semibold bg-primary text-white py-2 rounded-full hover:opacity-80 transition"
              >
                أضف للسلة
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
