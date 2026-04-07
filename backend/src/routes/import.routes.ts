import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import https from 'node:https'
import { aiErrorReply, buildAICapabilities, callOpenAI, isAIConfigured } from '../lib/ai-provider'
import { buildImportPreview, buildImportRemediationReport, executePreviewImport, parseImportBuffer, persistImportArtifact, readImportArtifact, type CanonicalField } from '../lib/import-engine'
import { findMerchantStore } from '../lib/merchant-ownership'
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

const previewPayloadSchema = z.object({
  storeId: z.string().cuid(),
  fileName: z.string().min(3),
  fileContent: z.string().min(1),
  encoding: z.enum(['base64', 'utf8']).default('base64'),
})

async function suggestMappingWithAI(headers: string[]) {
  if (!isAIConfigured() || headers.length === 0) return undefined

  try {
    const content = await callOpenAI([
      {
        role: 'system',
        content: 'أنت محرك mapping لملفات كتالوج التجارة الإلكترونية. أعد فقط JSON بالشكل {"mapping":{"title":"...","price":"..."}} واستخدم أسماء الأعمدة كما وردت دون اختراع أعمدة غير موجودة.',
      },
      {
        role: 'user',
        content: JSON.stringify({
          headers,
          supportedFields: [
            'title',
            'description',
            'sku',
            'price',
            'comparePrice',
            'stock',
            'category',
            'imageUrl',
            'variantGroup',
            'variantName',
            'option1Name',
            'option1Value',
            'option2Name',
            'option2Value',
            'status',
            'seoTitle',
            'seoDescription',
            'barcode',
            'weight',
            'tags',
            'brand',
          ],
        }),
      },
    ], undefined, 350)

    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return undefined
    const parsed = JSON.parse(jsonMatch[0]) as { mapping?: Partial<Record<CanonicalField, string>> }
    return parsed.mapping
  } catch {
    return undefined
  }
}

async function createPreviewJob(storeId: string, fileName: string, buffer: Buffer) {
  const parsed = await parseImportBuffer(buffer, fileName)
  const aiMapping = await suggestMappingWithAI(parsed.records.length > 0 ? Object.keys(parsed.records[0]) : [])
  const preview = buildImportPreview(parsed.records, fileName, parsed.fileKind, aiMapping)
  const job = await prisma.importJob.create({
    data: {
      storeId,
      source: 'CSV',
      status: 'PENDING',
      totalItems: preview.summary.totalRows,
      apiConfig: {
        mode: 'preview',
        stage: 'previewed',
        fileName,
        fileKind: parsed.fileKind,
        previewSummary: preview.summary,
        warnings: preview.warnings,
      } as any,
    },
  })
  await persistImportArtifact(job.id, preview)
  return { job, preview }
}

async function writeImportAuditLog(user: any, action: string, entityId: string, entityName: string, details?: Record<string, unknown>) {
  await prisma.auditLog.create({
    data: {
      actorId: user.id,
      actorType: 'ADMIN',
      actorName: [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email || 'Merchant',
      actorEmail: user.email || 'unknown@merchant.local',
      action,
      entityType: 'IMPORT_JOB',
      entityId,
      entityName,
      details: (details ?? undefined) as any,
    },
  })
}

async function processPreviewImportJob(jobId: string, storeId: string) {
  try {
    const currentJob = await prisma.importJob.findUnique({ where: { id: jobId } })
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        apiConfig: {
          ...(currentJob?.apiConfig as any),
          mode: 'preview',
          stage: 'importing',
        },
      },
    })

    const artifact = await readImportArtifact(jobId)
    const report = await executePreviewImport(storeId, artifact)
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'DONE',
        imported: report.importedProducts,
        failed: report.skippedRows + artifact.summary.blockedRows,
        errorLog: report.issues,
        completedAt: new Date(),
        apiConfig: {
          mode: 'preview',
          stage: 'completed',
          fileName: artifact.fileName,
          fileKind: artifact.fileKind,
          previewSummary: artifact.summary,
          warnings: artifact.warnings,
          report,
        } as any,
      },
    })

    const actor = (currentJob?.apiConfig as any)?.actor
    if (actor?.id) {
      await prisma.auditLog.create({
        data: {
          actorId: actor.id,
          actorType: 'ADMIN',
          actorName: actor.name || actor.email || 'Merchant',
          actorEmail: actor.email || 'unknown@merchant.local',
          action: 'COMPLETE_IMPORT_PREVIEW_JOB',
          entityType: 'IMPORT_JOB',
          entityId: jobId,
          entityName: artifact.fileName,
          details: {
            importedProducts: report.importedProducts,
            skippedRows: report.skippedRows,
            blockedRows: artifact.summary.blockedRows,
          },
        },
      })
    }
  } catch (error) {
    await prisma.importJob.update({
      where: { id: jobId },
      data: {
        status: 'FAILED',
        completedAt: new Date(),
        errorLog: [error instanceof Error ? error.message : 'تعذر إكمال الاستيراد من المعاينة'],
        apiConfig: {
          mode: 'preview',
          stage: 'failed',
        } as any,
      },
    })
  }
}

