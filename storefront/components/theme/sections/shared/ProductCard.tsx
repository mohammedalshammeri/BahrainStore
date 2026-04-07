import Image from "next/image";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { WishlistButton } from "@/components/ui/wishlist-button";
import { formatBHD } from "@/lib/utils";
import type { Product } from "@/lib/types";

export function ProductCard({ product, subdomain }: { product: Product; subdomain: string }) {
  const thumb = product.images?.[0]?.url;

  return (
    <Link href={`/${subdomain}/products/${product.slug}`} className="group overflow-hidden rounded-xl border border-gray-200 bg-white transition hover:shadow-md">
      <div className="relative aspect-square bg-gray-100">
        {thumb ? (
          <Image src={thumb} alt={product.nameAr || product.name} fill className="object-cover transition duration-300 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <ShoppingBag className="h-12 w-12" />
          </div>
        )}
        {product.comparePrice && product.comparePrice > product.price && (
          <span className="absolute right-2 top-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-bold text-white">
            تخفيض
          </span>
        )}
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
      </div>
      <div className="p-3">
        <p className="truncate text-sm font-medium text-gray-900">{product.nameAr || product.name}</p>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-bold text-gray-900">{formatBHD(product.price)}</span>
          {product.comparePrice && product.comparePrice > product.price && (
            <span className="text-xs text-gray-400 line-through">{formatBHD(product.comparePrice)}</span>
          )}
        </div>
      </div>
    </Link>
  );
}