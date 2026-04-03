import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

// ─── WhatsApp Commerce Bot ────────────────────────────────────────────────────
// Full shopping experience through WhatsApp Business API
// State machine: GREETING → BROWSING → PRODUCT_VIEW → CART → CHECKOUT → PAYMENT → DONE

const WA_API_VERSION = 'v18.0'

// ─── Helper: send WhatsApp message ───────────────────────────────────────────
async function sendWAMessage(
  phoneNumberId: string,
  accessToken: string,
  to: string,
  content: any,
): Promise<boolean> {
  try {
    const phone = to.replace(/\D/g, '')
    const fullPhone = phone.startsWith('973') ? phone : `973${phone}`
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: fullPhone, ...content }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Helper: send text message ────────────────────────────────────────────────
async function sendText(phoneNumberId: string, token: string, to: string, text: string) {
  return sendWAMessage(phoneNumberId, token, to, { type: 'text', text: { body: text } })
}

// ─── Helper: send interactive button message ─────────────────────────────────
async function sendButtons(
  phoneNumberId: string,
  token: string,
  to: string,
  bodyText: string,
  buttons: Array<{ id: string; title: string }>,
  headerText?: string,
) {
  return sendWAMessage(phoneNumberId, token, to, {
    type: 'interactive',
    interactive: {
      type: 'button',
      header: headerText ? { type: 'text', text: headerText } : undefined,
      body: { text: bodyText },
      action: { buttons: buttons.map((b) => ({ type: 'reply', reply: { id: b.id, title: b.title.slice(0, 20) } })) },
    },
  })
}

// ─── Helper: send product list ───────────────────────────────────────────────
async function sendProductList(
  phoneNumberId: string,
  token: string,
  to: string,
  storeName: string,
  products: Array<{ id: string; name: string; price: number; currency: string; stock: number }>,
) {
  if (products.length === 0) {
    return sendText(phoneNumberId, token, to, '😔 لم أجد منتجات متاحة حالياً.')
  }

  const productLines = products.slice(0, 10).map((p, i) =>
    `${i + 1}. *${p.name}*\n💰 السعر: ${p.price.toFixed(3)} ${p.currency}${p.stock === 0 ? '\n❌ غير متاح' : p.stock <= 5 ? `\n⚠️ متبقي ${p.stock} فقط` : ''}`,
  )

  const message = `🛍️ *${storeName}* — المنتجات المتاحة\n\n${productLines.join('\n\n')}\n\n📝 اكتب رقم المنتج لمشاهدة تفاصيله`
  return sendText(phoneNumberId, token, to, message)
}

// ─── FSM: Process incoming WhatsApp message ───────────────────────────────────
async function processMessage(
  session: any,
  config: any,
  store: any,
  from: string,
  messageText: string,
  interactiveReplyId?: string,
): Promise<void> {
  const text = (interactiveReplyId || messageText).trim().toLowerCase()
  const { phoneNumberId, accessToken } = config
  const currency = store.currency || 'BHD'
  const storeName = store.nameAr || store.name

  // ─── State: GREETING ─────────────────────────────────────────────────────
  if (session.state === 'GREETING' || text === 'start' || text === 'مرحبا' || text === 'هلا' || text === 'السلام عليكم') {
    await sendButtons(phoneNumberId, accessToken, from,
      `🌟 أهلاً وسهلاً في *${storeName}*!\nكيف يمكنني مساعدتك؟`,
      [
        { id: 'browse', title: '🛍️ تصفح المنتجات' },
        { id: 'search', title: '🔍 ابحث عن منتج' },
        { id: 'orders', title: '📦 طلباتي' },
      ],
      storeName,
    )
    await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { state: 'MAIN_MENU' } })
    return
  }

  // ─── Interactive replies ──────────────────────────────────────────────────
  if (interactiveReplyId) {
    if (interactiveReplyId === 'browse') {
      const products = await prisma.product.findMany({
        where: { storeId: store.id, isActive: true, stock: { gt: 0 } },
        orderBy: { isFeatured: 'desc' },
        take: 10,
        select: { id: true, name: true, nameAr: true, price: true, stock: true },
      })
      await sendProductList(phoneNumberId, accessToken, from, storeName,
        products.map((p) => ({ id: p.id, name: p.nameAr || p.name, price: Number(p.price), currency, stock: p.stock })),
      )
      await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { state: 'BROWSING' } })
      return
    }

    if (interactiveReplyId === 'search') {
      await sendText(phoneNumberId, accessToken, from, '🔍 اكتب اسم المنتج الذي تبحث عنه:')
      await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { state: 'SEARCHING' } })
      return
    }

    if (interactiveReplyId === 'orders') {
      if (session.customerId) {
        const orders = await prisma.order.findMany({
          where: { customerId: session.customerId },
          orderBy: { createdAt: 'desc' },
          take: 5,
          select: { orderNumber: true, total: true, status: true, createdAt: true },
        })
        if (orders.length === 0) {
          await sendText(phoneNumberId, accessToken, from, '📦 لم تقم بأي طلبات بعد.')
        } else {
          const orderLines = orders.map((o) =>
            `🧾 #${o.orderNumber} — ${Number(o.total).toFixed(3)} ${currency}\nالحالة: ${translateOrderStatus(o.status)}\nالتاريخ: ${o.createdAt.toLocaleDateString('ar-BH')}`,
          )
          await sendText(phoneNumberId, accessToken, from, `📦 *طلباتك الأخيرة:*\n\n${orderLines.join('\n\n')}`)
        }
      } else {
        await sendText(phoneNumberId, accessToken, from, '👤 للاطلاع على طلباتك، يرجى تسجيل الدخول عبر المتجر أولاً.')
      }
      return
    }

    if (interactiveReplyId === 'add_to_cart') {
      // handled below in PRODUCT_VIEW state
    }

    if (interactiveReplyId === 'view_cart') {
      await handleViewCart(session, config, store, from, currency)
      return
    }

    if (interactiveReplyId === 'checkout') {
      await handleCheckout(session, config, store, from, currency)
      return
    }

    if (interactiveReplyId === 'clear_cart') {
      await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { cartItems: [], state: 'MAIN_MENU' } })
      await sendText(phoneNumberId, accessToken, from, '🗑️ تم تفريغ السلة. أرسل "مرحبا" للعودة للقائمة الرئيسية.')
      return
    }

    if (interactiveReplyId === 'main_menu') {
      await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { state: 'GREETING' } })
      // recurse to show main menu
      await processMessage(session, config, store, from, 'start', undefined)
      return
    }
  }

  // ─── State: SEARCHING ────────────────────────────────────────────────────
  if (session.state === 'SEARCHING') {
    const products = await prisma.product.findMany({
      where: {
        storeId: store.id,
        isActive: true,
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { nameAr: { contains: text, mode: 'insensitive' } },
        ],
      },
      take: 10,
      select: { id: true, name: true, nameAr: true, price: true, stock: true },
    })

    if (products.length === 0) {
      await sendButtons(phoneNumberId, accessToken, from, `😔 لم أجد منتجات تطابق "*${messageText}*"`, [
        { id: 'browse', title: '🛍️ تصفح الكل' },
        { id: 'main_menu', title: '🏠 القائمة الرئيسية' },
      ])
    } else {
      await sendProductList(phoneNumberId, accessToken, from, storeName,
        products.map((p) => ({ id: p.id, name: p.nameAr || p.name, price: Number(p.price), currency, stock: p.stock })),
      )
      await prisma.whatsappCommerceSession.update({
        where: { id: session.id },
        data: { state: 'BROWSING', metadata: JSON.stringify(products.map((p) => p.id)) } as any,
      })
    }
    return
  }

  // ─── State: BROWSING — user types product number ──────────────────────────
  if (session.state === 'BROWSING') {
    const num = parseInt(text)
    if (!isNaN(num) && num >= 1) {
      // Get the nth product
      const products = await prisma.product.findMany({
        where: { storeId: store.id, isActive: true, stock: { gt: 0 } },
        orderBy: { isFeatured: 'desc' },
        skip: num - 1,
        take: 1,
        select: { id: true, name: true, nameAr: true, price: true, comparePrice: true, stock: true, description: true, descriptionAr: true },
      })

      if (!products[0]) {
        await sendText(phoneNumberId, accessToken, from, '❌ رقم غير صحيح. اكتب رقم المنتج من القائمة.')
        return
      }

      const product = products[0]
      const oldPrice = product.comparePrice && Number(product.comparePrice) > Number(product.price)
        ? `\n~~${Number(product.comparePrice).toFixed(3)} ${currency}~~`
        : ''
      const desc = product.descriptionAr || product.description || ''
      const productMsg = `🛍️ *${product.nameAr || product.name}*\n\n💰 السعر: *${Number(product.price).toFixed(3)} ${currency}*${oldPrice}\n\n${desc.slice(0, 200)}\n\n📦 المخزون: ${product.stock} متاح`

      await sendButtons(phoneNumberId, accessToken, from, productMsg, [
        { id: `add_${product.id}`, title: '🛒 أضف للسلة' },
        { id: 'view_cart', title: '🛒 عرض السلة' },
        { id: 'browse', title: '⬅️ رجوع للمنتجات' },
      ])
      await prisma.whatsappCommerceSession.update({ where: { id: session.id }, data: { state: 'PRODUCT_VIEW' } })
      return
    }
  }

  // ─── Handle add to cart ───────────────────────────────────────────────────
  if (interactiveReplyId?.startsWith('add_') || text.startsWith('add_')) {
    const productId = (interactiveReplyId || text).replace('add_', '')
    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: store.id, isActive: true },
      select: { id: true, name: true, nameAr: true, price: true, stock: true },
    })

    if (!product) {
      await sendText(phoneNumberId, accessToken, from, '❌ المنتج غير متاح.')
      return
    }

    const cart: Array<{ productId: string; name: string; price: number; qty: number }> = Array.isArray(session.cartItems) ? session.cartItems : []
    const existing = cart.find((c) => c.productId === productId)

    if (existing) {
      existing.qty += 1
    } else {
      cart.push({ productId: product.id, name: product.nameAr || product.name, price: Number(product.price), qty: 1 })
    }

    await prisma.whatsappCommerceSession.update({
      where: { id: session.id },
      data: { cartItems: cart as any, state: 'CART' },
    })

    const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
    await sendButtons(phoneNumberId, accessToken, from,
      `✅ تمت الإضافة!\n\n🛒 *السلة* (${cart.length} منتج)\nالإجمالي: *${total.toFixed(3)} ${currency}*`,
      [
        { id: 'checkout', title: '💳 إتمام الشراء' },
        { id: 'browse', title: '🛍️ تسوق أكثر' },
        { id: 'view_cart', title: '🛒 عرض السلة' },
      ],
    )
    return
  }

  // ─── View cart ────────────────────────────────────────────────────────────
  if (text === 'cart' || text === 'سلة' || text === 'السلة') {
    await handleViewCart(session, config, store, from, currency)
    return
  }

  // ─── Default: show help ───────────────────────────────────────────────────
  await sendButtons(phoneNumberId, accessToken, from,
    '😊 أنا هنا لمساعدتك! اختر من القائمة:',
    [
      { id: 'browse', title: '🛍️ تصفح المنتجات' },
      { id: 'view_cart', title: '🛒 سلتي' },
      { id: 'orders', title: '📦 طلباتي' },
    ],
  )
}

