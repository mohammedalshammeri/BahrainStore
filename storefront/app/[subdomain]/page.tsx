import Image from "next/image";
import Link from "next/link";
import { api } from "@/lib/api";
import type { StorePublic, Category, Product } from "@/lib/types";
import { formatBHD } from "@/lib/utils";
import { ShoppingBag, Tag } from "lucide-react";
import { WishlistButton } from "@/components/ui/wishlist-button";

async function getStoreData(subdomain: string) {
  const [storeRes, productsRes, catsRes, blocksRes] = await Promise.all([
    api.get(`/stores/s/${subdomain}`),
    api.get(`/products/store/${subdomain}`).catch(() => ({ data: { products: [] } })),
    api.get(`/categories/store/${subdomain}`).catch(() => ({ data: { categories: [] } })),
    api.get(`/stores/s/${subdomain}/homepage`).catch(() => ({ data: { blocks: [] } })),
  ]);
  return {
    store: storeRes.data.store as StorePublic,
    products: productsRes.data.products as Product[],
    categories: catsRes.data.categories as Category[],
    blocks: (blocksRes.data.blocks ?? []) as PageBlock[],
  };
}

// ─── Page Block Types ─────────────────────────────────────────────────────────
interface PageBlock {
  id: string;
  type: "hero" | "banner" | "products_grid" | "categories" | "marquee" | "text" | "divider";
  props: Record<string, any>;
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ subdomain: string }>;
}) {
  const { subdomain } = await params;
  const { store, products, categories, blocks } = await getStoreData(subdomain);

  const featured = products.filter((p) => p.isFeatured).slice(0, 8);
  const latest = products.slice(0, 8);
  const displayProducts = featured.length >= 4 ? featured : latest;

  // ── If Page Builder blocks exist, render them ──
  if (blocks.length > 0) {
    return (
      <div>
        {blocks.map((block) => (
          <BlockRenderer
            key={block.id}
            block={block}
            subdomain={subdomain}
            products={products}
            categories={categories}
          />
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* Hero */}
      <HeroSection store={store} subdomain={subdomain} />

      {/* Categories */}
      {categories.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 py-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center gap-2">
            <Tag className="w-6 h-6" />
            التصنيفات
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                href={`/${subdomain}/products?categoryId=${cat.id}`}
                className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition text-center"
              >
                <span className="text-2xl">🏷️</span>
                <span className="text-sm font-medium text-gray-800 truncate w-full">{cat.nameAr || cat.name}</span>
                {cat._count && (
                  <span className="text-xs text-gray-400">{cat._count.products} منتج</span>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Products */}
      {displayProducts.length > 0 && (
        <section className="max-w-6xl mx-auto px-4 pb-16">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900">
              {featured.length >= 4 ? "منتجات مميزة" : "أحدث المنتجات"}
            </h2>
            <Link href={`/${subdomain}/products`} className="text-sm text-blue-600 hover:underline">
              عرض الكل
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {displayProducts.map((product) => (
              <ProductCard key={product.id} product={product} subdomain={subdomain} />
            ))}
          </div>
        </section>
      )}

      {products.length === 0 && (
        <div className="text-center py-24 text-gray-400">
          <ShoppingBag className="w-16 h-16 mx-auto mb-4 opacity-30" />
          <p className="text-xl">لا توجد منتجات بعد</p>
        </div>
      )}
    </div>
  );
}

function BlockRenderer({
  block,
  subdomain,
  products,
  categories,
}: {
  block: PageBlock;
  subdomain: string;
  products: Product[];
  categories: Category[];
}) {
  const p = block.props;

  if (block.type === "hero") {
    return (
      <section
        className="py-20 px-4"
        style={{ background: p.bgColor || "#1e1b4b" }}
      >
        <div
          className="max-w-5xl mx-auto"
          style={{ textAlign: (p.align as any) || "center" }}
        >
          <h1 className="text-4xl md:text-6xl font-bold mb-4" style={{ color: p.textColor || "#fff" }}>
            {p.titleAr}
          </h1>
          {p.subtitleAr && (
            <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: `${p.textColor || "#fff"}bb` }}>
              {p.subtitleAr}
            </p>
          )}
          {p.buttonTextAr && (
            <Link
              href={`/${subdomain}${p.buttonLink || "/products"}`}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold bg-white text-gray-900 hover:opacity-90 transition"
            >
              {p.buttonTextAr}
            </Link>
          )}
        </div>
      </section>
    );
  }

  if (block.type === "banner") {
    return (
      <section
        className="relative overflow-hidden"
        style={{ height: `${p.height || 400}px` }}
      >
        {p.imageUrl && (
          <Image src={p.imageUrl} alt={p.titleAr || ""} fill className="object-cover" />
        )}
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${p.overlayOpacity ?? 0.45})` }}
        />
        <div className="relative h-full flex flex-col items-center justify-center text-center px-4">
          {p.titleAr && (
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">{p.titleAr}</h2>
          )}
          {p.buttonTextAr && (
            <Link
              href={`/${subdomain}${p.buttonLink || "/products"}`}
              className="inline-flex items-center gap-2 px-8 py-3 rounded-full font-semibold bg-white text-gray-900 hover:opacity-90 transition"
            >
              {p.buttonTextAr}
            </Link>
          )}
        </div>
      </section>
    );
  }

  if (block.type === "products_grid") {
    let filtered = products;
    if (p.filter === "featured") filtered = products.filter((pr) => pr.isFeatured);
    if (p.filter === "latest") filtered = products.slice().reverse();
    const displayed = filtered.slice(0, Number(p.count) || 8);
    return (
      <section className="max-w-6xl mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">{p.titleAr || "المنتجات"}</h2>
          <Link href={`/${subdomain}/products`} className="text-sm text-blue-600 hover:underline">
            عرض الكل
          </Link>
        </div>
        {displayed.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {displayed.map((product) => (
              <ProductCard key={product.id} product={product} subdomain={subdomain} />
            ))}
          </div>
        ) : (
          <p className="text-gray-400 text-center py-8">لا توجد منتجات</p>
        )}
      </section>
    );
  }

  if (block.type === "categories") {
    return (
      <section className="max-w-6xl mx-auto px-4 py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">{p.titleAr || "التصنيفات"}</h2>
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${p.columns || 4}, minmax(0, 1fr))` }}
        >
          {categories.map((cat) => (
            <Link
              key={cat.id}
              href={`/${subdomain}/products?categoryId=${cat.id}`}
              className="flex flex-col items-center gap-2 p-4 bg-white rounded-xl border border-gray-200 hover:border-gray-400 hover:shadow-sm transition text-center"
            >
              <span className="text-2xl">🏷️</span>
              <span className="text-sm font-medium text-gray-800 truncate w-full">{cat.nameAr || cat.name}</span>
              {cat._count && <span className="text-xs text-gray-400">{cat._count.products} منتج</span>}
            </Link>
          ))}
        </div>
      </section>
    );
  }

  if (block.type === "marquee") {
    const duration = p.speed === "slow" ? "40s" : p.speed === "fast" ? "15s" : "25s";
    return (
      <div
        className="overflow-hidden py-3"
        style={{ background: p.bgColor || "#1e1b4b", color: p.textColor || "#fff" }}
      >
        <div
          className="flex whitespace-nowrap"
          style={{
            animation: `marquee ${duration} linear infinite`,
          }}
        >
          {[...Array(4)].map((_, i) => (
            <span key={i} className="mx-8 text-sm font-medium">
              {p.text}
            </span>
          ))}
        </div>
        <style>{`@keyframes marquee { from { transform: translateX(0) } to { transform: translateX(-50%) } }`}</style>
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <section className="max-w-4xl mx-auto px-4 py-10">
        <p
          className="text-gray-700 leading-relaxed"
          style={{ textAlign: (p.align as any) || "center" }}
        >
          {p.textAr}
        </p>
      </section>
    );
  }

  if (block.type === "divider") {
    return (
      <div
        style={{
          height: `${p.height || 40}px`,
          background: p.color === "transparent" ? "transparent" : p.color || "transparent",
        }}
      />
    );
  }

  return null;
}

