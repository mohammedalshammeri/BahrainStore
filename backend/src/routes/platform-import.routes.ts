import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import https from 'node:https'

// ─── Cross-Platform Product Import Routes ────────────────────────────────────
// Supports: Salla, Zid, Shopify (CSV + API), WooCommerce (XML), Generic CSV

// ─── Helper: HTTPS GET for API calls ─────────────────────────────────────────
function apiGet(url: string, headers: Record<string, string>): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request(
      { hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', headers },
      (res) => {
        let raw = ''
        res.on('data', d => raw += d)
        res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
      }
    )
    req.on('error', reject)
    req.end()
  })
}

// ─── Helper: normalize a product from any platform to Bazar schema ────────────
function normalizeProduct(source: 'salla' | 'zid' | 'shopify' | 'woocommerce', raw: any) {
  switch (source) {
    case 'salla': return {
      name: raw.name?.en || raw.name || '',
      nameAr: raw.name?.ar || raw.name || '',
      description: raw.description?.en || raw.description || '',
      descriptionAr: raw.description?.ar || raw.description || '',
      price: Number(raw.price?.amount || raw.price || 0),
      comparePrice: raw.sale_price ? Number(raw.sale_price.amount || raw.sale_price) : undefined,
      costPrice: undefined,
      sku: raw.sku || `salla-${raw.id}`,
      barcode: raw.barcode || undefined,
      stock: Number(raw.quantity || raw.stock || 0),
      images: (raw.images || []).map((img: any) => img.url || img),
      categoryName: raw.category?.name?.ar || raw.category?.name?.en || raw.category?.name || undefined,
      weight: raw.weight ? Number(raw.weight) : undefined,
      isActive: raw.status === 'active' || raw.status === true,
      sourceId: `salla_${raw.id}`,
    }

    case 'zid': return {
      name: raw.name?.en || raw.name || '',
      nameAr: raw.name?.ar || raw.name || '',
      description: raw.description?.en || '',
      descriptionAr: raw.description?.ar || '',
      price: Number(raw.price || 0),
      comparePrice: raw.old_price ? Number(raw.old_price) : undefined,
      sku: raw.sku || `zid-${raw.id}`,
      barcode: undefined,
      stock: Number(raw.quantity || 0),
      images: (raw.images || []).map((img: any) => img.url || img.src || img),
      categoryName: raw.category_name || undefined,
      weight: undefined,
      isActive: raw.active === true || raw.active === 1,
      sourceId: `zid_${raw.id}`,
    }

    case 'shopify': {
      // Shopify CSV format columns
      const price = parseFloat(raw['Variant Price'] || raw['Price'] || '0')
      const compareAt = parseFloat(raw['Variant Compare At Price'] || '0')
      return {
        name: raw['Title'] || '',
        nameAr: raw['Title'] || '',
        description: raw['Body (HTML)']?.replace(/<[^>]*>/g, '') || '',
        descriptionAr: raw['Body (HTML)']?.replace(/<[^>]*>/g, '') || '',
        price,
        comparePrice: compareAt > price ? compareAt : undefined,
        sku: raw['Variant SKU'] || `shopify-${Date.now()}`,
        barcode: raw['Variant Barcode'] || undefined,
        stock: parseInt(raw['Variant Inventory Qty'] || '0'),
        images: raw['Image Src'] ? [raw['Image Src']] : [],
        categoryName: raw['Type'] || raw['Product Category'] || undefined,
        weight: raw['Variant Weight'] ? parseFloat(raw['Variant Weight']) : undefined,
        isActive: raw['Status'] === 'active',
        sourceId: `shopify_${raw['Handle']}`,
      }
    }

    case 'woocommerce': return {
      name: raw.name || '',
      nameAr: raw.name || '',
      description: (raw.description || '').replace(/<[^>]*>/g, ''),
      descriptionAr: (raw.short_description || '').replace(/<[^>]*>/g, ''),
      price: Number(raw.regular_price || raw.price || 0),
      comparePrice: raw.sale_price ? Number(raw.sale_price) : undefined,
      sku: raw.sku || `woo-${raw.id}`,
      barcode: undefined,
      stock: parseInt(raw.stock_quantity || '0'),
      images: (raw.images || []).map((img: any) => img.src || img),
      categoryName: raw.categories?.[0]?.name || undefined,
      weight: raw.weight ? parseFloat(raw.weight) : undefined,
      isActive: raw.status === 'publish',
      sourceId: `woo_${raw.id}`,
    }

    default: return null
  }
}

