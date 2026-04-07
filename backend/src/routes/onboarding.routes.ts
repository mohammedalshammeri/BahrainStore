import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { callOpenAI, aiErrorReply, buildAICapabilities, getAICapabilityState, isAIConfigured } from '../lib/ai-provider'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const onboardingQuestionnaireSchema = z.object({
  storeId: z.string().cuid(),
  merchantType: z.enum(['beginner', 'migrating', 'expert']).default('beginner'),
  businessType: z.string().min(2),
  catalogSource: z.enum(['scratch', 'existing-store', 'spreadsheet']).default('scratch'),
  primaryGoal: z.string().min(2),
  targetCountries: z.array(z.string().min(2)).min(1),
  brandTone: z.string().min(2),
  monthlyOrdersRange: z.enum(['0-50', '51-200', '201-500', '500+']).default('0-50'),
  wantsCashOnDelivery: z.boolean().default(false),
  wantsArabicContent: z.boolean().default(true),
  freeShippingThreshold: z.number().min(0).optional(),
})

const onboardingApplySchema = z.object({
  storeId: z.string().cuid(),
  draft: z.object({
    store: z.object({
      description: z.string().optional(),
      descriptionAr: z.string().optional(),
      currency: z.string().min(3).max(3),
      language: z.enum(['AR', 'EN', 'BOTH']),
      timezone: z.string().min(2),
    }),
    settings: z.object({
      freeShippingMin: z.number().min(0).nullable(),
      allowReviews: z.boolean(),
      showOutOfStock: z.boolean(),
      tapEnabled: z.boolean(),
      moyasarEnabled: z.boolean(),
      benefitEnabled: z.boolean(),
    }),
  }),
})

function summarizeSteps(store: any) {
  const step1Done = !!(store.nameAr && store.logo && store.settings?.primaryColor)
  const step2Done = store._count.products > 0
  const step3Done = !!store.logo
  const step4Done = !!(store.settings?.tapEnabled || store.settings?.moyasarEnabled || store.settings?.benefitEnabled)
  const step5Done = store.settings?.freeShippingMin !== null && store.settings?.freeShippingMin !== undefined

  const steps = [
    { id: 1, titleAr: 'معلومات المتجر', desc: 'أضف اسم ووصف وشعار متجرك', done: step1Done },
    { id: 2, titleAr: 'أضف أول منتج', desc: 'أضف منتجاً واحداً على الأقل', done: step2Done },
    { id: 3, titleAr: 'العلامة التجارية', desc: 'ارفع شعار متجرك وأيقونته', done: step3Done },
    { id: 4, titleAr: 'طريقة الدفع', desc: 'فعّل بوابة دفع واحدة على الأقل', done: step4Done },
    { id: 5, titleAr: 'الشحن والتوصيل', desc: 'حدد إعدادات الشحن', done: step5Done },
  ]

  return {
    steps,
    stepFlags: { step1Done, step2Done, step3Done, step4Done, step5Done },
    completedCount: steps.filter((step) => step.done).length,
    isComplete: steps.every((step) => step.done),
  }
}

