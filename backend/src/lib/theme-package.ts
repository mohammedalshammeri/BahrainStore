import AdmZip from 'adm-zip'
import { z } from 'zod'

export const THEME_MANIFEST_ASSET_KEY = 'bazar.theme.json'
export const THEME_CHANGELOG_ASSET_KEYS = ['CHANGELOG.md', 'changelog.md'] as const

const pageTypeSchema = z.enum(['homepage', 'product', 'collection', 'page', 'cart', 'checkout', 'blog'])
const sectionTypeSchema = z.enum(['hero', 'banner', 'products_grid', 'categories', 'marquee', 'text', 'divider', 'product_detail', 'related_products', 'cart', 'checkout', 'page_content', 'collection_header', 'collection_products', 'blog_posts', 'blog_post_content'])
const blockTypeSchema = z.enum(['text', 'button', 'image', 'icon', 'video', 'audio'])

const themeBlockSchema = z.object({
  id: z.string(),
  type: blockTypeSchema,
  settings: z.record(z.string(), z.unknown()).default({}),
  layout: z.record(z.string(), z.unknown()).optional(),
}).strict()

const themeSectionSchema = z.object({
  id: z.string(),
  type: sectionTypeSchema,
  enabled: z.boolean().default(true),
  settings: z.record(z.string(), z.unknown()).default({}),
  layout: z.record(z.string(), z.unknown()).optional(),
  blocks: z.array(themeBlockSchema).default([]),
}).strict()

const pageTemplateSchema = z.object({
  pageType: pageTypeSchema,
  themeId: z.string().optional(),
  sections: z.array(themeSectionSchema).default([]),
}).strict()

const settingsSchemaFileSchema = z.union([
  z.array(z.record(z.string(), z.unknown())),
  z.record(z.string(), z.unknown()),
])

export const themePackageManifestSchema = z.object({
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  name: z.string().min(1),
  nameAr: z.string().min(1),
  description: z.string().optional(),
  descriptionAr: z.string().optional(),
  version: z.string().min(1).default('1.0.0'),
  price: z.number().min(0).default(0),
  tags: z.array(z.string()).default([]),
  previewUrl: z.string().url().optional(),
  thumbnailUrl: z.string().url().optional(),
  demoUrl: z.string().url().optional(),
}).strict()

export type ThemePackageManifest = z.infer<typeof themePackageManifestSchema>

export interface ThemePackageAsset {
  key: string
  content: string
  mimeType: string
}

export interface ParsedThemePackage {
  manifest: ThemePackageManifest
  assets: ThemePackageAsset[]
}

export interface ThemeMetadataAssetLike {
  key: string
  content: string | null
}

const supportedExtensions = new Set(['.json', '.css', '.js', '.md', '.txt'])

function normalizeEntryName(input: string) {
  return input.replace(/\\/g, '/').replace(/^\/+/, '')
}

function getExtension(entryName: string) {
  const dotIndex = entryName.lastIndexOf('.')
  return dotIndex >= 0 ? entryName.slice(dotIndex).toLowerCase() : ''
}

function getMimeType(entryName: string) {
  const extension = getExtension(entryName)
  if (extension === '.css') return 'text/css'
  if (extension === '.js') return 'application/javascript'
  if (extension === '.md') return 'text/markdown'
  if (extension === '.txt') return 'text/plain'
  return 'application/json'
}

function validateAssetContent(entryName: string, content: string) {
  if (entryName.startsWith('templates/') && entryName.endsWith('.json')) {
    const parsed = pageTemplateSchema.safeParse(JSON.parse(content))
    if (!parsed.success) {
      throw new Error(`Template file invalid: ${entryName}`)
    }
    return
  }

  if (entryName === 'config/settings_schema.json') {
    const parsed = settingsSchemaFileSchema.safeParse(JSON.parse(content))
    if (!parsed.success) {
      throw new Error('Theme settings schema is invalid')
    }
  }
}

export function parseThemePackageBuffer(buffer: Buffer): ParsedThemePackage {
  const zip = new AdmZip(buffer)
  const entries = zip.getEntries().filter((entry) => !entry.isDirectory)
  const manifestEntry = entries.find((entry) => normalizeEntryName(entry.entryName) === 'bazar.theme.json')

  if (!manifestEntry) {
    throw new Error('Theme package must include bazar.theme.json')
  }

  const manifest = themePackageManifestSchema.parse(JSON.parse(manifestEntry.getData().toString('utf8')))
  const assets: ThemePackageAsset[] = []

  for (const entry of entries) {
    const entryName = normalizeEntryName(entry.entryName)
    if (entryName === 'bazar.theme.json') continue

    const extension = getExtension(entryName)
    if (!supportedExtensions.has(extension)) {
      throw new Error(`Unsupported theme asset type: ${entryName}`)
    }

    const content = entry.getData().toString('utf8')
    if (!content.trim()) continue
    validateAssetContent(entryName, content)

    assets.push({
      key: entryName,
      content,
      mimeType: getMimeType(entryName),
    })
  }

  if (assets.length === 0) {
    throw new Error('Theme package does not contain any supported assets')
  }

  return { manifest, assets }
}

export function serializeThemeManifest(manifest: ThemePackageManifest) {
  return JSON.stringify(manifest, null, 2)
}

export function buildThemeManifestAsset(manifest: ThemePackageManifest): ThemePackageAsset {
  return {
    key: THEME_MANIFEST_ASSET_KEY,
    content: serializeThemeManifest(manifest),
    mimeType: 'application/json',
  }
}

export function resolveThemeManifestFromAssets(
  assets: ThemeMetadataAssetLike[],
  fallback: Omit<ThemePackageManifest, 'version'> & { version?: string },
) {
  const manifestAsset = assets.find((asset) => normalizeEntryName(asset.key) === THEME_MANIFEST_ASSET_KEY)
  if (manifestAsset?.content) {
    return themePackageManifestSchema.parse(JSON.parse(manifestAsset.content))
  }

  return themePackageManifestSchema.parse({
    slug: fallback.slug,
    name: fallback.name,
    nameAr: fallback.nameAr,
    description: fallback.description,
    descriptionAr: fallback.descriptionAr,
    version: fallback.version ?? '1.0.0',
    price: fallback.price,
    tags: fallback.tags,
    previewUrl: fallback.previewUrl,
    thumbnailUrl: fallback.thumbnailUrl,
    demoUrl: fallback.demoUrl,
  })
}

export function resolveThemeChangelogFromAssets(assets: ThemeMetadataAssetLike[]) {
  const changelogAsset = assets.find((asset) => THEME_CHANGELOG_ASSET_KEYS.includes(normalizeEntryName(asset.key) as (typeof THEME_CHANGELOG_ASSET_KEYS)[number]))
  return changelogAsset?.content?.trim() || null
}

export function buildThemePackageBuffer(input: {
  manifest: ThemePackageManifest
  assets: Array<{ key: string; content: string | null; mimeType?: string | null }>
}) {
  const zip = new AdmZip()
  zip.addFile('bazar.theme.json', Buffer.from(JSON.stringify(input.manifest, null, 2), 'utf8'))

  for (const asset of input.assets) {
    if (!asset.content) continue
    const normalizedKey = normalizeEntryName(asset.key)
    if (normalizedKey === THEME_MANIFEST_ASSET_KEY) continue
    zip.addFile(normalizedKey, Buffer.from(asset.content, 'utf8'))
  }

  return zip.toBuffer()
}