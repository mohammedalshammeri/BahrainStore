import type { ValidatedThemeBlock } from "./schema";
import type { ThemeGlobalData } from "./types";

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function asBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

export function transformBlockProps(block: ValidatedThemeBlock, globalData: ThemeGlobalData) {
  const settings = block.settings as Record<string, unknown>;
  const storeName = globalData.store.nameAr || globalData.store.name;

  if (block.type === "text") {
    return {
      content: asString(settings.content, asString(settings.text, "")),
      align: asString(settings.align, "start"),
      tone: asString(settings.tone, "default"),
      html: asBoolean(settings.html, false),
      storeName,
    };
  }

  if (block.type === "button") {
    const rawHref = asString(settings.href, asString(settings.link, "/products"));
    const href = rawHref.startsWith("/") ? `/${globalData.subdomain}${rawHref}` : rawHref;

    return {
      label: asString(settings.label, asString(settings.text, "استعرض الآن")),
      href,
      variant: asString(settings.variant, "primary"),
      target: asString(settings.target, "_self"),
      fullWidth: asBoolean(settings.fullWidth, false),
    };
  }

  if (block.type === "image") {
    return {
      src: asString(settings.src, asString(settings.imageUrl, "")),
      alt: asString(settings.alt, storeName),
      width: asString(settings.width, "100%"),
      height: asString(settings.height, "auto"),
      objectFit: asString(settings.objectFit, "cover"),
      href: asString(settings.href, ""),
    };
  }

  if (block.type === "icon") {
    return {
      icon: asString(settings.icon, "star"),
      title: asString(settings.title, asString(settings.titleAr, "ميزة")),
      description: asString(settings.description, asString(settings.descriptionAr, "")),
      href: asString(settings.href, ""),
      align: asString(settings.align, "center"),
      tone: asString(settings.tone, "primary"),
    };
  }

  if (block.type === "video") {
    return {
      src: asString(settings.src, asString(settings.url, "")),
      title: asString(settings.title, storeName),
      aspectRatio: asString(settings.aspectRatio, "16 / 9"),
      mode: asString(settings.mode, "embed"),
      autoPlay: asBoolean(settings.autoPlay, false),
      muted: asBoolean(settings.muted, false),
      controls: asBoolean(settings.controls, true),
    };
  }

  if (block.type === "audio") {
    return {
      src: asString(settings.src, asString(settings.url, "")),
      title: asString(settings.title, storeName),
      description: asString(settings.description, ""),
      autoPlay: asBoolean(settings.autoPlay, false),
      loop: asBoolean(settings.loop, false),
    };
  }

  return { ...settings };
}