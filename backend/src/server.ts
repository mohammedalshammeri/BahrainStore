import Fastify from 'fastify'
import cors from '@fastify/cors'
import helmet from '@fastify/helmet'
import rateLimit from '@fastify/rate-limit'
import jwt from '@fastify/jwt'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import staticFiles from '@fastify/static'
import multipart from '@fastify/multipart'
import rawBody from 'fastify-raw-body'
import path from 'path'

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
import { domainRoutes } from './routes/domain.routes'
import { subscriptionProductRoutes } from './routes/subscription-products.routes'
import { newPaymentRoutes } from './routes/new-payment.routes'
import { smsRoutes, pushNotificationRoutes } from './routes/sms-push.routes'
import { advancedCouponRoutes } from './routes/advanced-coupon.routes'
import { posRoutes } from './routes/pos.routes'
import { importRoutes } from './routes/import.routes'
import { healthDashboardRoutes } from './routes/platform-health.routes'
import { themeStoreRoutes } from './routes/theme-store.routes'
import { partnerRoutes } from './routes/partner.routes'
import { liveCommerceRoutes, liveChatSupportRoutes } from './routes/live-commerce.routes'
import { warehouseRoutes } from './routes/warehouse.routes'
import { currencyRoutes } from './routes/currency.routes'
import { zatcaRoutes, b2bInvoiceRoutes } from './routes/zatca-b2b.routes'
import { recommendationRoutes } from './routes/recommendations.routes'
import { socialIntegrationRoutes, googleShoppingFeedRoutes } from './routes/social-integrations.routes'
import { shippingRoutes } from './routes/shipping.routes'
import { graphqlRoutes } from './routes/graphql'
import { smartSearchRoutes } from './routes/smart-search.routes'
import { platformImportRoutes } from './routes/platform-import.routes'
import { benefitPayRoutes } from './routes/benefitpay.routes'
import { aiRoutes } from './routes/ai.routes'
import { whatsappCommerceRoutes } from './routes/whatsapp-commerce.routes'
import { bazarFinanceRoutes } from './routes/bazar-finance.routes'
import { restaurantRoutes } from './routes/restaurant.routes'
import { badgesRoutes, alertsRoutes } from './routes/badges-alerts.routes'
import { verificationRoutes } from './routes/verification.routes'
import { getEnv } from './lib/env'

export async function buildServer() {
  const env = getEnv()
  const app = Fastify({
    logger: true,
  })

  // ── Security ──────────────────────────────────
  await app.register(helmet, { contentSecurityPolicy: false })

  // ── Static files (uploaded images) ───────────
  const uploadsDir = path.join(process.cwd(), 'public', 'uploads')
  await app.register(staticFiles, { root: uploadsDir, prefix: '/uploads/', decorateReply: false })

  // ── Multipart (file uploads) ──────────────────
  await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } })

  // ── Raw body for signed webhooks ──────────────
  await app.register(rawBody, {
    field: 'rawBody',
    global: false,
    encoding: 'utf8',
    runFirst: true,
  })

  await app.register(cors, {
    origin: (origin, cb) => {
      const allowed = [
        'https://bazar.bsmc.bh',
        'https://dashboard.bazar.bsmc.bh',
        'https://dashboard.bsmc.bh',
        'https://apibazar.bsmc.bh',
        /^https:\/\/[a-z0-9-]+\.bazar\.bsmc\.bh$/,
        /^https?:\/\/localhost(:\d+)?$/,
        /^https?:\/\/127\.0\.0\.1(:\d+)?$/,
      ]
      if (!origin || allowed.some(p => typeof p === 'string' ? p === origin : p.test(origin))) {
        cb(null, true)
      } else {
        cb(new Error('Not allowed by CORS'), false)
      }
    },
    credentials: true,
  })

  await app.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  })

  // ── JWT ───────────────────────────────────────
  await app.register(jwt, {
    secret: env.JWT_SECRET,
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
  await app.register(authRoutes, { prefix: '/auth' })
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

  // ── New Feature Routes ────────────────────────
  await app.register(domainRoutes, { prefix: '/api/v1/domain' })
  await app.register(subscriptionProductRoutes, { prefix: '/api/v1/subscription-products' })
  await app.register(newPaymentRoutes, { prefix: '/api/v1/payments' })
  await app.register(smsRoutes, { prefix: '/api/v1/sms' })
  await app.register(pushNotificationRoutes, { prefix: '/api/v1/push' })
  await app.register(advancedCouponRoutes, { prefix: '/api/v1' })
  await app.register(posRoutes, { prefix: '/api/v1/pos' })
  await app.register(importRoutes, { prefix: '/api/v1/import' })
  await app.register(healthDashboardRoutes, { prefix: '/api/v1/platform' })
  await app.register(themeStoreRoutes, { prefix: '/api/v1/themes' })
  await app.register(partnerRoutes, { prefix: '/api/v1/partners' })
  await app.register(liveCommerceRoutes, { prefix: '/api/v1/live' })
  await app.register(liveChatSupportRoutes, { prefix: '/api/v1/live-chat' })
  await app.register(warehouseRoutes, { prefix: '/api/v1/warehouses' })
  await app.register(currencyRoutes, { prefix: '/api/v1/currencies' })
  await app.register(zatcaRoutes, { prefix: '/api/v1/zatca' })
  await app.register(b2bInvoiceRoutes, { prefix: '/api/v1/b2b/invoices' })
  await app.register(recommendationRoutes, { prefix: '/api/v1/recommendations' })
  await app.register(socialIntegrationRoutes, { prefix: '/api/v1/social' })
  await app.register(googleShoppingFeedRoutes, { prefix: '/api/v1/feed' })
  await app.register(shippingRoutes, { prefix: '/api/v1/shipping' })
  await app.register(graphqlRoutes, { prefix: '/api/v1/graphql' })
  await app.register(smartSearchRoutes, { prefix: '/api/v1/search' })
  await app.register(platformImportRoutes, { prefix: '/api/v1/platform-import' })
  await app.register(benefitPayRoutes, { prefix: '/api/v1/benefitpay' })

  // ── AI & New Features ─────────────────────────────────────────────────────
  await app.register(aiRoutes, { prefix: '/api/v1/ai' })
  await app.register(whatsappCommerceRoutes, { prefix: '/api/v1/whatsapp-commerce' })
  await app.register(bazarFinanceRoutes, { prefix: '/api/v1/bazar-finance' })
  await app.register(restaurantRoutes, { prefix: '/api/v1/restaurant' })
  await app.register(badgesRoutes, { prefix: '/api/v1/badges' })
  await app.register(alertsRoutes, { prefix: '/api/v1/alerts' })
  await app.register(verificationRoutes, { prefix: '/api/v1/verification' })

  // ── Public Platform Status (no auth) ─────────────────────────────────────
  app.get('/api/v1/status', async (_req, reply) => {
    const { prisma } = await import('./lib/prisma')
    const incidents = await prisma.platformIncident.findMany({
      where: { isPublic: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    const hasActiveOutage = incidents.some((i) => i.status !== 'RESOLVED' && (i.type === 'OUTAGE' || i.type === 'DEGRADED'))
    return reply.send({
      status: hasActiveOutage ? 'degraded' : 'operational',
      incidents,
      generatedAt: new Date().toISOString(),
    })
  })

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
