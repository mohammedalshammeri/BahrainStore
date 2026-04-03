import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'
import path from 'path'
import fs from 'fs'
import crypto from 'crypto'

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads')

// Ensure uploads directory exists
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon', 'image/vnd.microsoft.icon'])
const MAX_SIZE = 5 * 1024 * 1024 // 5 MB

export async function uploadRoutes(app: FastifyInstance) {
  // ── Upload image ──────────────────────────────
  app.post('/image', { preHandler: authenticate }, async (request, reply) => {
    try {
      const data = await request.file()
      if (!data) return reply.status(400).send({ error: 'لم يتم إرسال ملف' })

      if (!ALLOWED_MIME.has(data.mimetype)) {
        return reply.status(400).send({ error: 'نوع الملف غير مدعوم. المسموح: JPG، PNG، WebP، SVG، ICO' })
      }

      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of data.file) {
        size += chunk.length
        if (size > MAX_SIZE) {
          return reply.status(400).send({ error: 'حجم الملف يتجاوز الحد الأقصى (5 MB)' })
        }
        chunks.push(chunk)
      }

      const buffer = Buffer.concat(chunks)
      const ext = path.extname(data.filename).toLowerCase() || '.jpg'
      const safeName = `${crypto.randomBytes(16).toString('hex')}${ext}`
      const filePath = path.join(UPLOADS_DIR, safeName)

      fs.writeFileSync(filePath, buffer)

      const baseUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
      const url = `${baseUrl}/uploads/${safeName}`

      return reply.status(201).send({ url })
    } catch (err) {
      app.log.error(err)
      return reply.status(500).send({ error: 'فشل رفع الصورة' })
    }
  })

  // ── Config (info) ─────────────────────────────
  app.get('/config', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send({
      maxSize: '5MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/x-icon'],
    })
  })
}
