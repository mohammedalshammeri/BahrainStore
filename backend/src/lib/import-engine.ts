import fs from 'node:fs/promises'
import path from 'node:path'
import { parse as parseCsv } from 'csv-parse/sync'
import * as XLSX from 'xlsx'
import { prisma } from './prisma'

const PREVIEW_ROW_LIMIT = 1000
const ARTIFACT_DIR = path.join(process.cwd(), 'tmp', 'import-previews')

const canonicalFieldSynonyms: Record<CanonicalField, string[]> = {
  title: ['title', 'name', 'product name', 'product_title', 'item name', 'اسم المنتج', 'الاسم'],
  description: ['description', 'body', 'details', 'product description', 'الوصف', 'تفاصيل'],
  sku: ['sku', 'product sku', 'variant sku', 'رمز المنتج', 'sku code'],
  price: ['price', 'regular price', 'selling price', 'السعر', 'price bhd'],
  comparePrice: ['compare price', 'old price', 'sale compare price', 'before price', 'السعر قبل الخصم'],
  stock: ['stock', 'inventory', 'quantity', 'qty', 'المخزون', 'الكمية'],
  category: ['category', 'collection', 'product type', 'classification', 'التصنيف', 'الفئة'],
  imageUrl: ['image', 'image url', 'images', 'featured image', 'photo', 'الصورة', 'رابط الصورة'],
  variantGroup: ['parent', 'parent sku', 'group', 'variant group', 'product group', 'المجموعة'],
  variantName: ['variant', 'variant name', 'option combination', 'اسم المتغير'],
  option1Name: ['option1 name', 'option 1 name', 'attribute1 name', 'اسم الخيار 1'],
  option1Value: ['option1 value', 'option 1 value', 'attribute1 value', 'الخيار 1'],
  option2Name: ['option2 name', 'option 2 name', 'attribute2 name', 'اسم الخيار 2'],
  option2Value: ['option2 value', 'option 2 value', 'attribute2 value', 'الخيار 2'],
  status: ['status', 'published', 'active', 'حالة', 'منشور'],
  seoTitle: ['seo title', 'meta title', 'عنوان السيو'],
  seoDescription: ['seo description', 'meta description', 'وصف السيو'],
  barcode: ['barcode', 'bar code', 'الباركود'],
  weight: ['weight', 'shipping weight', 'الوزن'],
  tags: ['tags', 'labels', 'وسوم'],
  brand: ['brand', 'vendor', 'manufacturer', 'العلامة', 'الماركة'],
}

export type CanonicalField =
  | 'title'
  | 'description'
  | 'sku'
  | 'price'
  | 'comparePrice'
  | 'stock'
  | 'category'
  | 'imageUrl'
  | 'variantGroup'
  | 'variantName'
  | 'option1Name'
  | 'option1Value'
  | 'option2Name'
  | 'option2Value'
  | 'status'
  | 'seoTitle'
  | 'seoDescription'
  | 'barcode'
  | 'weight'
  | 'tags'
  | 'brand'

export type FileKind = 'CSV' | 'XLSX'

export interface ImportIssue {
  field: string
  severity: 'warning' | 'blocked'
  message: string
}

export interface ImportMappingField {
  field: CanonicalField
  header: string | null
  confidence: number
  source: 'heuristic' | 'ai' | 'combined'
}

export interface ImportNormalizedRow {
  title: string
  description?: string
  sku?: string
  price: number | null
  comparePrice?: number | null
  stock: number
  category?: string
  imageUrls: string[]
  variantGroup?: string
  variantName?: string
  option1Name?: string
  option1Value?: string
  option2Name?: string
  option2Value?: string
  status: 'active' | 'draft'
  seoTitle?: string
  seoDescription?: string
  barcode?: string
  weight?: number | null
  tags: string[]
  brand?: string
}

export interface ImportPreviewRow {
  index: number
  raw: Record<string, string>
  normalized: ImportNormalizedRow
  issues: ImportIssue[]
  severity: 'valid' | 'warning' | 'blocked'
}

export interface ImportPreviewArtifact {
  fileName: string
  fileKind: FileKind
  headers: string[]
  mapping: ImportMappingField[]
  rows: ImportPreviewRow[]
  summary: {
    totalRows: number
    validRows: number
    warningRows: number
    blockedRows: number
    duplicateSkuCount: number
    missingImageCount: number
    variantRowCount: number
    createdAt: string
  }
  warnings: string[]
}

