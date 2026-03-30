import type { FastifyInstance } from 'fastify'
import { authenticate } from '../middleware/auth.middleware'

// Placeholder for file upload — يتم لاحقاً ربطه بـ Cloudflare R2 أو AWS S3
export async function uploadRoutes(app: FastifyInstance) {
  app.get('/config', { preHandler: authenticate }, async (_request, reply) => {
    return reply.send({
      message: 'Upload service — سيتم ربطه بـ Cloudflare R2',
      maxSize: '10MB',
      allowedTypes: ['image/jpeg', 'image/png', 'image/webp'],
    })
  })
}
