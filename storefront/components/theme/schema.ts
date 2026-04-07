import { z } from "zod";

export const BlockTypeSchema = z.enum(["text", "button", "image", "icon", "video", "audio"]);
export const PageTypeSchema = z.enum(["homepage", "product", "collection", "page", "cart", "checkout", "blog"]);
export const SectionTypeSchema = z.enum(["hero", "banner", "products_grid", "categories", "marquee", "text", "divider", "product_detail", "related_products", "cart", "checkout", "page_content", "collection_header", "collection_products", "blog_posts", "blog_post_content"]);

// Layout settings (spacing, background, container type)
export const LayoutSchema = z.object({
  container: z.enum(["full", "boxed", "fluid"]).default("boxed"),
  background: z.string().optional(),
  padding: z.object({
    top: z.string().optional(),
    bottom: z.string().optional()
  }).optional(),
  direction: z.enum(["row", "column"]).default("column"),
  gap: z.enum(["none", "xs", "sm", "md", "lg", "xl"]).default("md"),
  align: z.enum(["start", "center", "end", "stretch"]).default("stretch"),
  justify: z.enum(["start", "center", "end", "between", "around"]).default("start"),
}).strict();

// Theme Block Validation
export const ThemeBlockSchema = z.object({
  id: z.string().min(1),
  type: BlockTypeSchema,
  settings: z.record(z.string(), z.unknown()).default({}),
  layout: LayoutSchema.optional(),
}).strict();

// Theme Section Validation
export const ThemeSectionSchema = z.object({
  id: z.string().min(1),
  type: SectionTypeSchema,
  enabled: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).default({}),
  layout: LayoutSchema.optional(),
  blocks: z.array(ThemeBlockSchema).optional().default([]),
}).strict();

// Page Template Validation
export const PageTemplateSchema = z.object({
  pageType: PageTypeSchema,
  sections: z.array(ThemeSectionSchema).default([]),
  themeId: z.string().optional(),
}).strict();

export type ValidatedThemeLayout = z.infer<typeof LayoutSchema>;
export type ThemeBlockType = z.infer<typeof BlockTypeSchema>;
export type ThemePageType = z.infer<typeof PageTypeSchema>;
export type ThemeSectionType = z.infer<typeof SectionTypeSchema>;
export type ValidatedThemeSection = z.infer<typeof ThemeSectionSchema>;
export type ValidatedThemeBlock = z.infer<typeof ThemeBlockSchema>;
export type ValidatedPageTemplate = z.infer<typeof PageTemplateSchema>;