export interface ImportExecutionReport {
  importedProducts: number
  updatedProducts: number
  importedVariants: number
  createdCategories: number
  skippedRows: number
  issues: string[]
  completedAt: string
}

export interface ImportRemediationAction {
  key: string
  priority: 'critical' | 'high' | 'medium'
  label: string
  reason: string
  cta: string
  count?: number
}

export interface ImportRemediationRow {
  rowIndex: number
  severity: 'blocked' | 'warning'
  title: string
  sku?: string
  issues: string[]
  suggestedAction: string
}

export interface ImportRemediationReport {
  summary: {
    blockedRows: number
    warningRows: number
    skippedRows: number
    missingImageCount: number
    duplicateSkuCount: number
  }
  actions: ImportRemediationAction[]
  queue: ImportRemediationRow[]
}

function normalizeHeader(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[_\-]+/g, ' ')
    .replace(/\s+/g, ' ')
}

function slugify(value: string) {
  const base = value
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\u0600-\u06ff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  return base || 'imported-product'
}

function parseNumber(value: string | undefined) {
  if (!value) return null
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return null
  const parsed = Number(normalized)
  return Number.isFinite(parsed) ? parsed : null
}

function parseInteger(value: string | undefined) {
  if (!value) return 0
  const normalized = value.replace(/,/g, '').trim()
  if (!normalized) return 0
  const parsed = Number.parseInt(normalized, 10)
  return Number.isFinite(parsed) ? parsed : 0
}

