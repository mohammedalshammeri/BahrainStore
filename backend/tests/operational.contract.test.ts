import Fastify from 'fastify'
import multipart from '@fastify/multipart'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMock = {
  store: { findFirst: vi.fn() },
  storeSettings: { findUnique: vi.fn(), upsert: vi.fn() },
  onboarding: { upsert: vi.fn() },
  aiChat: { findMany: vi.fn(), create: vi.fn() },
  importJob: { create: vi.fn(), findFirst: vi.fn(), findMany: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
  customer: { count: vi.fn() },
  product: { count: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
  category: { findFirst: vi.fn(), create: vi.fn() },
  shippingZone: { findMany: vi.fn() },
  shippingRate: { create: vi.fn() },
  order: { findUnique: vi.fn(), update: vi.fn(), aggregate: vi.fn(), count: vi.fn(), findMany: vi.fn() },
  orderReturn: {
    count: vi.fn(),
    create: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  returnItem: { findMany: vi.fn() },
  abandonedCart: { count: vi.fn() },
  whatsappCommerceConfig: { findUnique: vi.fn() },
  liveStream: { findMany: vi.fn() },
  coupon: { count: vi.fn() },
  pageView: { count: vi.fn(), groupBy: vi.fn() },
  merchant: { findUnique: vi.fn(), update: vi.fn() },
  kycDocument: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
    count: vi.fn(),
  },
  auditLog: { create: vi.fn() },
  themeAsset: { upsert: vi.fn(), deleteMany: vi.fn() },
} as any

const authState = {
  user: {
    id: 'merchant_admin_1',
    email: 'admin@bazar.test',
    firstName: 'Admin',
    lastName: 'User',
    isAdmin: true,
  },
  isFullAdmin: true,
  permissions: {
    canViewMerchants: false,
    canDisableStore: false,
    canReplyTickets: false,
    canEditPlans: false,
    canManageApps: false,
    canViewFinancials: false,
    canViewAuditLog: false,
    canManageContent: false,
    canReviewKYC: false,
    canManageTeam: false,
  } as Record<string, boolean>,
}

const sendKycDecisionEmail = vi.fn().mockResolvedValue(undefined)
const issueBenefitPayRefund = vi.fn()

vi.mock('../src/lib/prisma', () => ({ prisma: prismaMock }))

vi.mock('../src/middleware/auth.middleware', () => ({
  authenticate: async (request: any) => {
    request.user = authState.user
  },
  requireAdmin: async (request: any) => {
    request.user = authState.user
  },
  requireFullPlatformAdmin: async (_request: any, reply: any) => {
    if (!authState.isFullAdmin) {
      return reply.status(403).send({ error: 'هذا الإجراء متاح فقط لمشرف المنصة الكامل', code: 'FORBIDDEN_FULL_ADMIN' })
    }
  },
  requirePlatformPermission: (permission: string) => async (_request: any, reply: any) => {
    if (!authState.isFullAdmin && !authState.permissions[permission]) {
      return reply.status(403).send({ error: 'لا تملك الصلاحية المطلوبة لهذا الإجراء', code: 'FORBIDDEN_PERMISSION' })
    }
  },
  resolvePlatformAccess: async () => ({
    isFullAdmin: authState.isFullAdmin,
    staffId: authState.isFullAdmin ? null : 'staff_1',
    permissions: authState.permissions,
  }),
}))

vi.mock('../src/lib/email', () => ({
  sendPasswordResetEmail: vi.fn(),
  sendCustomAdminEmail: vi.fn(),
  sendOrderConfirmationEmail: vi.fn(),
  sendOrderStatusUpdateEmail: vi.fn(),
  sendKycDecisionEmail,
}))

vi.mock('../src/lib/sms', () => ({
  sendSms: vi.fn(),
  sendOrderConfirmationSms: vi.fn(),
  sendOrderStatusUpdateSms: vi.fn(),
}))

vi.mock('../src/lib/whatsapp', () => ({
  sendWhatsAppOrderConfirmation: vi.fn(),
  sendWhatsAppStatusUpdate: vi.fn(),
}))

vi.mock('../src/lib/theme-package', () => ({
  THEME_CHANGELOG_ASSET_KEYS: ['CHANGELOG.md'],
  THEME_MANIFEST_ASSET_KEY: 'manifest.json',
  buildThemeManifestAsset: vi.fn(),
  buildThemePackageBuffer: vi.fn(),
  parseThemePackageBuffer: vi.fn(),
  resolveThemeChangelogFromAssets: vi.fn(),
  resolveThemeManifestFromAssets: vi.fn(),
  themePackageManifestSchema: { parse: vi.fn() },
}))

vi.mock('../src/lib/aramex', () => ({ trackAramexShipment: vi.fn() }))
vi.mock('../src/lib/dhl', () => ({ trackDhlShipment: vi.fn() }))
vi.mock('../src/routes/benefitpay.routes', () => ({ issueBenefitPayRefund }))
vi.mock('../src/lib/merchant-ownership', () => ({
  findMerchantOrder: vi.fn(),
  findMerchantShipmentTracking: vi.fn(),
  findMerchantShipmentTrackingByNumber: vi.fn(),
  findMerchantShippingRate: vi.fn(),
  findMerchantShippingZone: vi.fn(),
  findMerchantStore: vi.fn(),
}))

const { shippingRoutes } = await import('../src/routes/shipping.routes')
const { verificationRoutes } = await import('../src/routes/verification.routes')
const { adminKycRoutes } = await import('../src/routes/admin-kyc.routes')
const { orderRoutes } = await import('../src/routes/order.routes')
const { analyticsRoutes } = await import('../src/routes/analytics.routes')
const { onboardingRoutes } = await import('../src/routes/onboarding.routes')
const { importRoutes } = await import('../src/routes/import.routes')
const ownership = await import('../src/lib/merchant-ownership')
const authMiddleware = await import('../src/middleware/auth.middleware')

const baseOrder = {
  id: 'order_1',
  orderNumber: 'BZR-ORDER-1',
  status: 'DELIVERED',
  total: 30,
  paymentStatus: 'PAID',
  paymentMethod: 'CASH_ON_DELIVERY',
  store: { merchantId: 'merchant_admin_1' },
  items: [
    { id: 'item_1', quantity: 2, total: 20, price: 10 },
    { id: 'item_2', quantity: 1, total: 10, price: 10 },
  ],
}

const contractStoreId = 'cstore1234567890123456789'

function resetAuthState() {
  authState.isFullAdmin = true
  Object.keys(authState.permissions).forEach((key) => {
    authState.permissions[key] = false
  })
}

beforeEach(() => {
  resetAuthState()
  vi.clearAllMocks()
  prismaMock.store.findFirst.mockResolvedValue({ id: contractStoreId, currency: 'BHD' })
  prismaMock.aiChat.findMany.mockResolvedValue([])
  prismaMock.onboarding.upsert.mockResolvedValue({ id: 'onboarding_1', storeId: 'store_1' })
  prismaMock.storeSettings.upsert.mockResolvedValue({ id: 'settings_1', storeId: 'store_1' })
  prismaMock.importJob.findMany.mockResolvedValue([])
  prismaMock.importJob.findFirst.mockResolvedValue(null)
  prismaMock.importJob.findUnique.mockResolvedValue(null)
  prismaMock.importJob.create.mockImplementation(async ({ data }: any) => ({ id: 'import_job_1', ...data, createdAt: new Date().toISOString() }))
  prismaMock.importJob.update.mockImplementation(async ({ where, data }: any) => ({ id: where.id, ...data }))
  prismaMock.auditLog.create.mockResolvedValue({ id: 'audit_1' })
  prismaMock.product.findFirst.mockResolvedValue(null)
  prismaMock.product.create.mockResolvedValue({ id: 'product_1' })
  prismaMock.category.findFirst.mockResolvedValue(null)
  prismaMock.category.create.mockResolvedValue({ id: 'category_1' })
})

describe('onboarding workspace contract tests', () => {
  it('returns workspace progress and latest stored draft payload', async () => {
    prismaMock.store.findFirst.mockResolvedValueOnce({
      id: contractStoreId,
      merchantId: 'merchant_admin_1',
      name: 'Bazar',
      nameAr: 'بازار',
      currency: 'BHD',
      language: 'BOTH',
      timezone: 'Asia/Bahrain',
      descriptionAr: 'وصف',
      onboarding: null,
      settings: { primaryColor: '#4f46e5', tapEnabled: false, moyasarEnabled: false, benefitEnabled: false, freeShippingMin: 20 },
      _count: { products: 2, orders: 1, customers: 4 },
    })
    prismaMock.aiChat.findMany.mockResolvedValueOnce([
      {
        createdAt: '2026-04-07T12:00:00.000Z',
        message: 'onboarding-workspace-draft',
        metadata: {
          workflow: 'onboarding-workspace',
          questionnaire: { businessType: 'أزياء' },
          draft: { summary: 'draft-summary' },
        },
      },
    ])

    const app = Fastify()
    await app.register(onboardingRoutes, { prefix: '/onboarding' })

  const response = await app.inject({ method: 'GET', url: `/onboarding/workspace?storeId=${contractStoreId}` })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      store: expect.objectContaining({ id: contractStoreId, currency: 'BHD' }),
      progress: expect.objectContaining({ completedCount: 2 }),
      latestDraft: expect.objectContaining({ payload: expect.objectContaining({ summary: 'draft-summary' }) }),
    })
  })

  it('applies a draft while keeping payment gateways disabled when credentials are missing', async () => {
    prismaMock.store.findFirst.mockResolvedValueOnce({
      id: contractStoreId,
      merchantId: 'merchant_admin_1',
      currency: 'BHD',
      language: 'BOTH',
      timezone: 'Asia/Bahrain',
      settings: {
        tapSecretKey: null,
        tapPublicKey: null,
        moyasarSecretKey: null,
        moyasarPublicKey: null,
        benefitMerchantId: null,
        benefitApiKey: null,
      },
    })
    prismaMock.store.update = vi.fn().mockResolvedValue({ id: contractStoreId, currency: 'SAR', language: 'BOTH', timezone: 'Asia/Riyadh' })
    prismaMock.storeSettings.upsert.mockResolvedValueOnce({
      id: 'settings_1',
      storeId: contractStoreId,
      tapEnabled: false,
      moyasarEnabled: false,
      benefitEnabled: false,
      freeShippingMin: 35,
    })

    const app = Fastify()
    await app.register(onboardingRoutes, { prefix: '/onboarding' })

    const response = await app.inject({
      method: 'POST',
      url: '/onboarding/workspace/apply',
      payload: {
        storeId: contractStoreId,
        draft: {
          store: { description: 'desc', descriptionAr: 'desc ar', currency: 'SAR', language: 'BOTH', timezone: 'Asia/Riyadh' },
          settings: {
            freeShippingMin: 35,
            allowReviews: true,
            showOutOfStock: true,
            tapEnabled: true,
            moyasarEnabled: true,
            benefitEnabled: true,
          },
        },
      },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      warnings: expect.arrayContaining([
        expect.stringContaining('Tap'),
        expect.stringContaining('Moyasar'),
        expect.stringContaining('Benefit Pay'),
      ]),
      settings: expect.objectContaining({ tapEnabled: false, moyasarEnabled: false, benefitEnabled: false }),
    })
  })
})

