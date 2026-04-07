import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { stringify } from 'csv-stringify/sync'
import { parse } from 'csv-parse/sync'
import QRCode from 'qrcode'
import bwipjs from 'bwip-js'

// ─────────────────────────────────────────────
// CSV COLUMNS ORDER
// ─────────────────────────────────────────────
const CSV_HEADERS = [
  'id', 'name', 'nameAr', 'slug', 'sku', 'barcode',
  'price', 'comparePrice', 'costPrice',
  'stock', 'lowStockAlert', 'trackInventory',
  'isActive', 'isFeatured', 'isDigital',
  'weight', 'description', 'descriptionAr',
  'seoTitle', 'seoDescription',
]

export async function inventoryRoutes(app: FastifyInstance) {

  // ── Adjust single product stock ─────────────────
  // POST /inventory/adjust  body: { productId, quantity, reason }
  app.post('/adjust', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      productId: z.string().cuid(),
      quantity: z.number().int().refine((value) => value !== 0, 'quantity must not be zero'),
      reason: z.string().trim().max(500).optional().default(''),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })

    const merchantId = (request.user as any).id
    const { productId, quantity, reason } = result.data

    const product = await prisma.product.findFirst({
      where: { id: productId, store: { merchantId } },
      select: { id: true, storeId: true, stock: true, name: true, nameAr: true },
    })

    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const nextStock = product.stock + quantity
    if (nextStock < 0) {
      return reply.status(400).send({ error: 'لا يمكن أن يصبح المخزون أقل من صفر' })
    }

    const updated = await prisma.product.update({
      where: { id: productId },
      data: { stock: nextStock },
      select: { id: true, stock: true, name: true, nameAr: true },
    })

    return reply.send({
      message: 'تم تعديل المخزون',
      adjustment: {
        productId,
        quantity,
        reason,
        previousStock: product.stock,
        currentStock: updated.stock,
      },
      product: updated,
    })
  })

  // ── Export products as CSV ───────────────────
  // GET /inventory/export?storeId=xxx
  app.get('/export', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const products = await prisma.product.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
    })

    const rows = products.map(p => ({
      id: p.id,
      name: p.name,
      nameAr: p.nameAr,
      slug: p.slug,
      sku: p.sku ?? '',
      barcode: p.barcode ?? '',
      price: Number(p.price),
      comparePrice: p.comparePrice ? Number(p.comparePrice) : '',
      costPrice: p.costPrice ? Number(p.costPrice) : '',
      stock: p.stock,
      lowStockAlert: p.lowStockAlert,
      trackInventory: p.trackInventory,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      isDigital: p.isDigital,
      weight: p.weight ? Number(p.weight) : '',
      description: p.description ?? '',
      descriptionAr: p.descriptionAr ?? '',
      seoTitle: p.seoTitle ?? '',
      seoDescription: p.seoDescription ?? '',
    }))

    const csv = stringify(rows, { header: true, columns: CSV_HEADERS })

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="products-${store.slug}-${Date.now()}.csv"`)
    return reply.send('\uFEFF' + csv) // BOM for Arabic Excel support
  })

  // ── Import products from CSV ─────────────────
  // POST /inventory/import  body: { storeId, csv: "<csv string>" }
  app.post('/import', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, csv } = request.body as { storeId?: string; csv?: string }
    if (!storeId || !csv) return reply.status(400).send({ error: 'storeId و csv مطلوبان' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    let rows: Record<string, string>[]
    try {
      rows = parse(csv, { columns: true, skip_empty_lines: true, bom: true }) as Record<string, string>[]
    } catch {
      return reply.status(400).send({ error: 'ملف CSV غير صحيح' })
    }

    if (rows.length === 0) return reply.status(400).send({ error: 'الملف فارغ' })
    if (rows.length > 1000) return reply.status(400).send({ error: 'الحد الأقصى 1000 منتج لكل استيراد' })

    const created: string[] = []
    const updated: string[] = []
    const errors: { row: number; error: string }[] = []

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i]
      try {
        const name = row.name?.trim()
        const nameAr = row.nameAr?.trim()
        const slug = row.slug?.trim()
        const price = parseFloat(row.price)

        if (!name || !nameAr || !slug || isNaN(price) || price <= 0) {
          errors.push({ row: i + 2, error: 'name, nameAr, slug, price مطلوبة وصحيحة' })
          continue
        }
        if (!/^[a-z0-9-]+$/.test(slug)) {
          errors.push({ row: i + 2, error: 'slug يجب أن يحتوي على أحرف إنجليزية صغيرة وأرقام وشرطة فقط' })
          continue
        }

        const data = {
          name,
          nameAr,
          slug,
          price,
          sku: row.sku?.trim() || null,
          barcode: row.barcode?.trim() || null,
          comparePrice: row.comparePrice ? parseFloat(row.comparePrice) || null : null,
          costPrice: row.costPrice ? parseFloat(row.costPrice) || null : null,
          stock: parseInt(row.stock) || 0,
          lowStockAlert: parseInt(row.lowStockAlert) || 5,
          trackInventory: row.trackInventory === 'false' ? false : true,
          isActive: row.isActive === 'false' ? false : true,
          isFeatured: row.isFeatured === 'true',
          isDigital: row.isDigital === 'true',
          weight: row.weight ? parseFloat(row.weight) || null : null,
          description: row.description?.trim() || null,
          descriptionAr: row.descriptionAr?.trim() || null,
          seoTitle: row.seoTitle?.trim() || null,
          seoDescription: row.seoDescription?.trim() || null,
        }

        // If row.id exists, update — otherwise create
        if (row.id?.trim()) {
          const existing = await prisma.product.findFirst({ where: { id: row.id, storeId } })
          if (existing) {
            await prisma.product.update({ where: { id: row.id }, data })
            updated.push(row.id)
          } else {
            errors.push({ row: i + 2, error: `لم يُعثر على منتج بالمعرّف: ${row.id}` })
          }
        } else {
          const slugExists = await prisma.product.findUnique({
            where: { storeId_slug: { storeId, slug } },
          })
          if (slugExists) {
            errors.push({ row: i + 2, error: `الـ slug مستخدم بالفعل: ${slug}` })
            continue
          }
          await prisma.product.create({ data: { ...data, storeId } })
          created.push(slug)
        }
      } catch (err) {
        errors.push({ row: i + 2, error: 'خطأ غير متوقع' })
      }
    }

    return reply.send({
      message: `تم الاستيراد: ${created.length} منتج جديد، ${updated.length} محدّث، ${errors.length} خطأ`,
      created: created.length,
      updated: updated.length,
      errors,
    })
  })

  // ── Low-stock products ───────────────────────
  // GET /inventory/low-stock?storeId=xxx
  app.get('/low-stock', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const products = await prisma.product.findMany({
      where: {
        storeId,
        trackInventory: true,
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        nameAr: true,
        slug: true,
        sku: true,
        stock: true,
        lowStockAlert: true,
        images: { select: { url: true }, take: 1 },
      },
      orderBy: { stock: 'asc' },
    })

    const lowStock = products.filter(p => p.stock <= p.lowStockAlert)
    const outOfStock = lowStock.filter(p => p.stock === 0)

    return reply.send({
      lowStock,
      summary: {
        total: products.length,
        lowStockCount: lowStock.length,
        outOfStockCount: outOfStock.length,
      },
    })
  })

  // ── Generate QR code for product ────────────
  // GET /inventory/qrcode/:productId?storeSlug=xxx
  app.get('/qrcode/:productId', { preHandler: authenticate }, async (request, reply) => {
    const { productId } = request.params as { productId: string }
    const { storeSlug } = request.query as { storeSlug?: string }

    const merchantId = (request.user as any).id
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { merchantId } },
      select: { slug: true, name: true, nameAr: true, store: { select: { subdomain: true } } },
    })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const subdomain = storeSlug ?? product.store.subdomain
    const url = `https://${subdomain}.bazar.bh/products/${product.slug}`

    const pngBuffer = await QRCode.toBuffer(url, {
      errorCorrectionLevel: 'H',
      margin: 2,
      width: 300,
    })

    reply.header('Content-Type', 'image/png')
    reply.header('Content-Disposition', `attachment; filename="qr-${product.slug}.png"`)
    return reply.send(pngBuffer)
  })

  // ── Generate barcode for product ─────────────
  // GET /inventory/barcode/:productId
  app.get('/barcode/:productId', { preHandler: authenticate }, async (request, reply) => {
    const { productId } = request.params as { productId: string }

    const merchantId = (request.user as any).id
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { merchantId } },
      select: { sku: true, barcode: true, name: true, slug: true },
    })
    if (!product) return reply.status(404).send({ error: 'المنتج غير موجود' })

    const barcodeValue = product.barcode || product.sku || product.slug
    if (!barcodeValue) return reply.status(400).send({ error: 'لا يوجد باركود أو SKU لهذا المنتج' })

    const png = await bwipjs.toBuffer({
      bcid: 'code128',
      text: barcodeValue,
      scale: 3,
      height: 10,
      includetext: true,
      textxalign: 'center',
    })

    reply.header('Content-Type', 'image/png')
    reply.header('Content-Disposition', `attachment; filename="barcode-${product.slug}.png"`)
    return reply.send(png)
  })

  // ── Bulk update stock ────────────────────────
  // PATCH /inventory/stock  body: { updates: [{productId, stock}] }
  app.patch('/stock', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      updates: z.array(z.object({
        productId: z.string().cuid(),
        stock: z.number().int().min(0),
      })).min(1).max(500),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, updates } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.$transaction(
      updates.map(u =>
        prisma.product.updateMany({
          where: { id: u.productId, storeId },
          data: { stock: u.stock },
        })
      )
    )

    return reply.send({ message: `تم تحديث مخزون ${updates.length} منتج` })
  })
}