function splitMultiValue(value: string | undefined) {
  if (!value) return []
  return value
    .split(/[\n,|]+/)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeStatus(value: string | undefined): 'active' | 'draft' {
  const normalized = (value || '').trim().toLowerCase()
  if (['draft', 'inactive', 'false', '0', 'disabled', 'hidden'].includes(normalized)) return 'draft'
  return 'active'
}

function scoreHeaderMatch(header: string, field: CanonicalField) {
  const normalizedHeader = normalizeHeader(header)
  const synonyms = canonicalFieldSynonyms[field]
  if (synonyms.some((entry) => normalizeHeader(entry) === normalizedHeader)) return 1
  if (synonyms.some((entry) => normalizedHeader.includes(normalizeHeader(entry)))) return 0.82
  if (synonyms.some((entry) => normalizeHeader(entry).includes(normalizedHeader))) return 0.68
  return 0
}

export function inferImportMapping(headers: string[], aiSuggestedMapping?: Partial<Record<CanonicalField, string>>) {
  const assignedHeaders = new Set<string>()
  const mapping: ImportMappingField[] = []

  for (const field of Object.keys(canonicalFieldSynonyms) as CanonicalField[]) {
    const aiHeader = aiSuggestedMapping?.[field]
    const aiCandidate = aiHeader && headers.find((header) => normalizeHeader(header) === normalizeHeader(aiHeader))
    const heuristicCandidate = headers
      .map((header) => ({ header, score: scoreHeaderMatch(header, field) }))
      .sort((left, right) => right.score - left.score)
      .find((candidate) => candidate.score > 0 && !assignedHeaders.has(candidate.header))

    const header = aiCandidate || heuristicCandidate?.header || null
    if (header) assignedHeaders.add(header)

    const heuristicScore = heuristicCandidate?.header === header ? heuristicCandidate.score : 0
    const confidence = header
      ? Math.max(aiCandidate ? 0.9 : 0, heuristicScore)
      : 0

    mapping.push({
      field,
      header,
      confidence,
      source: aiCandidate && heuristicCandidate?.header === aiCandidate ? 'combined' : aiCandidate ? 'ai' : 'heuristic',
    })
  }

  return mapping
}

function valueFromMapping(row: Record<string, string>, mapping: ImportMappingField[], field: CanonicalField) {
  const entry = mapping.find((candidate) => candidate.field === field)
  if (!entry?.header) return undefined
  return row[entry.header]
}

function buildNormalizedRow(index: number, row: Record<string, string>, mapping: ImportMappingField[], duplicateSkus: Set<string>) {
  const normalized: ImportNormalizedRow = {
    title: (valueFromMapping(row, mapping, 'title') || '').trim(),
    description: valueFromMapping(row, mapping, 'description')?.trim() || undefined,
    sku: valueFromMapping(row, mapping, 'sku')?.trim() || undefined,
    price: parseNumber(valueFromMapping(row, mapping, 'price')),
    comparePrice: parseNumber(valueFromMapping(row, mapping, 'comparePrice')),
    stock: parseInteger(valueFromMapping(row, mapping, 'stock')),
    category: valueFromMapping(row, mapping, 'category')?.trim() || undefined,
    imageUrls: splitMultiValue(valueFromMapping(row, mapping, 'imageUrl')),
    variantGroup: valueFromMapping(row, mapping, 'variantGroup')?.trim() || undefined,
    variantName: valueFromMapping(row, mapping, 'variantName')?.trim() || undefined,
    option1Name: valueFromMapping(row, mapping, 'option1Name')?.trim() || undefined,
    option1Value: valueFromMapping(row, mapping, 'option1Value')?.trim() || undefined,
    option2Name: valueFromMapping(row, mapping, 'option2Name')?.trim() || undefined,
    option2Value: valueFromMapping(row, mapping, 'option2Value')?.trim() || undefined,
    status: normalizeStatus(valueFromMapping(row, mapping, 'status')),
    seoTitle: valueFromMapping(row, mapping, 'seoTitle')?.trim() || undefined,
    seoDescription: valueFromMapping(row, mapping, 'seoDescription')?.trim() || undefined,
    barcode: valueFromMapping(row, mapping, 'barcode')?.trim() || undefined,
    weight: parseNumber(valueFromMapping(row, mapping, 'weight')),
    tags: splitMultiValue(valueFromMapping(row, mapping, 'tags')),
    brand: valueFromMapping(row, mapping, 'brand')?.trim() || undefined,
  }

  const issues: ImportIssue[] = []
  if (!normalized.title) {
    issues.push({ field: 'title', severity: 'blocked', message: 'اسم المنتج مفقود' })
  }
  if (normalized.price === null || normalized.price < 0) {
    issues.push({ field: 'price', severity: 'blocked', message: 'السعر غير صالح' })
  }
  if (normalized.stock < 0) {
    issues.push({ field: 'stock', severity: 'blocked', message: 'المخزون لا يمكن أن يكون سالباً' })
  }
  if (!normalized.imageUrls.length) {
    issues.push({ field: 'imageUrl', severity: 'warning', message: 'لا توجد صورة لهذا الصف' })
  }
  if (normalized.sku && duplicateSkus.has(normalized.sku.toLowerCase())) {
    issues.push({ field: 'sku', severity: 'warning', message: 'SKU مكرر داخل الملف، تحقق من أنه يمثل متغيرات فعلية' })
  }
  if (normalized.comparePrice !== null && normalized.comparePrice !== undefined && normalized.price !== null && normalized.comparePrice < normalized.price) {
    issues.push({ field: 'comparePrice', severity: 'warning', message: 'سعر المقارنة أقل من السعر الحالي' })
  }

  const blocked = issues.some((issue) => issue.severity === 'blocked')
  const warning = issues.some((issue) => issue.severity === 'warning')

  return {
    index,
    raw: row,
    normalized,
    issues,
    severity: blocked ? 'blocked' : warning ? 'warning' : 'valid',
  } satisfies ImportPreviewRow
}

export function buildImportPreview(records: Array<Record<string, string>>, fileName: string, fileKind: FileKind, aiSuggestedMapping?: Partial<Record<CanonicalField, string>>) {
  const trimmedRecords = records.slice(0, PREVIEW_ROW_LIMIT)
  const headers = Array.from(
    new Set(trimmedRecords.flatMap((record) => Object.keys(record).map((header) => header.trim()).filter(Boolean)))
  )
  const mapping = inferImportMapping(headers, aiSuggestedMapping)
  const duplicateSkuCounts = new Map<string, number>()
  for (const record of trimmedRecords) {
    const sku = valueFromMapping(record, mapping, 'sku')?.trim().toLowerCase()
    if (!sku) continue
    duplicateSkuCounts.set(sku, (duplicateSkuCounts.get(sku) || 0) + 1)
  }

  const duplicateSkus = new Set(Array.from(duplicateSkuCounts.entries()).filter(([, count]) => count > 1).map(([sku]) => sku))
  const rows = trimmedRecords.map((record, index) => buildNormalizedRow(index + 1, record, mapping, duplicateSkus))
  const validRows = rows.filter((row) => row.severity === 'valid').length
  const warningRows = rows.filter((row) => row.severity === 'warning').length
  const blockedRows = rows.filter((row) => row.severity === 'blocked').length
  const missingImageCount = rows.filter((row) => row.issues.some((issue) => issue.field === 'imageUrl')).length
  const variantRowCount = rows.filter((row) => row.normalized.option1Value || row.normalized.option2Value || row.normalized.variantName).length

  const warnings: string[] = []
  if (records.length > PREVIEW_ROW_LIMIT) {
    warnings.push(`تمت معالجة أول ${PREVIEW_ROW_LIMIT} صف فقط من الملف الحالي. جزّئ الملف إذا كان أكبر من ذلك.`)
  }
  if (!mapping.find((entry) => entry.field === 'title' && entry.header)) {
    warnings.push('تعذر اكتشاف عمود اسم المنتج تلقائياً، وستحتاج إلى مراجعة الملف قبل التنفيذ.')
  }
  if (!mapping.find((entry) => entry.field === 'price' && entry.header)) {
    warnings.push('تعذر اكتشاف عمود السعر تلقائياً، ولن يمكن تنفيذ الصفوف حتى يُصحح الملف.')
  }
  if (duplicateSkus.size > 0) {
    warnings.push(`يوجد ${duplicateSkus.size} SKU مكرر داخل الملف ويحتاج إلى مراجعة قبل اعتماد النتائج.`)
  }

  return {
    fileName,
    fileKind,
    headers,
    mapping,
    rows,
    summary: {
      totalRows: rows.length,
      validRows,
      warningRows,
      blockedRows,
      duplicateSkuCount: duplicateSkus.size,
      missingImageCount,
      variantRowCount,
      createdAt: new Date().toISOString(),
    },
    warnings,
  } satisfies ImportPreviewArtifact
}

export async function parseImportBuffer(buffer: Buffer, fileName: string) {
  const extension = path.extname(fileName).toLowerCase()
  if (extension === '.csv' || extension === '.txt') {
    const rows = parseCsv(buffer, {
      columns: true,
      skip_empty_lines: true,
      bom: true,
      trim: true,
      relax_column_count: true,
    }) as Array<Record<string, string>>

    return {
      fileKind: 'CSV' as FileKind,
      records: rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key), String(value ?? '')]))),
    }
  }

  if (extension === '.xlsx' || extension === '.xls') {
    const workbook = XLSX.read(buffer, { type: 'buffer' })
    const firstSheet = workbook.SheetNames[0]
    if (!firstSheet) {
      throw new Error('ملف Excel لا يحتوي أي ورقة عمل قابلة للقراءة')
    }

    const records = XLSX.utils.sheet_to_json<Record<string, unknown>>(workbook.Sheets[firstSheet], { defval: '', raw: false })
      .map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [String(key), String(value ?? '')])))

    return { fileKind: 'XLSX' as FileKind, records }
  }

  throw new Error('نوع الملف غير مدعوم. استخدم CSV أو XLSX فقط.')
}