describe('import preview contract tests', () => {
  it('creates a preview job from CSV content and returns ready and blocked rows', async () => {
    vi.mocked(ownership.findMerchantStore).mockResolvedValueOnce({ id: contractStoreId, merchantId: 'merchant_admin_1' } as any)
    prismaMock.importJob.create.mockResolvedValueOnce({
      id: 'import_job_1',
      storeId: contractStoreId,
      source: 'CSV',
      status: 'PENDING',
      totalItems: 2,
      apiConfig: { mode: 'preview', stage: 'previewed' },
      createdAt: '2026-04-07T12:00:00.000Z',
    })

    const app = Fastify()
    await app.register(multipart)
    await app.register(importRoutes, { prefix: '/import' })

    const csv = Buffer.from('title,price,stock\nBag,10,5\n,0,2').toString('base64')
    const response = await app.inject({
      method: 'POST',
      url: '/import/preview',
      payload: {
        storeId: contractStoreId,
        fileName: 'catalog.csv',
        fileContent: csv,
        encoding: 'base64',
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      job: expect.objectContaining({ id: 'import_job_1', status: 'PENDING' }),
      preview: expect.objectContaining({
        summary: expect.objectContaining({ totalRows: 2, blockedRows: 1, warningRows: 1 }),
      }),
    })
  })

  it('returns persisted preview payload for preview jobs', async () => {
    vi.mocked(ownership.findMerchantStore).mockResolvedValueOnce({ id: contractStoreId, merchantId: 'merchant_admin_1' } as any)
    prismaMock.importJob.create.mockResolvedValueOnce({
      id: 'import_job_preview',
      storeId: contractStoreId,
      source: 'CSV',
      status: 'PENDING',
      totalItems: 1,
      apiConfig: { mode: 'preview', stage: 'previewed' },
      createdAt: '2026-04-07T12:00:00.000Z',
    })
    prismaMock.importJob.findFirst.mockResolvedValueOnce({
      id: 'import_job_preview',
      storeId: contractStoreId,
      source: 'CSV',
      status: 'PENDING',
      totalItems: 1,
      apiConfig: { mode: 'preview', stage: 'previewed' },
      createdAt: '2026-04-07T12:00:00.000Z',
    })

    const app = Fastify()
    await app.register(multipart)
    await app.register(importRoutes, { prefix: '/import' })

    const csv = Buffer.from('title,price,stock\nBag,10,5').toString('base64')
    await app.inject({
      method: 'POST',
      url: '/import/preview',
      payload: {
        storeId: contractStoreId,
        fileName: 'catalog.csv',
        fileContent: csv,
        encoding: 'base64',
      },
    })

    const response = await app.inject({ method: 'GET', url: '/import/jobs/import_job_preview/preview' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      job: expect.objectContaining({ id: 'import_job_preview' }),
      preview: expect.objectContaining({ summary: expect.objectContaining({ totalRows: 1, blockedRows: 0 }) }),
    })
  })

  it('returns remediation actions derived from preview warnings and blocked rows', async () => {
    vi.mocked(ownership.findMerchantStore).mockResolvedValueOnce({ id: contractStoreId, merchantId: 'merchant_admin_1' } as any)
    prismaMock.importJob.create.mockResolvedValueOnce({
      id: 'import_job_remediation',
      storeId: contractStoreId,
      source: 'CSV',
      status: 'DONE',
      totalItems: 2,
      apiConfig: { mode: 'preview', stage: 'completed', report: { importedProducts: 1, skippedRows: 0 } },
      createdAt: '2026-04-07T12:00:00.000Z',
    })

    const app = Fastify()
    await app.register(multipart)
    await app.register(importRoutes, { prefix: '/import' })

    const csv = Buffer.from('title,price,stock\nBag,10,5\n,0,2').toString('base64')
    await app.inject({
      method: 'POST',
      url: '/import/preview',
      payload: {
        storeId: contractStoreId,
        fileName: 'catalog.csv',
        fileContent: csv,
        encoding: 'base64',
      },
    })

    prismaMock.importJob.findFirst.mockResolvedValueOnce({
      id: 'import_job_remediation',
      storeId: contractStoreId,
      source: 'CSV',
      status: 'DONE',
      totalItems: 2,
      apiConfig: { mode: 'preview', stage: 'completed', report: { importedProducts: 1, skippedRows: 0 } },
      createdAt: '2026-04-07T12:00:00.000Z',
    })

    const response = await app.inject({ method: 'GET', url: '/import/jobs/import_job_remediation/remediation' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      remediation: expect.objectContaining({
        actions: expect.arrayContaining([
          expect.objectContaining({ key: 'fix-blocked-rows' }),
          expect.objectContaining({ key: 'add-images' }),
        ]),
        queue: expect.arrayContaining([
          expect.objectContaining({ rowIndex: 2, severity: 'blocked' }),
        ]),
      }),
    })
  })

  it('blocks access to preview artifacts that belong to another merchant', async () => {
    prismaMock.importJob.findFirst.mockResolvedValueOnce(null)

    const app = Fastify()
    await app.register(multipart)
    await app.register(importRoutes, { prefix: '/import' })

    const response = await app.inject({ method: 'GET', url: '/import/jobs/import_job_foreign/preview' })

    expect(response.statusCode).toBe(404)
    expect(response.json()).toMatchObject({ error: 'المهمة غير موجودة' })
  })
})

describe('shipping contract tests', () => {
  it('returns sorted calculated shipping rates with finalPrice', async () => {
    prismaMock.shippingZone.findMany.mockResolvedValueOnce([
      {
        name: 'Bahrain',
        nameAr: 'البحرين',
        cities: ['Manama'],
        rates: [
          { id: 'rate_2', name: 'Express', nameAr: 'سريع', price: 9, isFree: false, minWeight: 0, maxWeight: 10, minOrderValue: 0, estimatedDays: 1 },
          { id: 'rate_1', name: 'Standard', nameAr: 'عادي', price: 5, isFree: false, minWeight: 0, maxWeight: 10, minOrderValue: 0, estimatedDays: 3 },
        ],
      },
    ])

    const app = Fastify()
    await app.register(shippingRoutes, { prefix: '/shipping' })

    const response = await app.inject({
      method: 'POST',
      url: '/shipping/calculate',
      payload: { storeId: 'store_1', country: 'BH', city: 'Manama', orderValue: 20, totalWeight: 1 },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      rates: [
        expect.objectContaining({ id: 'rate_1', finalPrice: 5, zoneNameAr: 'البحرين' }),
        expect.objectContaining({ id: 'rate_2', finalPrice: 9 }),
      ],
    })
  })

  it('rejects non-operational DHL rates before creation', async () => {
    vi.mocked(ownership.findMerchantShippingZone).mockResolvedValueOnce({ id: 'zone_1', storeId: 'store_1' } as any)
    prismaMock.storeSettings.findUnique.mockResolvedValueOnce({ dhlEnabled: false, dhlApiKey: null, dhlAccountNumber: null })

    const app = Fastify()
    await app.register(shippingRoutes, { prefix: '/shipping' })

    const response = await app.inject({
      method: 'POST',
      url: '/shipping/rates',
      payload: { zoneId: 'zone_1', name: 'DHL Express', provider: 'DHL', price: 12 },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: expect.stringContaining('DHL') })
    expect(prismaMock.shippingRate.create).not.toHaveBeenCalled()
  })
})

describe('verification contract tests', () => {
  it('returns KYC review metadata fields for merchant status page', async () => {
    prismaMock.merchant.findUnique.mockResolvedValueOnce({ kycStatus: 'APPROVED' })
    prismaMock.kycDocument.findMany.mockResolvedValueOnce([
      {
        id: 'kyc_1',
        type: 'COMMERCIAL_REGISTRATION',
        fileUrl: 'https://example.com/doc.pdf',
        fileName: 'doc.pdf',
        status: 'APPROVED',
        reviewNote: 'Verified',
        reviewedAt: '2026-04-07T10:00:00.000Z',
        reviewedBy: 'reviewer@bazar.test',
        expiresAt: '2027-04-07T10:00:00.000Z',
        reVerifyBy: '2027-03-08T10:00:00.000Z',
        createdAt: '2026-04-06T10:00:00.000Z',
      },
    ])

    const app = Fastify()
    await app.register(multipart)
    await app.register(verificationRoutes, { prefix: '/verification' })

    const response = await app.inject({ method: 'GET', url: '/verification' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({
      kycStatus: 'APPROVED',
      documents: [
        expect.objectContaining({
          reviewedBy: 'reviewer@bazar.test',
          expiresAt: '2027-04-07T10:00:00.000Z',
          reVerifyBy: '2027-03-08T10:00:00.000Z',
        }),
      ],
    })
  })
})

describe('admin KYC and permission contract tests', () => {
  it('blocks KYC review endpoints when canReviewKYC is missing', async () => {
    authState.isFullAdmin = false

    const app = Fastify()
    await app.register(adminKycRoutes)

    const response = await app.inject({ method: 'GET', url: '/admin/kyc' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN_PERMISSION' })
  })

  it('requires a review note when rejecting a KYC document', async () => {
    authState.isFullAdmin = false
    authState.permissions.canReviewKYC = true

    const app = Fastify()
    await app.register(adminKycRoutes)

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/kyc/kyc_1/review',
      payload: { status: 'REJECTED' },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: expect.stringContaining('ملاحظة') })
  })

  it('allows delegated reviewers with canReviewKYC to list KYC queue', async () => {
    authState.isFullAdmin = false
    authState.permissions.canReviewKYC = true

    prismaMock.kycDocument.findMany.mockResolvedValueOnce([
      {
        id: 'kyc_queued_1',
        status: 'PENDING',
        type: 'COMMERCIAL_REGISTRATION',
        merchant: { id: 'merchant_1', email: 'merchant@bazar.test', firstName: 'Store', lastName: 'Owner', kycStatus: 'PENDING' },
      },
    ])
    prismaMock.kycDocument.count.mockResolvedValueOnce(1)

    const app = Fastify()
    await app.register(adminKycRoutes)

    const response = await app.inject({ method: 'GET', url: '/admin/kyc' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      total: 1,
      docs: [expect.objectContaining({ id: 'kyc_queued_1', status: 'PENDING' })],
    })
  })

  it('approves KYC documents with audit trail, notification, and re-verification dates', async () => {
    authState.isFullAdmin = false
    authState.permissions.canReviewKYC = true

    prismaMock.kycDocument.findUnique.mockResolvedValueOnce({
      id: 'kyc_1',
      merchantId: 'merchant_1',
      status: 'PENDING',
      type: 'COMMERCIAL_REGISTRATION',
      merchant: { email: 'merchant@bazar.test', firstName: 'Store', lastName: 'Owner' },
    })
    prismaMock.kycDocument.update.mockImplementationOnce(async ({ data }: any) => ({
      id: 'kyc_1',
      merchantId: 'merchant_1',
      ...data,
    }))
    prismaMock.kycDocument.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0)
    prismaMock.merchant.update.mockResolvedValueOnce({ id: 'merchant_1', kycStatus: 'APPROVED' })
    prismaMock.auditLog.create.mockResolvedValueOnce({ id: 'audit_1' })

    const app = Fastify()
    await app.register(adminKycRoutes)

    const response = await app.inject({
      method: 'PATCH',
      url: '/admin/kyc/kyc_1/review',
      payload: { status: 'APPROVED', reviewNote: 'All documents are valid.' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      kycStatus: 'APPROVED',
      doc: expect.objectContaining({
        status: 'APPROVED',
        reviewedBy: 'admin@bazar.test',
      }),
    })

    const { doc } = response.json()
    expect(doc.expiresAt).toBeTruthy()
    expect(doc.reVerifyBy).toBeTruthy()
    expect(prismaMock.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        action: 'APPROVE_KYC',
        entityType: 'KYC_DOCUMENT',
      }),
    }))
    expect(sendKycDecisionEmail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'merchant@bazar.test',
      status: 'APPROVED',
    }))
  })

  it('keeps full-admin-only routes blocked for delegated staff', async () => {
    authState.isFullAdmin = false
    authState.permissions.canViewFinancials = true

    const app = Fastify()
    app.get('/full-admin-only', { preHandler: [authMiddleware.requireFullPlatformAdmin] }, async () => ({ ok: true }))

    const response = await app.inject({ method: 'GET', url: '/full-admin-only' })

    expect(response.statusCode).toBe(403)
    expect(response.json()).toMatchObject({ code: 'FORBIDDEN_FULL_ADMIN' })
  })
})