export async function importRoutes(app: FastifyInstance) {
  app.post('/preview', { preHandler: authenticate }, async (request, reply) => {
    const result = previewPayloadSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات معاينة الملف غير صحيحة', details: result.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const { storeId, fileName, fileContent, encoding } = result.data
    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    try {
      const buffer = encoding === 'base64' ? Buffer.from(fileContent, 'base64') : Buffer.from(fileContent, 'utf8')
      const { job, preview } = await createPreviewJob(storeId, fileName, buffer)
      await writeImportAuditLog(request.user, 'CREATE_IMPORT_PREVIEW_JOB', job.id, fileName, {
        storeId,
        fileKind: preview.fileKind,
        totalRows: preview.summary.totalRows,
        blockedRows: preview.summary.blockedRows,
      })
      return reply.status(201).send({
        job,
        preview,
        capability: buildAICapabilities({ importMapping: { label: 'المطابقة الذكية لملفات الاستيراد' } }),
      })
    } catch (error: any) {
      if (error?.message === 'AI_NOT_READY') {
        return aiErrorReply(reply, error, 'تعذر توليد المعاينة الذكية لهذا الملف', {
          importMapping: { label: 'المطابقة الذكية لملفات الاستيراد' },
        })
      }
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'تعذر قراءة الملف' })
    }
  })

  app.post('/preview-file', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const file = await (request as any).file()
    const storeId = file?.fields?.storeId?.value

    if (!file || !storeId) {
      return reply.status(400).send({ error: 'يجب إرسال الملف و storeId' })
    }

    const store = await findMerchantStore(merchantId, storeId)
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const buffer = await file.toBuffer()
    try {
      const { job, preview } = await createPreviewJob(storeId, file.filename, buffer)
      await writeImportAuditLog(request.user, 'CREATE_IMPORT_PREVIEW_JOB', job.id, file.filename, {
        storeId,
        fileKind: preview.fileKind,
        totalRows: preview.summary.totalRows,
        blockedRows: preview.summary.blockedRows,
      })
      return reply.status(201).send({
        job,
        preview,
        capability: buildAICapabilities({ importMapping: { label: 'المطابقة الذكية لملفات الاستيراد' } }),
      })
    } catch (error) {
      return reply.status(400).send({ error: error instanceof Error ? error.message : 'تعذر قراءة الملف المرفوع' })
    }
  })

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
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findFirst({ where: { id, store: { merchantId } } })
    if (!job) return reply.status(404).send({ error: 'المهمة غير موجودة' })
    return reply.send({ job })
  })

  app.get('/jobs/:id/preview', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findFirst({ where: { id, store: { merchantId } } })
    if (!job) return reply.status(404).send({ error: 'المهمة غير موجودة' })

    try {
      const preview = await readImportArtifact(id)
      return reply.send({
        job,
        preview,
        report: (job.apiConfig as any)?.report ?? null,
      })
    } catch {
      return reply.status(404).send({ error: 'معاينة المهمة غير متاحة' })
    }
  })

  app.get('/jobs/:id/remediation', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findFirst({ where: { id, store: { merchantId } } })
    if (!job) return reply.status(404).send({ error: 'المهمة غير موجودة' })

    try {
      const preview = await readImportArtifact(id)
      const report = ((job.apiConfig as any)?.report ?? null) as any
      return reply.send({
        jobId: id,
        remediation: buildImportRemediationReport(preview, report),
      })
    } catch {
      return reply.status(404).send({ error: 'بيانات remediation غير متاحة لهذه المهمة' })
    }
  })

  app.post('/jobs/:id/approve', { preHandler: authenticate }, async (request, reply) => {
    const { id } = request.params as { id: string }
    const merchantId = (request.user as any).id

    const job = await prisma.importJob.findFirst({ where: { id, store: { merchantId } } })
    if (!job) return reply.status(404).send({ error: 'المهمة غير موجودة' })
    if ((job.apiConfig as any)?.mode !== 'preview') {
      return reply.status(400).send({ error: 'هذه المهمة ليست مهمة معاينة قابلة للاعتماد' })
    }
    if (job.status === 'RUNNING') {
      return reply.status(400).send({ error: 'هذه المهمة قيد التشغيل بالفعل' })
    }

    await prisma.importJob.update({
      where: { id },
      data: {
        apiConfig: {
          ...((job.apiConfig as any) || {}),
          stage: 'approved',
          approvedAt: new Date().toISOString(),
          actor: {
            id: (request.user as any).id,
            email: (request.user as any).email,
            name: [(request.user as any).firstName, (request.user as any).lastName].filter(Boolean).join(' '),
          },
        } as any,
      },
    })
    await writeImportAuditLog(request.user, 'APPROVE_IMPORT_PREVIEW_JOB', id, ((job.apiConfig as any)?.fileName || job.source) as string, {
      storeId: job.storeId,
      stage: 'approved',
    })
    setImmediate(() => processPreviewImportJob(id, job.storeId))

    return reply.status(202).send({ message: 'تم اعتماد المعاينة وبدأ التنفيذ في الخلفية', jobId: id })
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
    await writeImportAuditLog(request.user, 'CANCEL_IMPORT_JOB', id, ((job.apiConfig as any)?.fileName || job.source) as string, {
      storeId: job.storeId,
      previousStatus: job.status,
    })
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