// ─── Helper: create product in Bazar from normalized data ─────────────────────
async function createProductInStore(storeId: string, normalized: NonNullable<ReturnType<typeof normalizeProduct>>) {
  if (!normalized || !normalized.name || normalized.price <= 0) return null

  // Find or create category
  let categoryId: string | undefined
  if (normalized.categoryName) {
    const existingCat = await prisma.category.findFirst({
      where: { storeId, OR: [
        { name: { equals: normalized.categoryName, mode: 'insensitive' } },
        { nameAr: { equals: normalized.categoryName, mode: 'insensitive' } },
      ]},
    })
    if (existingCat) {
      categoryId = existingCat.id
    } else {
      const slug = normalized.categoryName
        .toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-\u0600-\u06FF]/g, '').substring(0, 50)
      const newCat = await prisma.category.create({
        data: { storeId, name: normalized.categoryName, nameAr: normalized.categoryName, slug: `${slug}-${Date.now()}` },
      })
      categoryId = newCat.id
    }
  }

  // Create unique slug
  const baseSlug = normalized.name
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .substring(0, 60) || `product-${Date.now()}`

  let slug = baseSlug
  let attempt = 0
  while (true) {
    const existing = await prisma.product.findUnique({ where: { storeId_slug: { storeId, slug } } })
    if (!existing) break
    attempt++
    slug = `${baseSlug}-${attempt}`
  }

  const product = await prisma.product.create({
    data: {
      storeId,
      categoryId,
      name: normalized.name.substring(0, 200),
      nameAr: normalized.nameAr.substring(0, 200),
      slug,
      description: normalized.description?.substring(0, 5000) || '',
      descriptionAr: normalized.descriptionAr?.substring(0, 5000) || '',
      price: normalized.price,
      comparePrice: normalized.comparePrice,
      sku: normalized.sku?.substring(0, 100),
      barcode: normalized.barcode?.substring(0, 100),
      stock: isNaN(normalized.stock) ? 0 : Math.max(0, normalized.stock),
      weight: normalized.weight,
      isActive: normalized.isActive !== false,
    },
  })

  // Create product images
  if (normalized.images?.length > 0) {
    const imageData = normalized.images.slice(0, 10).map((url: string, idx: number) => ({
      productId: product.id,
      url: String(url).substring(0, 500),
      position: idx,
    }))
    await prisma.productImage.createMany({ data: imageData, skipDuplicates: true })
  }

  return product
}