describe('returns and refunds contract tests', () => {
  it('creates itemized return requests for delivered orders', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(baseOrder)
    prismaMock.orderReturn.count.mockResolvedValueOnce(1)
    prismaMock.returnItem.findMany.mockResolvedValueOnce([])
    prismaMock.orderReturn.create.mockResolvedValueOnce({
      id: 'return_2',
      returnNumber: 'R-BZR-ORDER-1-2',
      status: 'PENDING',
      refundAmount: 10,
      refundMethod: 'manual',
      items: [{ orderItemId: 'item_1', quantity: 1, reason: 'Damaged' }],
    })

    const app = Fastify()
    await app.register(orderRoutes, { prefix: '/orders' })

    const response = await app.inject({
      method: 'POST',
      url: '/orders/order_1/returns',
      payload: {
        reason: 'Damaged item',
        refundAmount: 10,
        refundMethod: 'manual',
        items: [{ orderItemId: 'item_1', quantity: 1, reason: 'Damaged' }],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(response.json()).toMatchObject({
      message: 'تم تسجيل طلب المرتجع',
      orderReturn: expect.objectContaining({
        returnNumber: 'R-BZR-ORDER-1-2',
        refundAmount: 10,
      }),
    })
  })

  it('rejects over-return quantities when previous approved returns already consumed stock', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(baseOrder)
    prismaMock.orderReturn.count.mockResolvedValueOnce(0)
    prismaMock.returnItem.findMany.mockResolvedValueOnce([{ orderItemId: 'item_1', quantity: 1 }])

    const app = Fastify()
    await app.register(orderRoutes, { prefix: '/orders' })

    const response = await app.inject({
      method: 'POST',
      url: '/orders/order_1/returns',
      payload: {
        reason: 'Wrong size',
        items: [{ orderItemId: 'item_1', quantity: 2 }],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: expect.stringContaining('تتجاوز') })
    expect(prismaMock.orderReturn.create).not.toHaveBeenCalled()
  })

  it('rejects return requests whose refund amount exceeds selected item value', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(baseOrder)
    prismaMock.orderReturn.count.mockResolvedValueOnce(0)
    prismaMock.returnItem.findMany.mockResolvedValueOnce([])

    const app = Fastify()
    await app.register(orderRoutes, { prefix: '/orders' })

    const response = await app.inject({
      method: 'POST',
      url: '/orders/order_1/returns',
      payload: {
        reason: 'Not needed',
        refundAmount: 25,
        items: [{ orderItemId: 'item_1', quantity: 1 }],
      },
    })

    expect(response.statusCode).toBe(400)
    expect(response.json()).toMatchObject({ error: expect.stringContaining('قيمة العناصر') })
  })

  it('blocks original-payment refunds when the gateway is not production-ready for that order', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(baseOrder)
    prismaMock.orderReturn.findFirst.mockResolvedValueOnce({
      id: 'return_1',
      orderId: 'order_1',
      status: 'APPROVED',
      refundAmount: 10,
      refundMethod: 'original_payment',
      notes: null,
      items: [{ orderItemId: 'item_1', quantity: 1 }],
    })

    const app = Fastify()
    await app.register(orderRoutes, { prefix: '/orders' })

    const response = await app.inject({
      method: 'POST',
      url: '/orders/order_1/returns/return_1/refund',
      payload: { refundMethod: 'original_payment', refundAmount: 10 },
    })

    expect(response.statusCode).toBe(503)
    expect(response.json()).toMatchObject({ status: 'NOT_READY' })
    expect(issueBenefitPayRefund).not.toHaveBeenCalled()
  })

  it('executes manual refunds and syncs the order payment status', async () => {
    prismaMock.order.findUnique.mockResolvedValueOnce(baseOrder)
    prismaMock.orderReturn.findFirst.mockResolvedValueOnce({
      id: 'return_1',
      orderId: 'order_1',
      status: 'APPROVED',
      refundAmount: 10,
      refundMethod: 'manual',
      notes: 'Original note',
      items: [{ orderItemId: 'item_1', quantity: 1 }],
    })
    prismaMock.orderReturn.update.mockImplementationOnce(async ({ data }: any) => ({
      id: 'return_1',
      orderId: 'order_1',
      status: 'REFUNDED',
      refundAmount: data.refundAmount,
      refundMethod: data.refundMethod,
      notes: data.notes,
      items: [{ orderItemId: 'item_1', quantity: 1 }],
    }))
    prismaMock.orderReturn.findMany.mockResolvedValueOnce([{ refundAmount: 10 }])
    prismaMock.order.update.mockResolvedValueOnce({ id: 'order_1', paymentStatus: 'PARTIALLY_REFUNDED' })

    const app = Fastify()
    await app.register(orderRoutes, { prefix: '/orders' })

    const response = await app.inject({
      method: 'POST',
      url: '/orders/order_1/returns/return_1/refund',
      payload: { refundMethod: 'manual', refundAmount: 10, note: 'Processed manually', reference: 'REF-100' },
    })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      paymentStatus: 'PARTIALLY_REFUNDED',
      refundedAmount: 10,
      orderReturn: expect.objectContaining({
        status: 'REFUNDED',
        refundMethod: 'manual',
      }),
    })
    expect(prismaMock.order.update).toHaveBeenCalledWith({
      where: { id: 'order_1' },
      data: { status: 'DELIVERED', paymentStatus: 'PARTIALLY_REFUNDED' },
    })
  })
})