function buildOnboardingDraft(store: any, input: z.infer<typeof onboardingQuestionnaireSchema>) {
  const isSaudiFocused = input.targetCountries.includes('SA') && input.targetCountries.length === 1
  const currency = isSaudiFocused ? 'SAR' : 'BHD'
  const paymentMethods = [
    { key: 'tapEnabled', label: 'Tap Payments', reason: 'مفيد لبطاقات الخليج وApple Pay وKNET عند جاهزية الاعتمادات.' },
    { key: 'moyasarEnabled', label: 'Moyasar', reason: 'مناسب للتجار الذين يركزون على المدفوعات المحلية السريعة في الخليج.' },
    { key: 'benefitEnabled', label: 'Benefit Pay', reason: 'مهم جداً للتجار الذين يستهدفون البحرين بشكل أساسي.' },
  ]

  const enabledPayments = paymentMethods.filter((method) => {
    if (method.key === 'benefitEnabled') return input.targetCountries.includes('BH')
    if (method.key === 'moyasarEnabled') return input.targetCountries.includes('SA') || input.targetCountries.includes('BH')
    return true
  })

  const checklist = [
    'راجع وصف المتجر وسياسة الشحن قبل النشر.',
    input.catalogSource === 'scratch' ? 'ابدأ بإضافة 10 منتجات أساسية قبل أول حملة تسويقية.' : 'انتقل إلى مركز الاستيراد لمراجعة الكتالوج قبل الاعتماد النهائي.',
    input.wantsCashOnDelivery ? 'حدد شروط الدفع عند الاستلام بوضوح في صفحة الشحن والدفع.' : 'اختر البوابة الأنسب لرفع معدل الدفع الإلكتروني من أول أسبوع.',
    'فعّل التتبع والتحليلات بعد أول عملية نشر للمتجر.',
  ]

  return {
    merchantType: input.merchantType,
    profile: {
      businessType: input.businessType,
      primaryGoal: input.primaryGoal,
      brandTone: input.brandTone,
      targetCountries: input.targetCountries,
      monthlyOrdersRange: input.monthlyOrdersRange,
      catalogSource: input.catalogSource,
    },
    store: {
      description: `Built for ${input.businessType} merchants focusing on ${input.primaryGoal}.`,
      descriptionAr: `متجر ${input.businessType} مصمم ليركز على ${input.primaryGoal} مع تجربة تناسب ${input.targetCountries.join('، ')}.`,
      currency,
      language: input.wantsArabicContent ? 'BOTH' as const : 'EN' as const,
      timezone: input.targetCountries.includes('SA') ? 'Asia/Riyadh' : 'Asia/Bahrain',
    },
    settings: {
      freeShippingMin: input.freeShippingThreshold ?? (input.monthlyOrdersRange === '0-50' ? 25 : 40),
      allowReviews: true,
      showOutOfStock: true,
      tapEnabled: enabledPayments.some((method) => method.key === 'tapEnabled'),
      moyasarEnabled: enabledPayments.some((method) => method.key === 'moyasarEnabled'),
      benefitEnabled: enabledPayments.some((method) => method.key === 'benefitEnabled'),
    },
    recommendations: {
      payments: enabledPayments,
      shipping: {
        model: input.wantsCashOnDelivery ? 'hybrid-cod-prepaid' : 'prepaid-first',
        freeShippingThreshold: input.freeShippingThreshold ?? (input.monthlyOrdersRange === '0-50' ? 25 : 40),
        reason: input.wantsCashOnDelivery
          ? 'ابدأ بنموذج هجين يجمع الدفع الإلكتروني والدفع عند الاستلام لتقليل فقد الطلبات.'
          : 'البدء بالدفع المسبق يرفع جودة الطلبات ويقلل العبء التشغيلي.' ,
      },
      catalog: {
        mode: input.catalogSource,
        reason: input.catalogSource === 'scratch'
          ? 'ابدأ بكتالوج صغير عالي الجودة ثم وسّعه بعد أول إشارات طلب حقيقية.'
          : 'استخدم مركز الاستيراد الذكي لمراجعة الأعمدة والازدواجيات قبل الكتابة إلى قاعدة البيانات.',
      },
    },
    checklist,
    summary: `المتجر يحتاج إلى إعداد وصف واضح، تفعيل وسائل الدفع المناسبة، وضبط حد الشحن المجاني قبل الإطلاق.`,
  }
}

async function resolveLatestDraft(storeId: string) {
  const entries = await prisma.aiChat.findMany({
    where: { storeId, role: 'assistant' },
    orderBy: { createdAt: 'desc' },
    take: 20,
  })

  return entries.find((entry) => {
    const metadata = entry.metadata as any
    return metadata?.workflow === 'onboarding-workspace'
  })
}

