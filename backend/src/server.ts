import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

import { authRoutes } from './routes/auth.routes'
import { storeRoutes } from './routes/store.routes'
import { productRoutes } from './routes/product.routes'
import { categoryRoutes } from './routes/category.routes'
import { orderRoutes } from './routes/order.routes'
import { customerRoutes } from './routes/customer.routes'
import { couponRoutes } from './routes/coupon.routes'
import { uploadRoutes } from './routes/upload.routes'
import { staffRoutes } from './routes/staff.routes'
import { cartRoutes } from './routes/cart.routes'
import { analyticsRoutes } from './routes/analytics.routes'
import { adminRoutes } from './routes/admin.routes'
import { paymentRoutes } from './routes/payment.routes'
import { loyaltyRoutes } from './routes/loyalty.routes'
import { whatsappRoutes } from './routes/whatsapp.routes'
import { billingRoutes } from './routes/billing.routes'
import { publicApiRoutes } from './routes/public-api.routes'
import { appsRoutes } from './routes/apps.routes'
import { blogRoutes } from './routes/blog.routes'
import { pagesRoutes } from './routes/pages.routes'
import { reviewsRoutes } from './routes/reviews.routes'
import { flashSalesRoutes } from './routes/flash-sales.routes'
import { inventoryRoutes } from './routes/inventory.routes'
import { webhookRoutes } from './routes/webhook.routes'
import { referralRoutes } from './routes/referral.routes'
import { backInStockRoutes } from './routes/back-in-stock.routes'
import { giftCardRoutes } from './routes/gift-card.routes'
import { supportRoutes } from './routes/support.routes'
import { popupRoutes } from './routes/popup.routes'
import { onboardingRoutes } from './routes/onboarding.routes'
import { marketingRoutes } from './routes/marketing.routes'
import { financeRoutes } from './routes/finance.routes'
import { emailMarketingRoutes } from './routes/email-marketing.routes'
import { announcementRoutes } from './routes/announcement.routes'
import { upsellRoutes } from './routes/upsell.routes'
import { sitemapRoutes } from './routes/sitemap.routes'

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

  // ── Swagger / OpenAPI docs ────────────────────
  await app.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Bazar Public API',
        description: 'REST API for Bazar e-commerce platform. Use your store API key in the x-api-key header.',
        version: '1.0.0',
        contact: { name: 'BSMC.BH Support', email: 'support@bazar.bh' },
      },
      servers: [
        { url: 'http://localhost:3001', description: 'Development' },
        { url: 'https://api.bazar.bh', description: 'Production' },
      ],
      components: {
        securitySchemes: {
          ApiKeyAuth: { type: 'apiKey', in: 'header', name: 'x-api-key' },
        },
      },
      security: [{ ApiKeyAuth: [] }],
    },
  })

  await app.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: { docExpansion: 'list', deepLinking: false },
    staticCSP: false,
    theme: {
      title: 'Bazar API Docs',
    },
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
  await app.register(staffRoutes, { prefix: '/api/v1/staff' })
  await app.register(cartRoutes, { prefix: '/api/v1/carts' })
  await app.register(analyticsRoutes, { prefix: '/api/v1/analytics' })
  await app.register(adminRoutes, { prefix: '/api/v1/admin' })
  await app.register(paymentRoutes, { prefix: '/api/v1/payment' })
  await app.register(loyaltyRoutes, { prefix: '/api/v1/loyalty' })
  await app.register(whatsappRoutes, { prefix: '/api/v1/whatsapp' })
  await app.register(billingRoutes, { prefix: '/api/v1/billing' })
  await app.register(publicApiRoutes, { prefix: '/api/public/v1' })
  await app.register(appsRoutes, { prefix: '/api/v1/apps' })
  await app.register(blogRoutes, { prefix: '/api/v1/blog' })
  await app.register(pagesRoutes, { prefix: '/api/v1/pages' })
  await app.register(reviewsRoutes, { prefix: '/api/v1/reviews' })
  await app.register(flashSalesRoutes, { prefix: '/api/v1/flash-sales' })
  await app.register(inventoryRoutes, { prefix: '/api/v1/inventory' })
  await app.register(webhookRoutes, { prefix: '/api/v1/webhooks' })
  await app.register(referralRoutes, { prefix: '/api/v1/referral' })
  await app.register(backInStockRoutes, { prefix: '/api/v1/back-in-stock' })
  await app.register(giftCardRoutes, { prefix: '/api/v1/gift-cards' })
  await app.register(supportRoutes, { prefix: '/api/v1/support' })
  await app.register(popupRoutes, { prefix: '/api/v1/popups' })
  await app.register(onboardingRoutes, { prefix: '/api/v1/onboarding' })
  await app.register(marketingRoutes, { prefix: '/api/v1/marketing' })
  await app.register(financeRoutes, { prefix: '/api/v1' })
  await app.register(emailMarketingRoutes, { prefix: '/api/v1' })
  await app.register(announcementRoutes, { prefix: '/api/v1' })
  await app.register(upsellRoutes, { prefix: '/api/v1' })
  await app.register(sitemapRoutes, { prefix: '/api/v1' })

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
