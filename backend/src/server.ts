import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'

import { authRoutes } from './routes/auth.routes'
import { storeRoutes } from './routes/store.routes'
import { productRoutes } from './routes/product.routes'
import { categoryRoutes } from './routes/category.routes'
import { orderRoutes } from './routes/order.routes'
import { customerRoutes } from './routes/customer.routes'
import { couponRoutes } from './routes/coupon.routes'
import { uploadRoutes } from './routes/upload.routes'

export async function buildServer() {
  const app = Fastify({
    logger: true,
  })

  // ── Security ──────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false })

  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://bazar.bh', 'https://dashboard.bazar.bh']
      : true,
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // ── JWT ───────────────────────────────────────
  await app.register(jwt, {
    secret: process.env.JWT_SECRET!,
  })

  // ── Health Check ──────────────────────────────
  app.get('/health', async () => ({
    status: 'ok',
    platform: 'Bazar',
    developer: 'BSMC.BH',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
  }))

  // ── Routes ────────────────────────────────────
  await app.register(authRoutes, { prefix: '/api/v1/auth' })
  await app.register(storeRoutes, { prefix: '/api/v1/stores' })
  await app.register(productRoutes, { prefix: '/api/v1/products' })
  await app.register(categoryRoutes, { prefix: '/api/v1/categories' })
  await app.register(orderRoutes, { prefix: '/api/v1/orders' })
  await app.register(customerRoutes, { prefix: '/api/v1/customers' })
  await app.register(couponRoutes, { prefix: '/api/v1/coupons' })
  await app.register(uploadRoutes, { prefix: '/api/v1/upload' })

  // ── 404 Handler ───────────────────────────────
  app.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ error: 'المسار غير موجود', code: 'NOT_FOUND' })
  })

  // ── Error Handler ─────────────────────────────
  app.setErrorHandler((error: Error & { statusCode?: number; code?: string }, _req, reply) => {
    const statusCode = (error as { statusCode?: number }).statusCode || 500
    app.log.error(error)
    reply.status(statusCode).send({
      error: error.message || 'خطأ في الخادم',
      code: (error as { code?: string }).code || 'INTERNAL_ERROR',
    })
  })

  return app
}