export async function persistImportArtifact(jobId: string, artifact: ImportPreviewArtifact) {
  await fs.mkdir(ARTIFACT_DIR, { recursive: true })
  const filePath = path.join(ARTIFACT_DIR, `${jobId}.json`)
  await fs.writeFile(filePath, JSON.stringify(artifact, null, 2), 'utf8')
  return filePath
}

export async function readImportArtifact(jobId: string) {
  const filePath = path.join(ARTIFACT_DIR, `${jobId}.json`)
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw) as ImportPreviewArtifact
}

async function resolveUniqueSlug(storeId: string, base: string, currentProductId?: string) {
  let candidate = slugify(base)
  let counter = 1

  while (true) {
    const existing = await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug: candidate } } })
    if (!existing || existing.id === currentProductId) return candidate
    counter += 1
    candidate = `${slugify(base)}-${counter}`
  }
}

async function ensureCategory(storeId: string, categoryName: string | undefined, counters: { createdCategories: number }, categoryCache: Map<string, string>) {
  if (!categoryName) return null
  const normalizedName = categoryName.split(/[>/]+/).map((entry) => entry.trim()).filter(Boolean).pop()
  if (!normalizedName) return null

  const cacheKey = normalizedName.toLowerCase()
  const cached = categoryCache.get(cacheKey)
  if (cached) return cached

  const existing = await prisma.category.findFirst({ where: { storeId, OR: [{ name: normalizedName }, { nameAr: normalizedName }] } })
  if (existing) {
    categoryCache.set(cacheKey, existing.id)
    return existing.id
  }

  const category = await prisma.category.create({
    data: {
      storeId,
      name: normalizedName,
      nameAr: normalizedName,
      slug: await (async () => {
        let candidate = slugify(normalizedName)
        let counter = 1
        while (await prisma.category.findFirst({ where: { storeId, slug: candidate } })) {
          counter += 1
          candidate = `${slugify(normalizedName)}-${counter}`
        }
        return candidate
      })(),
    },
  })
  counters.createdCategories += 1
  categoryCache.set(cacheKey, category.id)
  return category.id
}