async function handleViewCart(session: any, config: any, store: any, from: string, currency: string) {
  const { phoneNumberId, accessToken } = config
  const cart: Array<{ productId: string; name: string; price: number; qty: number }> = Array.isArray(session.cartItems) ? session.cartItems : []

  if (cart.length === 0) {
    await sendButtons(phoneNumberId, accessToken, from, '🛒 سلتك فارغة!', [
      { id: 'browse', title: '🛍️ تصفح المنتجات' },
    ])
    return
  }

  const lines = cart.map((c) => `• ${c.name} × ${c.qty} = ${(c.price * c.qty).toFixed(3)} ${currency}`)
  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const cartMsg = `🛒 *سلة التسوق:*\n\n${lines.join('\n')}\n\n💰 *الإجمالي: ${total.toFixed(3)} ${currency}*`

  await sendButtons(phoneNumberId, accessToken, from, cartMsg, [
    { id: 'checkout', title: '💳 إتمام الشراء' },
    { id: 'browse', title: '🛍️ إضافة منتجات' },
    { id: 'clear_cart', title: '🗑️ تفريغ السلة' },
  ])
}

async function handleCheckout(session: any, config: any, store: any, from: string, currency: string) {
  const { phoneNumberId, accessToken } = config
  const cart: Array<{ productId: string; name: string; price: number; qty: number }> = Array.isArray(session.cartItems) ? session.cartItems : []

  if (cart.length === 0) {
    await sendText(phoneNumberId, accessToken, from, '🛒 السلة فارغة. أضف منتجات أولاً.')
    return
  }

  const total = cart.reduce((s, c) => s + c.price * c.qty, 0)
  const checkoutUrl = `https://${store.subdomain || store.slug}.bazar.bh/checkout?wa=1`

  const msg = `🎉 *إتمام الشراء*\n\nإجمالي طلبك: *${total.toFixed(3)} ${currency}*\n\nلإتمام الدفع بشكل آمن، اضغط على الرابط:\n${checkoutUrl}\n\n📌 سيتم حفظ سلتك تلقائياً.`
  await sendText(phoneNumberId, accessToken, from, msg)
}