describe('merchant health growth engine contract tests', () => {
  it('returns structured recommendations and playbooks with execution routes', async () => {
    prismaMock.order.aggregate
      .mockResolvedValueOnce({ _sum: { total: 800 } })
      .mockResolvedValueOnce({ _sum: { total: 1200 } })
    prismaMock.order.count
      .mockResolvedValueOnce(40)
      .mockResolvedValueOnce(6)
    prismaMock.product.count
      .mockResolvedValueOnce(12)
      .mockResolvedValueOnce(4)
      .mockResolvedValueOnce(3)
    prismaMock.customer.count
      .mockResolvedValueOnce(50)
      .mockResolvedValueOnce(6)
    prismaMock.abandonedCart.count.mockResolvedValueOnce(18)
    prismaMock.whatsappCommerceConfig.findUnique.mockResolvedValueOnce({ isActive: false, updatedAt: new Date('2026-04-07T09:00:00.000Z') })
    prismaMock.liveStream.findMany.mockResolvedValueOnce([])
    prismaMock.coupon.count.mockResolvedValueOnce(0)
    prismaMock.pageView.count.mockResolvedValueOnce(500)
    prismaMock.pageView.groupBy.mockResolvedValueOnce([
      { source: 'social', _count: { id: 300 } },
      { source: 'search', _count: { id: 120 } },
      { source: 'direct', _count: { id: 80 } },
    ])

    const app = Fastify()
    await app.register(analyticsRoutes, { prefix: '/analytics' })

    const response = await app.inject({ method: 'GET', url: '/analytics/merchant-health?storeId=store_1' })

    expect(response.statusCode).toBe(200)
    expect(response.json()).toMatchObject({
      stage: expect.objectContaining({ key: 'scale' }),
      metrics: expect.objectContaining({
        trafficCount: 500,
        trafficToOrderRate: 8,
        repeatCustomerRate: 12,
      }),
      recommendations: expect.arrayContaining([
        expect.objectContaining({
          key: 'recover-demand',
          href: '/promotions',
          priority: 'urgent',
        }),
        expect.objectContaining({
          key: 'recover-abandoned-carts',
          href: '/whatsapp-commerce',
        }),
      ]),
      playbooks: expect.arrayContaining([
        expect.objectContaining({
          key: 'revenue-recovery-playbook',
          href: '/promotions',
        }),
      ]),
    })
  })
})