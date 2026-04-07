import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { BlockRenderer } from "../BlockRenderer";
import { SectionLayout } from "../SectionLayout";
import type { SectionProps } from "../types";

function getSetting(settings: Record<string, unknown>, ...keys: string[]) {
  for (const key of keys) {
    const value = settings[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return "";
}

export default function HeroSection({ section, globalData }: SectionProps) {
  const { store, subdomain } = globalData;
  const settings = section.settings as Record<string, unknown>;
  const configuredVariant = typeof globalData.themeSettings?.heroVariant === "string"
    ? globalData.themeSettings.heroVariant
    : typeof globalData.themeSettings?.themeVariant === "string"
      ? globalData.themeSettings.themeVariant
      : store.settings?.theme;
  const variant = getSetting(settings, "variant") || configuredVariant || "default";
  const name = getSetting(settings, "title", "titleAr") || store.nameAr || store.name;
  const desc = getSetting(settings, "subtitle", "subtitleAr") || store.descriptionAr || store.description || "";
  const ctaLabel = getSetting(settings, "ctaLabel", "buttonTextAr") || "تسوق الآن";
  const ctaHref = getSetting(settings, "ctaHref", "buttonLink") || `/${subdomain}/products`;

  const content = (
    <>
      {variant === "bold" && (
        <div className="max-w-5xl">
          <h1 className="text-5xl font-black leading-none tracking-tight text-white md:text-7xl">{name}</h1>
          <div className="my-5 h-1.5 w-24" style={{ background: "var(--store-secondary)" }} />
          {desc && <p className="mb-8 max-w-xl text-lg leading-relaxed text-white/75">{desc}</p>}
          <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-lg px-8 py-4 text-lg font-bold text-white transition hover:opacity-90" style={{ background: "var(--store-secondary)" }}>
            <ShoppingBag className="h-6 w-6" />
            {ctaLabel}
          </Link>
        </div>
      )}

      {variant === "elegant" && (
        <div className="mx-auto max-w-2xl text-center">
          <div className="mx-auto mb-8 h-px w-16" style={{ background: "var(--store-primary)" }} />
          <h1 className="text-4xl font-light tracking-widest md:text-5xl" style={{ color: "var(--store-primary)" }}>{name}</h1>
          <div className="mx-auto my-8 h-px w-16" style={{ background: "var(--store-secondary)" }} />
          {desc && <p className="mb-10 leading-relaxed text-gray-500">{desc}</p>}
          <Link href={ctaHref} className="inline-flex items-center gap-2 border-2 px-10 py-3 text-sm font-medium uppercase tracking-widest transition hover:opacity-80" style={{ borderColor: "var(--store-primary)", color: "var(--store-primary)" }}>
            {ctaLabel}
          </Link>
        </div>
      )}

      {variant === "fresh" && (
        <div className="grid max-w-5xl items-center gap-8 md:grid-cols-2">
          <div>
            <h1 className="mb-4 text-4xl font-bold md:text-5xl" style={{ color: "var(--store-primary)" }}>{name}</h1>
            {desc && <p className="mb-8 text-lg leading-relaxed text-gray-600">{desc}</p>}
            <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white transition hover:opacity-90" style={{ background: "var(--store-primary)" }}>
              <ShoppingBag className="h-5 w-5" />
              {ctaLabel}
            </Link>
          </div>
          <div className="hidden grid-cols-3 gap-3 md:grid">
            {[80, 55, 90, 65, 75, 45].map((light, index) => (
              <div
                key={index}
                className="aspect-square rounded-2xl"
                style={{
                  background: index % 2 === 0
                    ? `color-mix(in oklch, var(--store-primary), white ${light}%)`
                    : `color-mix(in oklch, var(--store-secondary), white ${light}%)`,
                }}
              />
            ))}
          </div>
        </div>
      )}

      {variant === "dark" && (
        <div className="relative mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-6xl" style={{ textShadow: "0 0 60px color-mix(in oklch, var(--store-primary), transparent 30%)" }}>{name}</h1>
          {desc && <p className="mx-auto mb-10 max-w-xl text-lg leading-relaxed text-gray-400">{desc}</p>}
          <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-lg px-8 py-3 font-semibold text-white transition hover:opacity-90" style={{ background: "var(--store-primary)", boxShadow: "0 0 30px color-mix(in oklch, var(--store-primary), transparent 45%)" }}>
            <ShoppingBag className="h-5 w-5" />
            {ctaLabel}
          </Link>
        </div>
      )}

      {!["bold", "elegant", "fresh", "dark"].includes(variant) && (
        <div className="mx-auto max-w-4xl text-center">
          <h1 className="mb-4 text-4xl font-bold text-white md:text-5xl">{name}</h1>
          {desc && <p className="mb-8 text-lg leading-relaxed text-white/80">{desc}</p>}
          <Link href={ctaHref} className="inline-flex items-center gap-2 rounded-full bg-white px-8 py-3 font-semibold text-gray-900 transition hover:bg-gray-100">
            <ShoppingBag className="h-5 w-5" />
            {ctaLabel}
          </Link>
        </div>
      )}

      {section.blocks.length > 0 && (
        <div className="mt-8 w-full">
          <BlockRenderer blocks={section.blocks} globalData={globalData} context="hero" layout={{ align: "center" }} />
        </div>
      )}
    </>
  );

  const heroClassName = variant === "dark"
    ? "py-24 px-4 relative overflow-hidden"
    : variant === "fresh"
      ? "py-16 px-4 overflow-hidden"
      : variant === "elegant"
        ? "py-28 px-4"
        : "py-20 px-4";

  const heroStyle = variant === "bold"
    ? { background: "var(--store-primary)" }
    : variant === "elegant"
      ? { background: "linear-gradient(to bottom, color-mix(in oklch, var(--store-primary), white 93%), white)" }
      : variant === "fresh"
        ? { background: "linear-gradient(135deg, color-mix(in oklch, var(--store-primary), white 85%), color-mix(in oklch, var(--store-secondary), white 82%))" }
        : variant === "dark"
          ? { background: "linear-gradient(135deg, #0f0f1a, #1a1040)" }
          : { background: "linear-gradient(135deg, var(--store-primary), color-mix(in oklch, var(--store-primary), black 30%))" };

  return (
    <SectionLayout section={section} className={heroClassName}>
      <div className="w-full rounded-[2rem] px-4 py-8" style={heroStyle}>{content}</div>
    </SectionLayout>
  );
}