"use client";

import { Heart } from "lucide-react";
import { useWishlistStore, type WishlistItem } from "@/lib/wishlist.store";
import { cn } from "@/lib/utils";

export function WishlistButton({
  item,
  className,
}: {
  item: WishlistItem;
  className?: string;
}) {
  const { toggle, isWishlisted } = useWishlistStore();
  const wishlisted = isWishlisted(item.productId);

  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        toggle(item);
      }}
      aria-label={wishlisted ? "إزالة من المفضلة" : "إضافة للمفضلة"}
      className={cn(
        "rounded-full p-1.5 transition backdrop-blur-sm",
        wishlisted
          ? "text-red-500 bg-white/90 shadow-sm"
          : "text-gray-400 bg-white/80 hover:text-red-400 hover:bg-white/90",
        className
      )}
    >
      <Heart className={cn("w-4 h-4", wishlisted && "fill-current")} />
    </button>
  );
}