function HeroSection({ store, subdomain }: { store: StorePublic; subdomain: string }) {
  const theme = store.settings?.theme ?? "default";
  const name = store.nameAr || store.name;
  const desc = store.descriptionAr;

  if (theme === "bold") {
    return (
      <section className="py-20 px-4" style={{ background: "var(--store-primary)" }}>
        <div className="max-w-5xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black leading-none text-white uppercase tracking-tight">
            {name}
          </h1>
          <div className="h-1.5 w-24 my-5" style={{ background: "var(--store-secondary)" }} />
          {desc && (
            <p className="text-white/75 text-lg mb-8 max-w-xl leading-relaxed">{desc}</p>
          )}
          <Link
            href={`/${subdomain}/products`}
            className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-bold text-lg text-white hover:opacity-90 transition"
            style={{ background: "var(--store-secondary)" }}
          >
            <ShoppingBag className="w-6 h-6" />
            تسوق الآن
          </Link>
        </div>
      </section>
    );
  }

  if (theme === "elegant") {
    return (
      <section
        className="py-28 px-4"
        style={{
          background:
            "linear-gradient(to bottom, color-mix(in oklch, var(--store-primary), white 93%), white)",
        }}
      >
        <div className="max-w-2xl mx-auto text-center">
          <div className="w-16 h-px mx-auto mb-8" style={{ background: "var(--store-primary)" }} />
          <h1
            className="text-4xl md:text-5xl font-light tracking-widest"
            style={{ color: "var(--store-primary)" }}
          >
            {name}
          </h1>
          <div className="w-16 h-px mx-auto my-8" style={{ background: "var(--store-secondary)" }} />
          {desc && (
            <p className="text-gray-500 leading-relaxed mb-10">{desc}</p>
          )}
          <Link
            href={`/${subdomain}/products`}
            className="inline-flex items-center gap-2 border-2 px-10 py-3 text-sm tracking-widest uppercase font-medium hover:opacity-80 transition"
            style={{ borderColor: "var(--store-primary)", color: "var(--store-primary)" }}
          >
            اكتشف المجموعة
          </Link>
        </div>
      </section>
    );
  }

  if (theme === "fresh") {
    return (
      <section
        className="py-16 px-4 overflow-hidden"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in oklch, var(--store-primary), white 85%), color-mix(in oklch, var(--store-secondary), white 82%))",
        }}
      >
        <div className="max-w-5xl mx-auto grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h1
              className="text-4xl md:text-5xl font-bold mb-4"
              style={{ color: "var(--store-primary)" }}
            >
              {name}
            </h1>
            {desc && (
              <p className="text-gray-600 mb-8 leading-relaxed text-lg">{desc}</p>
            )}
            <Link
              href={`/${subdomain}/products`}
              className="inline-flex items-center gap-2 text-white px-8 py-3 rounded-full font-semibold hover:opacity-90 transition"
              style={{ background: "var(--store-primary)" }}
            >
              <ShoppingBag className="w-5 h-5" />
              تسوق الآن
            </Link>
          </div>
          <div className="hidden md:grid grid-cols-3 gap-3">
            {[80, 55, 90, 65, 75, 45].map((light, i) => (
              <div
                key={i}
                className="aspect-square rounded-2xl"
                style={{
                  background:
                    i % 2 === 0
                      ? `color-mix(in oklch, var(--store-primary), white ${light}%)`
                      : `color-mix(in oklch, var(--store-secondary), white ${light}%)`,
                }}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (theme === "dark") {
    return (
      <section
        className="py-24 px-4 relative overflow-hidden"
        style={{ background: "linear-gradient(135deg, #0f0f1a, #1a1040)" }}
      >
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse at 50% 0%, color-mix(in oklch, var(--store-primary), transparent 55%), transparent 70%)",
          }}
        />
        <div className="max-w-4xl mx-auto text-center relative">
          <h1
            className="text-4xl md:text-6xl font-bold text-white mb-4"
            style={{
              textShadow:
                "0 0 60px color-mix(in oklch, var(--store-primary), transparent 30%)",
            }}
          >
            {name}
          </h1>
          {desc && (
            <p className="text-gray-400 text-lg mb-10 leading-relaxed max-w-xl mx-auto">{desc}</p>
          )}
          <Link
            href={`/${subdomain}/products`}
            className="inline-flex items-center gap-2 px-8 py-3 rounded-lg font-semibold text-white hover:opacity-90 transition"
            style={{
              background: "var(--store-primary)",
              boxShadow:
                "0 0 30px color-mix(in oklch, var(--store-primary), transparent 45%)",
            }}
          >
            <ShoppingBag className="w-5 h-5" />
            تسوق الآن
          </Link>
        </div>
      </section>
    );
  }

  // Default
  return (
    <section
      className="py-20 px-4"
      style={{
        background:
          "linear-gradient(135deg, var(--store-primary), color-mix(in oklch, var(--store-primary), black 30%))",
      }}
    >
      <div className="max-w-4xl mx-auto text-center">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{name}</h1>
        {desc && (
          <p className="text-white/80 text-lg mb-8 leading-relaxed">{desc}</p>
        )}
        <Link
          href={`/${subdomain}/products`}
          className="inline-flex items-center gap-2 bg-white text-gray-900 font-semibold px-8 py-3 rounded-full hover:bg-gray-100 transition"
        >
          <ShoppingBag className="w-5 h-5" />
          تسوق الآن
        </Link>
      </div>
    </section>
  );
}

function ProductCard({ product, subdomain }: { product: Product; subdomain: string }) {
  const thumb = product.images?.[0]?.url;
  return (
    <Link href={`/${subdomain}/products/${product.slug}`} className="group bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition">
      <div className="aspect-square relative bg-gray-100">
        {thumb ? (
          <Image src={thumb} alt={product.nameAr || product.name} fill className="object-cover group-hover:scale-105 transition duration-300" />
        ) : (
          <div className="flex items-center justify-center h-full text-gray-300">
            <ShoppingBag className="w-12 h-12" />
          </div>
        )}
        {product.comparePrice && product.comparePrice > product.price && (
          <span className="absolute top-2 right-2 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
            تخفيض
          </span>
        )}
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
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 truncate">{product.nameAr || product.name}</p>
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