async function upsertSimpleProduct(storeId: string, row: ImportPreviewRow, counters: ImportExecutionReport, categoryCache: Map<string, string>) {
  const categoryId = await ensureCategory(storeId, row.normalized.category, counters, categoryCache)
  const baseSlug = await resolveUniqueSlug(storeId, row.normalized.title)
  const existing = row.normalized.sku
    ? await prisma.product.findFirst({ where: { storeId, sku: row.normalized.sku } })
    : await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug: baseSlug } } })

  const payload = {
    storeId,
    categoryId,
    name: row.normalized.title,
    nameAr: row.normalized.title,
    slug: existing ? existing.slug : baseSlug,
    description: row.normalized.description,
    descriptionAr: row.normalized.description,
    sku: row.normalized.sku,
    barcode: row.normalized.barcode,
    price: row.normalized.price ?? 0,
    comparePrice: row.normalized.comparePrice ?? undefined,
    stock: row.normalized.stock,
    weight: row.normalized.weight ?? undefined,
    isActive: row.normalized.status === 'active',
    seoTitle: row.normalized.seoTitle,
    seoDescription: row.normalized.seoDescription,
  }

  const product = existing
    ? await prisma.product.update({ where: { id: existing.id }, data: payload })
    : await prisma.product.create({ data: payload })

  if (existing) {
    counters.updatedProducts += 1
    await prisma.productVariant.deleteMany({ where: { productId: product.id } })
    await prisma.productOption.deleteMany({ where: { productId: product.id } })
    await prisma.productImage.deleteMany({ where: { productId: product.id } })
  } else {
    counters.importedProducts += 1
  }

  if (row.normalized.imageUrls.length > 0) {
    await prisma.productImage.createMany({
      data: row.normalized.imageUrls.map((url, index) => ({ productId: product.id, url, sortOrder: index })),
    })
  }
}