function translateOrderStatus(status: string): string {
  const map: Record<string, string> = {
    PENDING: 'قيد الانتظار', CONFIRMED: 'مؤكد', PROCESSING: 'قيد التجهيز',
    SHIPPED: 'تم الشحن', DELIVERED: 'تم التوصيل', CANCELLED: 'ملغي', REFUNDED: 'مسترجع',
  }
  return map[status] || status
}

export async function whatsappCommerceRoutes(app: FastifyInstance) {
  // ─── GET /whatsapp-commerce/webhook — Verify webhook ─────────────────────
  app.get('/webhook', async (request, reply) => {
    const { 'hub.mode': mode, 'hub.challenge': challenge, 'hub.verify_token': verifyToken, storeId } = request.query as any

    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const config = await prisma.whatsappCommerceConfig.findUnique({ where: { storeId } })
    if (!config) return reply.status(404).send({ error: 'WhatsApp Commerce غير مُفعَّل' })

    if (mode === 'subscribe' && verifyToken === config.verifyToken) {
      return reply.send(parseInt(challenge))
    }
    return reply.status(403).send({ error: 'فشل التحقق' })
  })

  // ─── POST /whatsapp-commerce/webhook — Receive messages ──────────────────
  app.post('/webhook', async (request, reply) => {
    const body = request.body as any
    if (body?.object !== 'whatsapp_business_account') return reply.send({ status: 'ok' })

    const entries = body?.entry || []
    for (const entry of entries) {
      const changes = entry?.changes || []
      for (const change of changes) {
        const value = change?.value
        if (!value?.messages?.length) continue

        const phoneNumberId = value.metadata?.phone_number_id
        const message = value.messages[0]
        const from = message.from
        const msgText = message?.text?.body || ''
        const interactiveReplyId = message?.interactive?.button_reply?.id || message?.interactive?.list_reply?.id

        // Find store by phoneNumberId
        const config = await prisma.whatsappCommerceConfig.findFirst({
          where: { phoneNumberId, isActive: true },
        })
        if (!config) continue

        const store = await prisma.store.findUnique({
          where: { id: config.storeId },
          select: { id: true, name: true, nameAr: true, currency: true, subdomain: true, slug: true },
        })
        if (!store) continue

        // Get or create session
        let session = await prisma.whatsappCommerceSession.findUnique({
          where: { storeId_phone: { storeId: store.id, phone: from } },
        })

        if (!session) {
          // Find customer by phone
          const customer = await prisma.customer.findFirst({ where: { storeId: store.id, phone: from } })
          session = await prisma.whatsappCommerceSession.create({
            data: { storeId: store.id, phone: from, state: 'GREETING', cartItems: [], customerId: customer?.id },
          })
        }

        // Update last message time
        await prisma.whatsappCommerceSession.update({
          where: { id: session.id },
          data: { lastMessageAt: new Date() },
        })

        // Process message
        await processMessage(session, config, store, from, msgText, interactiveReplyId)
      }
    }

    return reply.send({ status: 'ok' })
  })

  // ─── GET /whatsapp-commerce/config ────────────────────────────────────────
  app.get('/config', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const config = await prisma.whatsappCommerceConfig.findUnique({
      where: { storeId },
      select: { id: true, storeId: true, phoneNumberId: true, isActive: true, welcomeMessage: true, createdAt: true },
    })
    return reply.send({ config })
  })

  // ─── POST /whatsapp-commerce/config ───────────────────────────────────────
  app.post('/config', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      phoneNumberId: z.string().min(1),
      accessToken: z.string().min(1),
      verifyToken: z.string().min(8),
      welcomeMessage: z.string().optional(),
      isActive: z.boolean().default(true),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة', details: parsed.error.flatten() })

    const config = await prisma.whatsappCommerceConfig.upsert({
      where: { storeId: parsed.data.storeId },
      update: parsed.data,
      create: parsed.data,
    })
    return reply.send({ success: true, config: { ...config, accessToken: '***' } })
  })

  // ─── GET /whatsapp-commerce/sessions ──────────────────────────────────────
  app.get('/sessions', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, page = '1', limit = '20' } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const skip = (parseInt(page) - 1) * parseInt(limit)
    const [sessions, total] = await Promise.all([
      prisma.whatsappCommerceSession.findMany({
        where: { storeId },
        orderBy: { lastMessageAt: 'desc' },
        skip,
        take: parseInt(limit),
      }),
      prisma.whatsappCommerceSession.count({ where: { storeId } }),
    ])

    return reply.send({ sessions, total, page: parseInt(page), totalPages: Math.ceil(total / parseInt(limit)) })
  })

  // ─── GET /whatsapp-commerce/stats ─────────────────────────────────────────
  app.get('/stats', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.query as any
    if (!storeId) return reply.status(400).send({ error: 'storeId مطلوب' })

    const [totalSessions, activeSessions, activeCartsCount] = await Promise.all([
      prisma.whatsappCommerceSession.count({ where: { storeId } }),
      prisma.whatsappCommerceSession.count({
        where: { storeId, lastMessageAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
      }),
      prisma.whatsappCommerceSession.count({ where: { storeId, state: 'CART' } }),
    ])

    return reply.send({ totalSessions, activeSessions, activeCartsCount })
  })

  // ─── POST /whatsapp-commerce/broadcast ────────────────────────────────────
  // Send a broadcast message to all opted-in customers
  app.post('/broadcast', { preHandler: authenticate }, async (request, reply) => {
    const schema = z.object({
      storeId: z.string(),
      message: z.string().min(10).max(1000),
      targetAll: z.boolean().default(false),
      phones: z.array(z.string()).optional(),
    })

    const parsed = schema.safeParse(request.body)
    if (!parsed.success) return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    const { storeId, message, targetAll, phones } = parsed.data

    const config = await prisma.whatsappCommerceConfig.findUnique({ where: { storeId } })
    if (!config || !config.isActive) return reply.status(400).send({ error: 'WhatsApp Commerce غير مُفعَّل' })

    let targetPhones: string[] = []
    if (targetAll) {
      const sessions = await prisma.whatsappCommerceSession.findMany({
        where: { storeId },
        select: { phone: true },
      })
      targetPhones = sessions.map((s) => s.phone)
    } else {
      targetPhones = phones || []
    }

    let sent = 0
    let failed = 0
    for (const phone of targetPhones.slice(0, 100)) { // max 100 at a time
      const ok = await sendText(config.phoneNumberId, config.accessToken, phone, message)
      if (ok) sent++
      else failed++
    }

    return reply.send({ success: true, sent, failed, total: targetPhones.length })
  })
}