export async function platformImportRoutes(app: FastifyInstance) {
  // ─── POST /import/salla — Import from Salla via OAuth token ───────────────
  app.post('/salla', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      sallaAccessToken: z.string().min(10),
      limit: z.number().int().min(1).max(500).default(100),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const { storeId, sallaAccessToken, limit } = parsed.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Create import job
    const importJob = await prisma.importJob.create({
      data: {
        storeId,
        source: 'SALLA',
        status: 'RUNNING',
        fileUrl: 'salla-api-import',
        totalItems: 0,
        startedAt: new Date(),
      },
    })

    // Fetch products from Salla API v2 (async - run in background)
    setImmediate(async () => {
      let imported = 0, failed = 0, page = 1
      let hasMore = true

      try {
        while (hasMore && imported < limit) {
          const resp = await apiGet(
            `https://api.salla.dev/admin/v2/products?page=${page}&per_page=50`,
            { Authorization: `Bearer ${sallaAccessToken}`, 'Content-Type': 'application/json' }
          )

          const products = resp.data || resp.products || []
          if (!Array.isArray(products) || products.length === 0) { hasMore = false; break }

          for (const raw of products) {
            if (imported >= limit) break
            try {
              const normalized = normalizeProduct('salla', raw)
              if (normalized) {
                await createProductInStore(storeId, normalized)
                imported++
              }
            } catch { failed++ }
          }

          // Check pagination
          hasMore = resp.data?.length === 50 && (resp.meta?.currentPage < resp.meta?.totalPages)
          page++
        }

        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'DONE', totalItems: imported + failed, imported, failed, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'FAILED', errorLog: [err.message || 'Unknown error'], imported, failed, completedAt: new Date() },
        })
      }
    })

    return reply.send({
      message: 'بدأ الاستيراد من Salla، ستتلقى إشعاراً عند الانتهاء',
      importJobId: importJob.id,
      status: 'processing',
    })
  })

  // ─── POST /import/zid — Import from Zid via API token ────────────────────
  app.post('/zid', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      zidAccessToken: z.string().min(10),
      zidStoreId: z.string().min(1),
      limit: z.number().int().min(1).max(500).default(100),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, zidAccessToken, zidStoreId, limit } = parsed.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const importJob = await prisma.importJob.create({
      data: { storeId, source: 'ZID', status: 'RUNNING', fileUrl: 'zid-api-import', totalItems: 0, startedAt: new Date() },
    })

    setImmediate(async () => {
      let imported = 0, failed = 0, page = 1
      let hasMore = true

      try {
        while (hasMore && imported < limit) {
          const resp = await apiGet(
            `https://api.zid.sa/v1/stores/${zidStoreId}/products?page=${page}&per_page=50`,
            {
              Authorization: `Bearer ${zidAccessToken}`,
              'X-Manager-Token': zidAccessToken,
              'Accept-Language': 'ar',
            }
          )

          const products = resp.products || resp.data || []
          if (!Array.isArray(products) || products.length === 0) { hasMore = false; break }

          for (const raw of products) {
            if (imported >= limit) break
            try {
              const normalized = normalizeProduct('zid', raw)
              if (normalized) {
                await createProductInStore(storeId, normalized)
                imported++
              }
            } catch { failed++ }
          }

          hasMore = products.length === 50
          page++
        }

        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'DONE', totalItems: imported + failed, imported, failed, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'FAILED', errorLog: [err.message || 'Unknown error'], imported, failed, completedAt: new Date() },
        })
      }
    })

    return reply.send({
      message: 'بدأ الاستيراد من Zid، ستتلقى إشعاراً عند الانتهاء',
      importJobId: importJob.id,
      status: 'processing',
    })
  })

  // ─── POST /import/shopify-csv — Import from Shopify exported CSV ──────────
  app.post('/shopify-csv', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      csvData: z.string().min(10), // base64-encoded CSV
      limit: z.number().int().min(1).max(5000).default(500),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, csvData, limit } = parsed.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    // Parse CSV
    let csvText: string
    try {
      csvText = Buffer.from(csvData, 'base64').toString('utf-8')
    } catch {
      return reply.status(400).send({ error: 'CSV غير صالح' })
    }

    const lines = csvText.split('\n').filter(l => l.trim())
    if (lines.length < 2) return reply.status(400).send({ error: 'الملف فارغ أو غير صحيح' })

    // Parse header
    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []
      let current = '', inQuotes = false
      for (const char of line) {
        if (char === '"') { inQuotes = !inQuotes }
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else { current += char }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseCSVLine(lines[0])
    const rows = lines.slice(1, limit + 1).map(l => {
      const vals = parseCSVLine(l)
      return headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {} as Record<string, string>)
    })

    const importJob = await prisma.importJob.create({
      data: { storeId, source: 'SHOPIFY', status: 'RUNNING', fileUrl: 'shopify-export.csv', totalItems: rows.length, startedAt: new Date() },
    })

    setImmediate(async () => {
      let imported = 0, failed = 0
      const processedHandles = new Set<string>()

      for (const row of rows) {
        // Shopify CSV has multiple rows per product (for variants) — skip duplicates
        const handle = row['Handle']
        if (!handle || processedHandles.has(handle)) continue
        processedHandles.add(handle)

        try {
          const normalized = normalizeProduct('shopify', row)
          if (normalized && normalized.price > 0) {
            await createProductInStore(storeId, normalized)
            imported++
          }
        } catch { failed++ }
      }

      await prisma.importJob.update({
        where: { id: importJob.id },
        data: { status: 'DONE', totalItems: imported + failed, imported, failed, completedAt: new Date() },
      })
    })

    return reply.send({
      message: `جاري استيراد ${rows.length} منتج من Shopify`,
      importJobId: importJob.id,
      status: 'processing',
    })
  })

  // ─── POST /import/woocommerce — Import from WooCommerce via REST API ───────
  app.post('/woocommerce', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      wooUrl: z.string().url(),
      consumerKey: z.string().min(10),
      consumerSecret: z.string().min(10),
      limit: z.number().int().min(1).max(500).default(100),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { storeId, wooUrl, consumerKey, consumerSecret, limit } = parsed.data
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const credentials = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64')
    const importJob = await prisma.importJob.create({
      data: { storeId, source: 'WOOCOMMERCE', status: 'RUNNING', fileUrl: 'woo-import', totalItems: 0, startedAt: new Date() },
    })

    setImmediate(async () => {
      let imported = 0, failed = 0, page = 1
      let hasMore = true

      try {
        while (hasMore && imported < limit) {
          const baseUrl = wooUrl.replace(/\/$/, '')
          const resp = await apiGet(
            `${baseUrl}/wp-json/wc/v3/products?per_page=50&page=${page}&status=publish`,
            { Authorization: `Basic ${credentials}` }
          )

          const products = Array.isArray(resp) ? resp : []
          if (products.length === 0) { hasMore = false; break }

          for (const raw of products) {
            if (imported >= limit) break
            try {
              const normalized = normalizeProduct('woocommerce', raw)
              if (normalized && normalized.price > 0) {
                await createProductInStore(storeId, normalized)
                imported++
              }
            } catch { failed++ }
          }

          hasMore = products.length === 50
          page++
        }

        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'DONE', totalItems: imported + failed, imported, failed, completedAt: new Date() },
        })
      } catch (err: any) {
        await prisma.importJob.update({
          where: { id: importJob.id },
          data: { status: 'FAILED', errorLog: [err.message || 'Unknown error'], imported, failed, completedAt: new Date() },
        })
      }
    })

    return reply.send({
      message: 'بدأ الاستيراد من WooCommerce',
      importJobId: importJob.id,
      status: 'processing',
    })
  })

  // ─── GET /import/status/:jobId — Check import job status ─────────────────
  app.get('/status/:jobId', { preHandler: authenticate }, async (request, reply) => {
    const { jobId } = request.params as { jobId: string }
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findUnique({
      where: { id: jobId },
      include: { store: { select: { merchantId: true } } },
    })

    if (!job) return reply.status(404).send({ error: 'مهمة الاستيراد غير موجودة' })
    if (job.store.merchantId !== merchantId) return reply.status(403).send({ error: 'غير مصرح' })

    return reply.send({
      id: job.id,
      source: job.source,
      status: job.status,
      totalItems: job.totalItems,
      imported: job.imported,
      failed: job.failed,
      errorLog: job.errorLog,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      progress: job.totalItems > 0 ? Math.round(((job.imported + job.failed) / job.totalItems) * 100) : 0,
    })
  })

  // ─── GET /import/history/:storeId — All import jobs for a store ───────────
  app.get('/history/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const jobs = await prisma.importJob.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true, source: true, status: true, totalItems: true,
        imported: true, failed: true, fileUrl: true,
        errorLog: true, createdAt: true, startedAt: true, completedAt: true,
      },
    })

    return reply.send({ jobs })
  })

  // ─── GET /import/template/shopify — Download Shopify import CSV template ──
  app.get('/template/shopify', async (_request, reply) => {
    const headers = [
      'Handle', 'Title', 'Body (HTML)', 'Vendor', 'Product Category', 'Type',
      'Image Src', 'Variant SKU', 'Variant Price', 'Variant Compare At Price',
      'Variant Inventory Qty', 'Variant Weight', 'Variant Barcode', 'Status'
    ]

    const exampleRow = [
      'my-product', 'My Product Name', 'Product description here', 'My Brand',
      'Clothing', 'T-Shirt', 'https://example.com/img.jpg',
      'SKU001', '19.99', '29.99', '100', '0.5', '1234567890', 'active'
    ]

    const csv = [headers.join(','), exampleRow.join(',')].join('\n')
    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', 'attachment; filename="bazar-import-template.csv"')
    return reply.send('\uFEFF' + csv) // BOM for Arabic-friendly Excel
  })

  // ─── POST /import/preview — Preview first 5 rows before importing ─────────
  app.post('/preview', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      source: z.enum(['shopify', 'woocommerce']),
      csvData: z.string().min(10),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { source, csvData } = parsed.data

    let csvText: string
    try {
      csvText = Buffer.from(csvData, 'base64').toString('utf-8')
    } catch {
      return reply.status(400).send({ error: 'CSV غير صالح' })
    }

    const lines = csvText.split('\n').filter(l => l.trim())
    if (lines.length < 2) return reply.status(400).send({ error: 'الملف فارغ' })

    const parseCSVLine = (line: string): string[] => {
      const result: string[] = []; let current = '', inQuotes = false
      for (const char of line) {
        if (char === '"') inQuotes = !inQuotes
        else if (char === ',' && !inQuotes) { result.push(current.trim()); current = '' }
        else current += char
      }
      result.push(current.trim()); return result
    }

    const headers = parseCSVLine(lines[0])
    const preview = lines.slice(1, 6).map(l => {
      const vals = parseCSVLine(l)
      const row = headers.reduce((obj, h, i) => ({ ...obj, [h]: vals[i] || '' }), {} as Record<string, string>)
      return normalizeProduct(source as any, row)
    }).filter(Boolean)

    return reply.send({
      totalRows: lines.length - 1,
      preview,
      headers,
      validCount: preview.filter(p => p && Number(p.price) > 0).length,
    })
  })
}
