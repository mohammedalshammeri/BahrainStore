import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import https from 'node:https'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

function httpGet(url: string, headers: Record<string, string> = {}): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url)
    const req = https.request({ hostname: urlObj.hostname, path: urlObj.pathname + urlObj.search, method: 'GET', headers }, (res) => {
      let raw = ''
      res.on('data', (c) => (raw += c))
      res.on('end', () => { try { resolve(JSON.parse(raw)) } catch { resolve(raw) } })
    })
    req.on('error', reject)
    req.end()
  })
}

// ─── Import Routes (Salla / Zid / Shopify / WooCommerce / CSV) ─────────────────

export async function importRoutes(app: FastifyInstance) {
  // POST /import/start — Start an import job
  app.post('/start', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      source: z.enum(['SALLA', 'ZID', 'SHOPIFY', 'WOOCOMMERCE', 'CSV']),
      apiConfig: z.object({
        accessToken: z.string().optional(),
        storeUrl: z.string().optional(),
        apiKey: z.string().optional(),
        apiSecret: z.string().optional(),
      }).optional(),
      fileUrl: z.string().url().optional(),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة', details: result.error.flatten() })
    }

    const merchantId = (request.user as any).id
    const { storeId, source, apiConfig, fileUrl } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const job = await prisma.importJob.create({
      data: { storeId, source, status: 'PENDING', apiConfig: apiConfig as any, fileUrl },
    })

    // Start import asynchronously
    setImmediate(() => processImport(job.id, storeId, source, apiConfig, fileUrl))

    return reply.status(202).send({ message: 'بدأ الاستيراد. يمكنك متابعة التقدم أدناه.', jobId: job.id })
  })

  // GET /import/jobs?storeId=
  app.get('/jobs', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const jobs = await prisma.importJob.findMany({
      where: { storeId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    })

    return reply.send({ jobs })
  })

  // GET /import/jobs/:id — Job status
  app.get('/jobs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const job = await prisma.importJob.findUnique({ where: { id } })
    if (!job) return reply.status(404).send({ error: 'المهمة غير موجودة' })
    return reply.send({ job })
  })

  // DELETE /import/jobs/:id — Cancel pending job
  app.delete('/jobs/:id', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findFirst({
      where: { id },
      include: { store: true },
    })
    if (!job || job.store.merchantId !== merchantId) {
      return reply.status(403).send({ error: 'غير مصرح' })
    }
    if (job.status === 'RUNNING') {
      return reply.status(400).send({ error: 'لا يمكن إلغاء مهمة قيد التشغيل' })
    }

    await prisma.importJob.update({ where: { id }, data: { status: 'FAILED', errorLog: ['تم الإلغاء من قبل التاجر'] } })
    return reply.send({ message: 'تم إلغاء مهمة الاستيراد' })
  })
}

// ─── Background import processor ──────────────────────────────────────────────
async function processImport(
  jobId: string,
  storeId: string,
  source: string,
  apiConfig?: any,
  fileUrl?: string
) {
  try {
    await prisma.importJob.update({ where: { id: jobId }, data: { status: 'RUNNING', startedAt: new Date() } })

    let products: any[] = []
    const errors: string[] = []

    if (source === 'SALLA') {
      products = await importFromSalla(apiConfig?.accessToken)
    } else if (source === 'ZID') {
      products = await importFromZid(apiConfig?.accessToken)
    } else if (source === 'SHOPIFY') {
      products = await importFromShopify(apiConfig?.storeUrl, apiConfig?.accessToken)
    } else if (source === 'WOOCOMMERCE') {
      products = await importFromWooCommerce(apiConfig?.storeUrl, apiConfig?.apiKey, apiConfig?.apiSecret)
    }

    await prisma.importJob.update({ where: { id: jobId }, data: { totalItems: products.length } })

    let imported = 0
    for (const p of products) {
      try {
        // Map to our product format
        const existing = await prisma.product.findFirst({
          where: { storeId, slug: p.slug },
        })

        if (!existing) {
          await prisma.product.create({
            data: {
              storeId,
              name: p.name || p.nameAr || 'منتج مستورد',
              nameAr: p.nameAr || p.name || 'منتج مستورد',
              slug: p.slug || `product-${Date.now()}-${imported}`,
              description: p.description,
              descriptionAr: p.descriptionAr,
              price: p.price || 0,
              comparePrice: p.comparePrice,
              sku: p.sku,
              stock: p.stock || 0,
              isActive: true,
            },
          })
        }
        imported++
        if (imported % 10 === 0) {
          await prisma.importJob.update({ where: { id: jobId }, data: { imported } })
        }
      } catch (err: any) {
        errors.push(`خطأ في استيراد ${p.name}: ${err.message}`)
      }
    }

    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        imported,
        failed: products.length - imported,
        errorLog: errors,
        completedAt: new Date(),
      },
    })
  } catch (err: any) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: { status: 'FAILED', errorLog: [err.message], completedAt: new Date() },
    })
  }
}

