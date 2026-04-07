import type { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

// KYC docs get their own subdirectory under public/uploads/
const KYC_DIR = path.join(process.cwd(), 'public', 'uploads', 'kyc')
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB — documents may be larger than product images

if (!fs.existsSync(KYC_DIR)) {
  fs.mkdirSync(KYC_DIR, { recursive: true })
}

const VALID_DOC_TYPES = ['NATIONAL_ID', 'COMMERCIAL_REGISTRATION', 'VAT_CERTIFICATE', 'OTHER'] as const

export async function verificationRoutes(app: FastifyInstance) {
  // ── GET /verification?storeId= ───────────────────────────────────────────────
  // Returns the current KYC status for the authenticated merchant
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id

    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { kycStatus: true },
    })

    if (!merchant) return reply.status(404).send({ error: 'التاجر غير موجود' })

    const documents = await prisma.kycDocument.findMany({
      where: { merchantId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        type: true,
        fileUrl: true,
        fileName: true,
        status: true,
        reviewNote: true,
        reviewedAt: true,
        reviewedBy: true,
        expiresAt: true,
        reVerifyBy: true,
        createdAt: true,
      },
    })

    return reply.send({
      kycStatus: merchant.kycStatus,
      documents,
    })
  })

  // ── POST /verification/submit ────────────────────────────────────────────────
  // Multipart: field "type" (doc type), field "level" (basic/verified/commercial)
  // + file attachment
  app.post('/submit', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id

    const data = await request.file()
    if (!data) return reply.status(400).send({ error: 'لم يتم إرسال ملف' })

    if (!ALLOWED_MIME.has(data.mimetype)) {
      // Drain the stream to avoid memory leaks
      data.file.resume()
      return reply.status(400).send({ error: 'نوع الملف غير مدعوم. المسموح: JPG، PNG، WebP، PDF' })
    }

    // Extract form fields from multipart
    const fields = (data as any).fields as Record<string, { value: string }> | undefined
    const rawType = fields?.type?.value ?? 'OTHER'
    const docType: string = VALID_DOC_TYPES.includes(rawType as any) ? rawType : 'OTHER'

    // Read file with size guard
    const chunks: Buffer[] = []
    let totalSize = 0
    for await (const chunk of data.file) {
      totalSize += chunk.length
      if (totalSize > MAX_SIZE) {
        return reply.status(400).send({ error: 'حجم الملف يتجاوز الحد الأقصى (10 MB)' })
      }
      chunks.push(chunk)
    }

    const buffer = Buffer.concat(chunks)

    // Sanitize extension — never trust user-supplied filename extension directly
    const suppliedExt = path.extname(data.filename ?? '').toLowerCase()
    const safeExtMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'application/pdf': '.pdf',
    }
    const ext = safeExtMap[data.mimetype] ?? suppliedExt ?? '.bin'

    const safeName = `kyc_${merchantId.slice(-6)}_${crypto.randomBytes(16).toString('hex')}${ext}`
    const filePath = path.join(KYC_DIR, safeName)
    fs.writeFileSync(filePath, buffer)

    const baseUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
    const fileUrl = `${baseUrl}/uploads/kyc/${safeName}`

    // Save the document record
    const doc = await prisma.kycDocument.create({
      data: {
        merchantId,
        type: docType,
        fileUrl,
        fileName: data.filename ?? safeName,
        status: 'PENDING',
      },
    })

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { kycStatus: 'PENDING' },
    })

    return reply.status(201).send({
      message: 'تم رفع المستند بنجاح، سيتم مراجعته خلال 24 ساعة',
      document: doc,
    })
  })
}