async function upsertVariantProduct(storeId: string, groupRows: ImportPreviewRow[], counters: ImportExecutionReport, categoryCache: Map<string, string>) {
  const first = groupRows[0]
  const title = first.normalized.variantGroup || first.normalized.title
  const categoryId = await ensureCategory(storeId, first.normalized.category, counters, categoryCache)
  const prices = groupRows.map((row) => row.normalized.price ?? 0).filter((price) => price >= 0)
  const basePrice = prices.length > 0 ? Math.min(...prices) : 0
  const baseSlug = await resolveUniqueSlug(storeId, title)
  const existing = await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug: baseSlug } } })
  const product = existing
    ? await prisma.product.update({
        where: { id: existing.id },
        data: {
          storeId,
          categoryId,
          name: title,
          nameAr: title,
          description: first.normalized.description,
          descriptionAr: first.normalized.description,
          price: basePrice,
          stock: groupRows.reduce((sum, row) => sum + row.normalized.stock, 0),
          isActive: groupRows.some((row) => row.normalized.status === 'active'),
          seoTitle: first.normalized.seoTitle,
          seoDescription: first.normalized.seoDescription,
        },
      })
    : await prisma.product.create({
        data: {
          storeId,
          categoryId,
          name: title,
          nameAr: title,
          slug: baseSlug,
          description: first.normalized.description,
          descriptionAr: first.normalized.description,
          price: basePrice,
          stock: groupRows.reduce((sum, row) => sum + row.normalized.stock, 0),
          isActive: groupRows.some((row) => row.normalized.status === 'active'),
          seoTitle: first.normalized.seoTitle,
          seoDescription: first.normalized.seoDescription,
        },
      })

  if (existing) {
    counters.updatedProducts += 1
    await prisma.productVariant.deleteMany({ where: { productId: product.id } })
    await prisma.productOption.deleteMany({ where: { productId: product.id } })
    await prisma.productImage.deleteMany({ where: { productId: product.id } })
  } else {
    counters.importedProducts += 1
  }

  const firstImageUrls = Array.from(new Set(groupRows.flatMap((row) => row.normalized.imageUrls))).slice(0, 8)
  if (firstImageUrls.length > 0) {
    await prisma.productImage.createMany({
      data: firstImageUrls.map((url, index) => ({ productId: product.id, url, sortOrder: index })),
    })
  }

  const optionConfigs = [
    {
      name: groupRows.find((row) => row.normalized.option1Name)?.normalized.option1Name,
      values: Array.from(new Set(groupRows.map((row) => row.normalized.option1Value).filter(Boolean) as string[])),
    },
    {
      name: groupRows.find((row) => row.normalized.option2Name)?.normalized.option2Name,
      values: Array.from(new Set(groupRows.map((row) => row.normalized.option2Value).filter(Boolean) as string[])),
    },
  ].filter((option) => option.name && option.values.length > 0)

  const optionValueIds = new Map<string, string>()
  for (const [index, option] of optionConfigs.entries()) {
    const createdOption = await prisma.productOption.create({
      data: {
        productId: product.id,
        name: option.name!,
        nameAr: option.name!,
        sortOrder: index,
      },
    })

    for (const [valueIndex, value] of option.values.entries()) {
      const createdValue = await prisma.optionValue.create({
        data: {
          optionId: createdOption.id,
          value,
          valueAr: value,
          sortOrder: valueIndex,
        },
      })
      optionValueIds.set(`${createdOption.name}:${value}`.toLowerCase(), createdValue.id)
    }
  }

  for (const row of groupRows) {
    const variantOptionLinks: Array<{ optionValueId: string }> = []
    if (row.normalized.option1Name && row.normalized.option1Value) {
      const optionValueId = optionValueIds.get(`${row.normalized.option1Name}:${row.normalized.option1Value}`.toLowerCase())
      if (optionValueId) variantOptionLinks.push({ optionValueId })
    }
    if (row.normalized.option2Name && row.normalized.option2Value) {
      const optionValueId = optionValueIds.get(`${row.normalized.option2Name}:${row.normalized.option2Value}`.toLowerCase())
      if (optionValueId) variantOptionLinks.push({ optionValueId })
    }

    await prisma.productVariant.create({
      data: {
        productId: product.id,
        name: row.normalized.variantName || [row.normalized.option1Value, row.normalized.option2Value].filter(Boolean).join(' / ') || row.normalized.title,
        nameAr: row.normalized.variantName || [row.normalized.option1Value, row.normalized.option2Value].filter(Boolean).join(' / ') || row.normalized.title,
        sku: row.normalized.sku,
        barcode: row.normalized.barcode,
        price: row.normalized.price ?? basePrice,
        comparePrice: row.normalized.comparePrice ?? undefined,
        stock: row.normalized.stock,
        image: row.normalized.imageUrls[0],
        isActive: row.normalized.status === 'active',
        optionValues: variantOptionLinks.length > 0 ? { create: variantOptionLinks } : undefined,
      },
    })
    counters.importedVariants += 1
  }
}