async function importFromSalla(accessToken?: string): Promise<any[]> {
  if (!accessToken) return []
  try {
    const data = await httpGet('https://api.salla.dev/admin/v2/products', {
      Authorization: `Bearer ${accessToken}`,
    })
    return (data?.data || []).map((p: any) => ({
      name: p.name,
      nameAr: p.name,
      slug: p.id?.toString() || slugify(p.name),
      description: p.description?.html,
      price: Number(p.price?.amount || 0),
      comparePrice: p.old_price ? Number(p.old_price.amount) : undefined,
      sku: p.sku,
      stock: p.quantity || 0,
    }))
  } catch {
    return []
  }
}

async function importFromZid(accessToken?: string): Promise<any[]> {
  if (!accessToken) return []
  try {
    const data = await httpGet('https://api.zid.sa/v1/products', {
      Authorization: `Bearer ${accessToken}`,
      'Accept-Language': 'ar',
    })
    return (data?.products || []).map((p: any) => ({
      name: p.name,
      nameAr: p.name,
      slug: slugify(p.name),
      description: p.description,
      price: Number(p.price || 0),
      sku: p.sku,
      stock: p.quantity || 0,
    }))
  } catch {
    return []
  }
}

async function importFromShopify(storeUrl?: string, accessToken?: string): Promise<any[]> {
  if (!storeUrl || !accessToken) return []
  try {
    const domain = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const data = await httpGet(`https://${domain}/admin/api/2024-01/products.json?limit=250`, {
      'X-Shopify-Access-Token': accessToken,
    })
    return (data?.products || []).map((p: any) => ({
      name: p.title,
      nameAr: p.title,
      slug: p.handle,
      description: p.body_html,
      price: Number(p.variants?.[0]?.price || 0),
      sku: p.variants?.[0]?.sku,
      stock: p.variants?.[0]?.inventory_quantity || 0,
    }))
  } catch {
    return []
  }
}

async function importFromWooCommerce(storeUrl?: string, apiKey?: string, apiSecret?: string): Promise<any[]> {
  if (!storeUrl || !apiKey || !apiSecret) return []
  try {
    const domain = storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, '')
    const auth = Buffer.from(`${apiKey}:${apiSecret}`).toString('base64')
    const data = await httpGet(`https://${domain}/wp-json/wc/v3/products?per_page=100`, {
      Authorization: `Basic ${auth}`,
    })
    return (Array.isArray(data) ? data : []).map((p: any) => ({
      name: p.name,
      nameAr: p.name,
      slug: p.slug,
      description: p.description,
      price: Number(p.regular_price || 0),
      comparePrice: p.sale_price ? Number(p.regular_price) : undefined,
      sku: p.sku,
      stock: p.stock_quantity || 0,
    }))
  } catch {
    return []
  }
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .substring(0, 60)
    + '-' + Date.now()
}
