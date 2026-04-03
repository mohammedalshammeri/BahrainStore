import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── Multi-currency Routes ─────────────────────────────────────────────────────

export async function currencyRoutes(app: FastifyInstance) {
  // GET /currencies/rates — All cached exchange rates
  app.get('/rates', async (request, reply) => {
    const { base = 'BHD' } = request.query as { base?: string }

    const rates = await prisma.currencyRate.findMany({
      where: { baseCurrency: base },
      orderBy: { targetCurrency: 'asc' },
    })

    const rateMap: Record<string, number> = {}
    for (const r of rates) rateMap[r.targetCurrency] = Number(r.rate)

    return reply.send({ base, rates: rateMap, updatedAt: rates[0]?.updatedAt })
  })

  // POST /currencies/convert — Convert amount
  app.post('/convert', async (request, reply) => {
    const { amount, from, to } = request.body as { amount: number; from: string; to: string }

    if (from === to) return reply.send({ amount, from, to, converted: amount, rate: 1 })

    // Direct rate
    const rate = await prisma.currencyRate.findUnique({
      where: { baseCurrency_targetCurrency: { baseCurrency: from, targetCurrency: to } },
    })

    if (rate) {
      return reply.send({ amount, from, to, converted: amount * Number(rate.rate), rate: Number(rate.rate) })
    }

    // Try reverse
    const reverseRate = await prisma.currencyRate.findUnique({
      where: { baseCurrency_targetCurrency: { baseCurrency: to, targetCurrency: from } },
    })

    if (reverseRate) {
      const r = 1 / Number(reverseRate.rate)
      return reply.send({ amount, from, to, converted: amount * r, rate: r })
    }

    // Try via USD
    const fromUsd = await prisma.currencyRate.findUnique({
      where: { baseCurrency_targetCurrency: { baseCurrency: 'USD', targetCurrency: from } },
    })
    const toUsd = await prisma.currencyRate.findUnique({
      where: { baseCurrency_targetCurrency: { baseCurrency: 'USD', targetCurrency: to } },
    })

    if (fromUsd && toUsd) {
      const inUsd = amount / Number(fromUsd.rate)
      const result = inUsd * Number(toUsd.rate)
      return reply.send({ amount, from, to, converted: result, rate: result / amount })
    }

    return reply.status(404).send({ error: `لا يوجد سعر صرف لـ ${from} → ${to}` })
  })

  // POST /currencies/rates/update — Admin: update rates manually or via API
  app.post('/rates/update', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      base: z.string().default('BHD'),
      rates: z.record(z.string(), z.number()),
      source: z.string().default('manual'),
    })

    const result = schema.safeParse(request.body)
    if (!result.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })

    const { base, rates, source } = result.data
    const updated: string[] = []

    for (const [target, rate] of Object.entries(rates)) {
      await prisma.currencyRate.upsert({
        where: { baseCurrency_targetCurrency: { baseCurrency: base, targetCurrency: target } },
        update: { rate, source },
        create: { baseCurrency: base, targetCurrency: target, rate, source },
      })
      updated.push(target)
    }

    return reply.send({ message: `تم تحديث ${updated.length} عملة`, updated })
  })

  // GET /currencies/supported — Standard currencies list
  app.get('/supported', async (_request, reply) => {
    return reply.send({
      currencies: [
        { code: 'BHD', name: 'دينار بحريني', symbol: 'د.ب', flag: '🇧🇭' },
        { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', flag: '🇸🇦' },
        { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', flag: '🇦🇪' },
        { code: 'KWD', name: 'دينار كويتي', symbol: 'د.ك', flag: '🇰🇼' },
        { code: 'QAR', name: 'ريال قطري', symbol: 'ر.ق', flag: '🇶🇦' },
        { code: 'OMR', name: 'ريال عُماني', symbol: 'ر.ع', flag: '🇴🇲' },
        { code: 'USD', name: 'دولار أمريكي', symbol: '$', flag: '🇺🇸' },
        { code: 'EUR', name: 'يورو', symbol: '€', flag: '🇪🇺' },
        { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', flag: '🇬🇧' },
        { code: 'EGP', name: 'جنيه مصري', symbol: 'ج.م', flag: '🇪🇬' },
        { code: 'JOD', name: 'دينار أردني', symbol: 'د.أ', flag: '🇯🇴' },
      ],
    })
  })

  // PATCH /currencies/store-settings — Update store's supported currencies
  app.patch('/store-settings', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, supportedCurrencies } = request.body as {
      storeId: string; supportedCurrencies: string[]
    }

    const merchantId = (request.user as any).id
    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.storeSettings.upsert({
      where: { storeId },
      update: { supportedCurrencies },
      create: {
        storeId,
        supportedCurrencies,
      },
    })

    return reply.send({ message: 'تم تحديث العملات المدعومة', supportedCurrencies })
  })
}
