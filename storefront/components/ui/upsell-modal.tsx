"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { api } from "@/lib/api";
import { useCartStore } from "@/lib/cart.store";
import { formatBHD } from "@/lib/utils";
import { ShoppingCart, Tag, X } from "lucide-react";

interface OfferProduct {
  id: string;
  name: string;
  nameAr: string;
  slug: string;
  price: number;
  comparePrice: number | null;
  stock: number;
  images: { url: string }[];
}

interface UpsellRule {
  id: string;
  titleAr: string;
  discountPct: number;
  offerProducts: OfferProduct[];
}

interface Props {
  storeId: string;
  cartProductIds: string[];
}

export function UpsellModal({ storeId, cartProductIds }: Props) {
  const [rules, setRules] = useState<UpsellRule[]>([]);
  const [dismissed, setDismissed] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const items = useCartStore((s) => s.items);

  useEffect(() => {
    if (!storeId || cartProductIds.length === 0) return;

    const fetchRules = async () => {
      const seen = new Set<string>();
      const collected: UpsellRule[] = [];

      await Promise.all(
        cartProductIds.map(async (productId) => {
          try {
            const res = await api.get(`/upsell/public`, {
              params: { storeId, productId },
            });
            const fetched: UpsellRule[] = res.data.rules ?? [];
            for (const rule of fetched) {
              if (!seen.has(rule.id)) {
                seen.add(rule.id);
                collected.push(rule);
              }
            }
          } catch {
            // ignore individual fetch failures
          }
        })
      );

      setRules(collected);
    };

    fetchRules();
  }, [storeId, cartProductIds.join(",")]); // eslint-disable-line react-hooks/exhaustive-deps

  const cartProductIdSet = new Set(items.map((i) => i.productId));

  // Flatten deduplicated offer products with their discount
  const offers: { product: OfferProduct; discountPct: number; ruleTitle: string }[] = [];
  const addedProductIds = new Set<string>();

  for (const rule of rules) {
    for (const product of rule.offerProducts) {
      if (!addedProductIds.has(product.id) && !cartProductIdSet.has(product.id)) {
        addedProductIds.add(product.id);
        offers.push({ product, discountPct: rule.discountPct, ruleTitle: rule.titleAr });
      }
    }
  }

  if (offers.length === 0 || dismissed) return null;

  return (
    <div className="relative bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-5 mt-6">
      <button
        onClick={() => setDismissed(true)}
        className="absolute top-3 left-3 text-gray-400 hover:text-gray-600"
        aria-label="إغلاق"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-2 mb-4">
        <Tag className="w-5 h-5 text-amber-600" />
        <h3 className="font-bold text-gray-900 text-base">قد يعجبك أيضاً</h3>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {offers.slice(0, 4).map(({ product, discountPct, ruleTitle }) => {
          const discountedPrice = discountPct > 0
            ? product.price * (1 - discountPct / 100)
            : product.price;
          const image = product.images?.[0]?.url ?? null;

          return (
            <div
              key={product.id}
              className="flex gap-3 bg-white rounded-xl border border-amber-100 p-3 shadow-sm"
            >
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100 relative">
                {image ? (
                  <Image src={image} alt={product.nameAr || product.name} fill className="object-cover" />
                ) : (
                  <div className="flex items-center justify-center h-full text-gray-300">
                    <ShoppingCart className="w-6 h-6" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate leading-tight">
                  {product.nameAr || product.name}
                </p>
                {ruleTitle && (
                  <p className="text-xs text-amber-600 truncate">{ruleTitle}</p>
                )}
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-sm font-bold text-gray-900">{formatBHD(discountedPrice)}</span>
                  {discountPct > 0 && (
                    <>
                      <span className="text-xs text-gray-400 line-through">{formatBHD(product.price)}</span>
                      <span className="text-xs font-semibold text-green-600 bg-green-50 px-1 rounded">
                        -{discountPct}%
                      </span>
                    </>
                  )}
                </div>
                <button
                  disabled={product.stock <= 0}
                  onClick={() =>
                    addItem({
                      productId: product.id,
                      name: product.name,
                      nameAr: product.nameAr,
                      price: discountedPrice,
                      quantity: 1,
                      image,
                      stock: product.stock,
                    })
                  }
                  className="mt-1.5 w-full text-xs font-semibold py-1.5 rounded-lg bg-amber-500 text-white hover:bg-amber-600 transition disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {product.stock > 0 ? "أضف للسلة" : "نفد المخزون"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
