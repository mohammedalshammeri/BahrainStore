"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, Search, Menu, X, Store, User, Heart, Loader2 } from "lucide-react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useCartStore } from "@/lib/cart.store";
import { useWishlistStore } from "@/lib/wishlist.store";
import { api } from "@/lib/api";
import type { StorePublic, Product } from "@/lib/types";
import { cn } from "@/lib/utils";
import { formatBHD } from "@/lib/utils";
import { DarkModeToggle } from "@/components/ui/dark-mode-toggle";
import { CurrencySelector } from "@/components/ui/currency-selector";

interface NavbarProps {
  store: StorePublic;
}

export function Navbar({ store }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQ, setSearchQ] = useState("");
  const [suggestions, setSuggestions] = useState<Product[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchContainerRef = useRef<HTMLDivElement>(null);
  const itemCount = useCartStore((s) => s.itemCount);
  const wishlistCount = useWishlistStore((s) => s.items.length);

  const displayName = store.nameAr || store.name;

  // Debounced instant search
  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (!q || q.trim().length < 2 || !store.id) {
        setSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      setSuggestionsLoading(true);
      try {
        const res = await api.get(`/products/store/${store.id}/instant?q=${encodeURIComponent(q)}`);
        setSuggestions(res.data.products ?? []);
        setShowSuggestions(true);
      } catch {
        setSuggestions([]);
      } finally {
        setSuggestionsLoading(false);
      }
    },
    [store.id]
  );

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!searchQ.trim()) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }
    debounceRef.current = setTimeout(() => fetchSuggestions(searchQ), 280);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [searchQ, fetchSuggestions]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setShowSuggestions(false);
    if (searchQ.trim()) {
      window.location.href = `/${store.subdomain}/products?q=${encodeURIComponent(searchQ)}`;
    }
  }

  return (
    <header className="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo / Brand */}
        <Link href={`/${store.subdomain}`} className="flex items-center gap-2 flex-shrink-0">
          {store.logo ? (
            <Image src={store.logo} alt={displayName} width={40} height={40} className="object-contain rounded" />
          ) : (
            <Store className="w-7 h-7 text-primary" />
          )}
          <span className="font-bold text-lg text-gray-900">{displayName}</span>
        </Link>

        {/* Search bar (desktop) */}
        <div ref={searchContainerRef} className="hidden md:flex flex-1 max-w-md relative">
          <form
            className="flex flex-1 items-center bg-gray-100 rounded-full px-4 gap-2"
            onSubmit={handleSearchSubmit}
          >
            <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder="ابحث عن منتج..."
              className="bg-transparent flex-1 text-sm py-2 outline-none placeholder:text-gray-400"
            />
            {suggestionsLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin flex-shrink-0" />}
            {searchQ && !suggestionsLoading && (
              <button type="button" onClick={() => { setSearchQ(""); setSuggestions([]); setShowSuggestions(false); }}>
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </form>
          {/* Suggestions dropdown */}
          {showSuggestions && suggestions.length > 0 && (
            <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
              {suggestions.map((p) => (
                <SuggestionItem key={p.id} product={p} subdomain={store.subdomain} onSelect={() => { setShowSuggestions(false); setSearchQ(""); }} />
              ))}
              <Link
                href={`/${store.subdomain}/products?q=${encodeURIComponent(searchQ)}`}
                onClick={() => { setShowSuggestions(false); setSearchQ(""); }}
                className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm text-indigo-600 font-medium hover:bg-gray-100 border-t border-gray-100"
              >
                <span>عرض كل النتائج</span>
                <Search className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Mobile search toggle */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-gray-100"
            onClick={() => setSearchOpen((v) => !v)}
            aria-label="بحث"
          >
            {searchOpen ? <X className="w-5 h-5" /> : <Search className="w-5 h-5" />}
          </button>

          {/* Wishlist */}
          <Link
            href={`/${store.subdomain}/wishlist`}
            className="relative hidden sm:flex p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="المفضلة"
          >
            <Heart className="w-5 h-5" />
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] text-[10px] font-bold bg-primary text-white rounded-full flex items-center justify-center px-0.5">
                {wishlistCount > 99 ? "99+" : wishlistCount}
              </span>
            )}
          </Link>

          {/* Cart */}
          <Link
            href={`/${store.subdomain}/cart`}
            className="relative p-2 rounded-full hover:bg-gray-100 transition"
            aria-label="السلة"
          >
            <ShoppingCart className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -left-0.5 min-w-[18px] h-[18px] text-[10px] font-bold bg-red-500 text-white rounded-full flex items-center justify-center px-0.5">
                {itemCount > 99 ? "99+" : itemCount}
              </span>
            )}
          </Link>

          {/* Account */}
          <Link href={`/${store.subdomain}/account`} className="hidden md:flex p-2 rounded-full hover:bg-gray-100 transition" aria-label="حسابي">
            <User className="w-5 h-5" />
          </Link>

          {/* Currency selector */}
          <div className="hidden md:block">
            <CurrencySelector storeSubdomain={store.subdomain} />
          </div>

          {/* Dark mode toggle */}
          <DarkModeToggle className="hidden md:flex" />

          {/* Mobile menu */}
          <button
            className="md:hidden p-2 rounded-full hover:bg-gray-100"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="قائمة"
          >
            {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile search bar */}
      {searchOpen && (
        <div className="md:hidden px-4 pb-3">
          <div className="relative">
            <form
              className="flex items-center bg-gray-100 rounded-full px-4 gap-2"
              onSubmit={(e) => { handleSearchSubmit(e); setSearchOpen(false); }}
            >
              <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <input
                autoFocus
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="ابحث عن منتج..."
                className="bg-transparent flex-1 text-sm py-2.5 outline-none placeholder:text-gray-400"
              />
              {suggestionsLoading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
            </form>
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                {suggestions.map((p) => (
                  <SuggestionItem key={p.id} product={p} subdomain={store.subdomain} onSelect={() => { setShowSuggestions(false); setSearchQ(""); setSearchOpen(false); }} />
                ))}
                <Link
                  href={`/${store.subdomain}/products?q=${encodeURIComponent(searchQ)}`}
                  onClick={() => { setShowSuggestions(false); setSearchQ(""); setSearchOpen(false); }}
                  className="flex items-center justify-between px-4 py-2.5 bg-gray-50 text-sm text-indigo-600 font-medium hover:bg-gray-100 border-t border-gray-100"
                >
                  <span>عرض كل النتائج</span>
                  <Search className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Mobile nav menu */}
      <div
        className={cn(
          "md:hidden overflow-hidden transition-all duration-200",
          menuOpen ? "max-h-60 border-t border-gray-100" : "max-h-0"
        )}
      >
        <nav className="px-4 py-3 flex flex-col gap-1">
          <Link href={`/${store.subdomain}`} className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMenuOpen(false)}>
            الرئيسية
          </Link>
          <Link href={`/${store.subdomain}/products`} className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMenuOpen(false)}>
            المنتجات
          </Link>
          <Link href={`/${store.subdomain}/account`} className="py-2 text-sm font-medium hover:text-primary" onClick={() => setMenuOpen(false)}>
            حسابي
          </Link>
        </nav>
      </div>
    </header>
  );
}

// ── Suggestion item ───────────────────────────
function SuggestionItem({ product, subdomain, onSelect }: { product: Product; subdomain: string; onSelect: () => void }) {
  const image = product.images?.[0]?.url;
  const name = product.nameAr || product.name;
  const price = formatBHD(product.price);
  return (
    <Link
      href={`/${subdomain}/products/${product.slug}`}
      onClick={onSelect}
      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition"
    >
      {image ? (
        <Image src={image} alt={name} width={40} height={40} className="w-10 h-10 object-cover rounded-lg flex-shrink-0" />
      ) : (
        <div className="w-10 h-10 bg-gray-100 rounded-lg flex-shrink-0" />
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
        <p className="text-xs text-gray-500">{price}</p>
      </div>
    </Link>
  );
}