export async function onboardingRoutes(app: FastifyInstance) {

  // Get onboarding progress
  app.get('/', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { onboarding: true, settings: true, _count: { select: { products: true, orders: true } } },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const summary = summarizeSteps(store)

    const onboarding = store.onboarding ?? await prisma.onboarding.upsert({
      where: { storeId },
      update: {},
      create: { storeId, ...summary.stepFlags },
    })

    return reply.send({ steps: summary.steps, completedCount: summary.completedCount, isComplete: summary.isComplete, onboarding })
  })

  app.get('/workspace', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as { storeId?: string }
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { onboarding: true, settings: true, _count: { select: { products: true, orders: true, customers: true } } },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const summary = summarizeSteps(store)
    const latestDraft = await resolveLatestDraft(storeId)

    return reply.send({
      store: {
        id: store.id,
        name: store.name,
        nameAr: store.nameAr,
        currency: store.currency,
        language: store.language,
        timezone: store.timezone,
        descriptionAr: store.descriptionAr,
      },
      progress: summary,
      currentStats: {
        products: store._count.products,
        orders: store._count.orders,
        customers: store._count.customers,
      },
      latestDraft: latestDraft
        ? {
            createdAt: latestDraft.createdAt,
            message: latestDraft.message,
            payload: (latestDraft.metadata as any)?.draft ?? null,
            questionnaire: (latestDraft.metadata as any)?.questionnaire ?? null,
          }
        : null,
      capability: buildAICapabilities({
        onboardingAssistant: { label: 'المساعد الذكي للإعداد' },
      }),
    })
  })

  app.post('/workspace/draft', { preHandler: authenticate }, async (request, reply) => {
    const parsed = onboardingQuestionnaireSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات الإعداد الذكي غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const input = parsed.data
    const store = await prisma.store.findFirst({
      where: { id: input.storeId, merchantId },
      include: { settings: true, _count: { select: { products: true, orders: true } } },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const draft = buildOnboardingDraft(store, input)
    let aiSummary: string | null = null
    let usedAI = false

    if (isAIConfigured()) {
      try {
        const aiResponse = await callOpenAI([
          {
            role: 'system',
            content: 'أنت مستشار onboarding لمنصة تجارة إلكترونية خليجية. اكتب ملخصاً عملياً جداً من 4-6 أسطر بالعربية الفصحى يشرح لماذا هذه التوصيات مناسبة للتاجر، بدون مبالغة.',
          },
          {
            role: 'user',
            content: JSON.stringify({ store: { name: store.nameAr || store.name, currency: store.currency }, questionnaire: input, draft }),
          },
        ], undefined, 500)
        aiSummary = aiResponse.trim()
        usedAI = true
      } catch (error) {
        if (getAICapabilityState() !== 'unavailable') {
          request.log.warn({ error }, 'Onboarding AI summary failed; returning deterministic draft')
        }
      }
    }

    const payload = {
      workflow: 'onboarding-workspace',
      questionnaire: input,
      draft: {
        ...draft,
        aiSummary,
      },
    }

    await prisma.aiChat.create({
      data: {
        storeId: input.storeId,
        role: 'assistant',
        message: 'onboarding-workspace-draft',
        metadata: payload,
      },
    })

    return reply.send({
      draft: payload.draft,
      usedAI,
      capability: buildAICapabilities({ onboardingAssistant: { label: 'المساعد الذكي للإعداد' } }),
    })
  })

  app.post('/workspace/apply', { preHandler: authenticate }, async (request, reply) => {
    const parsed = onboardingApplySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.status(400).send({ error: 'بيانات تطبيق الإعداد غير صحيحة', details: parsed.error.flatten().fieldErrors })
    }

    const merchantId = (request.user as any).id
    const { storeId, draft } = parsed.data
    const store = await prisma.store.findFirst({
      where: { id: storeId, merchantId },
      include: { settings: true },
    })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const warnings: string[] = []
    const currentSettings = store.settings
    const nextSettings = {
      ...draft.settings,
      tapEnabled: draft.settings.tapEnabled && Boolean(currentSettings?.tapSecretKey && currentSettings?.tapPublicKey),
      moyasarEnabled: draft.settings.moyasarEnabled && Boolean(currentSettings?.moyasarSecretKey && currentSettings?.moyasarPublicKey),
      benefitEnabled: draft.settings.benefitEnabled && Boolean(currentSettings?.benefitMerchantId && currentSettings?.benefitApiKey),
    }

    if (draft.settings.tapEnabled && !nextSettings.tapEnabled) warnings.push('تم الإبقاء على Tap غير مفعّل لأن الاعتمادات غير مكتملة بعد.')
    if (draft.settings.moyasarEnabled && !nextSettings.moyasarEnabled) warnings.push('تم الإبقاء على Moyasar غير مفعّل لأن الاعتمادات غير مكتملة بعد.')
    if (draft.settings.benefitEnabled && !nextSettings.benefitEnabled) warnings.push('تم الإبقاء على Benefit Pay غير مفعّل لأن الاعتمادات غير مكتملة بعد.')

    const updatedStore = await prisma.store.update({
      where: { id: storeId },
      data: {
        description: draft.store.description,
        descriptionAr: draft.store.descriptionAr,
        currency: draft.store.currency,
        language: draft.store.language,
        timezone: draft.store.timezone,
      },
    })

    const updatedSettings = await prisma.storeSettings.upsert({
      where: { storeId },
      update: nextSettings,
      create: { storeId, ...nextSettings },
    })

    const progressSnapshot = summarizeSteps({
      ...store,
      ...updatedStore,
      settings: updatedSettings,
      _count: { products: 0, orders: 0 },
    })

    const onboarding = await prisma.onboarding.upsert({
      where: { storeId },
      update: progressSnapshot.stepFlags,
      create: { storeId, ...progressSnapshot.stepFlags },
    })

    return reply.send({
      message: 'تم تطبيق مسودة الإعداد الذكي',
      warnings,
      store: updatedStore,
      settings: updatedSettings,
      onboarding,
      capability: buildAICapabilities({ onboardingAssistant: { label: 'المساعد الذكي للإعداد' } }),
    })
  })

  // Mark a step as done/undone manually
  app.patch('/step', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string().cuid(),
      step: z.number().int().min(1).max(5),
      done: z.boolean(),
    })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId, step, done } = result.data

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const field = `step${step}Done` as any

    const onboarding = await prisma.onboarding.upsert({
      where: { storeId },
      update: { [field]: done },
      create: { storeId, [field]: done },
    })
    return reply.send({ onboarding })
  })

  // Skip onboarding
  app.post('/skip', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({ storeId: z.string().cuid() })
    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const merchantId = (request.user as any).id
    const { storeId } = result.data
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.onboarding.upsert({
      where: { storeId },
      update: { skippedAt: new Date() },
      create: { storeId, skippedAt: new Date() },
    })
    return reply.send({ message: 'تم تخطي الإعداد' })
  })
}