export async function executePreviewImport(storeId: string, artifact: ImportPreviewArtifact) {
  const report: ImportExecutionReport = {
    importedProducts: 0,
    updatedProducts: 0,
    importedVariants: 0,
    createdCategories: 0,
    skippedRows: 0,
    issues: [],
    completedAt: new Date().toISOString(),
  }

  const categoryCache = new Map<string, string>()
  const executableRows = artifact.rows.filter((row) => row.severity !== 'blocked')
  const grouped = new Map<string, ImportPreviewRow[]>()

  for (const row of executableRows) {
    const groupingKey = row.normalized.variantGroup || row.normalized.title
    if (!grouped.has(groupingKey)) grouped.set(groupingKey, [])
    grouped.get(groupingKey)!.push(row)
  }

  for (const [, groupRows] of grouped.entries()) {
    try {
      const hasVariants = groupRows.length > 1 || groupRows.some((row) => row.normalized.option1Value || row.normalized.option2Value || row.normalized.variantName)
      if (hasVariants) {
        await upsertVariantProduct(storeId, groupRows, report, categoryCache)
      } else {
        await upsertSimpleProduct(storeId, groupRows[0], report, categoryCache)
      }
    } catch (error) {
      report.skippedRows += groupRows.length
      report.issues.push(error instanceof Error ? error.message : 'تعذر استيراد مجموعة من الصفوف')
    }
  }

  report.completedAt = new Date().toISOString()
  return report
}

export function buildImportRemediationReport(artifact: ImportPreviewArtifact, report?: ImportExecutionReport | null) {
  const actions: ImportRemediationAction[] = []

  if (artifact.summary.blockedRows > 0) {
    actions.push({
      key: 'fix-blocked-rows',
      priority: 'critical',
      label: 'تصحيح الصفوف المحجوبة',
      reason: 'هذه الصفوف لم تكن قابلة للتنفيذ بسبب نقص اسم المنتج أو السعر أو وجود قيم غير صالحة.',
      cta: 'راجع الملف أو افتح المنتجات المتأثرة وصحح القيم الأساسية.',
      count: artifact.summary.blockedRows,
    })
  }

  if (artifact.summary.missingImageCount > 0) {
    actions.push({
      key: 'add-images',
      priority: 'high',
      label: 'إكمال الصور الناقصة',
      reason: 'الصور الناقصة تقلل من جودة العرض ومعدل التحويل، حتى لو نجح الاستيراد.',
      cta: 'أضف صور المنتجات الناقصة من شاشة المنتجات أو أعد رفع الملف بعد استكمال الروابط.',
      count: artifact.summary.missingImageCount,
    })
  }

  if (artifact.summary.duplicateSkuCount > 0) {
    actions.push({
      key: 'review-duplicate-skus',
      priority: 'high',
      label: 'مراجعة SKU المكرر',
      reason: 'التكرار قد يعني منتجات مكررة أو متغيرات غير مجمعة بالشكل الصحيح.',
      cta: 'راجع منطق المتغيرات أو وحّد SKU قبل إعادة التنفيذ التالية.',
      count: artifact.summary.duplicateSkuCount,
    })
  }

  if ((report?.skippedRows || 0) > 0) {
    actions.push({
      key: 'retry-skipped-groups',
      priority: 'medium',
      label: 'إعادة محاولة المجموعات المتجاوزة',
      reason: 'حدث فشل أثناء إدخال بعض المجموعات رغم مرورها من preview.',
      cta: 'راجع التقرير وأعد المحاولة بعد تصحيح المشاكل التشغيلية أو تعارضات البيانات.',
      count: report?.skippedRows || 0,
    })
  }

  const queue = artifact.rows
    .filter((row) => row.severity !== 'valid')
    .slice(0, 50)
    .map<ImportRemediationRow>((row) => ({
      rowIndex: row.index,
      severity: row.severity === 'blocked' ? 'blocked' : 'warning',
      title: row.normalized.title || 'بدون اسم منتج',
      sku: row.normalized.sku,
      issues: row.issues.map((issue) => issue.message),
      suggestedAction:
        row.severity === 'blocked'
          ? 'صحح الحقول الأساسية ثم أعد المعاينة قبل التنفيذ.'
          : 'راجع هذا الصف بعد الاستيراد أو حسّن الملف المصدر لتقليل التنبيهات.',
    }))

  return {
    summary: {
      blockedRows: artifact.summary.blockedRows,
      warningRows: artifact.summary.warningRows,
      skippedRows: report?.skippedRows || 0,
      missingImageCount: artifact.summary.missingImageCount,
      duplicateSkuCount: artifact.summary.duplicateSkuCount,
    },
    actions,
    queue,
  } satisfies ImportRemediationReport
}
