import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'

const registerSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  phone: z.string().min(8, 'رقم الهاتف غير صحيح'),
  password: z.string().min(8, 'كلمة المرور يجب أن تكون 8 أحرف على الأقل'),
  firstName: z.string().min(2, 'الاسم الأول مطلوب'),
  lastName: z.string().min(2, 'اسم العائلة مطلوب'),
})

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

const refreshSchema = z.object({
  refreshToken: z.string().min(1),
})

export async function authRoutes(app: FastifyInstance) {
  // ── Register ──────────────────────────────────
  app.post('/register', async (request, reply) => {
    const result = registerSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({
        error: 'بيانات غير صحيحة',
        details: result.error.flatten().fieldErrors,
      })
    }

    const { email, phone, password, firstName, lastName } = result.data

    const existing = await prisma.merchant.findFirst({
      where: { OR: [{ email }, { phone }] },
    })

    if (existing) {
      return reply.status(409).send({
        error: existing.email === email
          ? 'البريد الإلكتروني مستخدم بالفعل'
          : 'رقم الهاتف مستخدم بالفعل',
      })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    const merchant = await prisma.merchant.create({
      data: { email, phone, passwordHash, firstName, lastName },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, createdAt: true },
    })

    const { accessToken, refreshToken } = await generateTokens(app, merchant.id)

    return reply.status(201).send({
      message: 'تم إنشاء الحساب بنجاح',
      merchant,
      accessToken,
      refreshToken,
    })
  })

  // ── Login ─────────────────────────────────────
  app.post('/login', async (request, reply) => {
    const result = loginSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'بيانات غير صحيحة' })
    }

    const { email, password } = result.data

    const merchant = await prisma.merchant.findUnique({ where: { email } })

    if (!merchant || !(await bcrypt.compare(password, merchant.passwordHash))) {
      return reply.status(401).send({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' })
    }

    if (!merchant.isActive) {
      return reply.status(403).send({ error: 'الحساب موقوف، تواصل مع الدعم' })
    }

    const { accessToken, refreshToken } = await generateTokens(app, merchant.id)

    return reply.send({
      message: 'تم تسجيل الدخول بنجاح',
      merchant: {
        id: merchant.id,
        email: merchant.email,
        phone: merchant.phone,
        firstName: merchant.firstName,
        lastName: merchant.lastName,
      },
      accessToken,
      refreshToken,
    })
  })

  // ── Refresh Token ─────────────────────────────
  app.post('/refresh', async (request, reply) => {
    const result = refreshSchema.safeParse(request.body)
    if (!result.success) {
      return reply.status(400).send({ error: 'الرمز المميز مطلوب' })
    }

    const session = await prisma.session.findUnique({
      where: { refreshToken: result.data.refreshToken },
      include: { merchant: true },
    })

    if (!session || session.expiresAt < new Date()) {
      return reply.status(401).send({ error: 'الجلسة منتهية، سجّل دخولك مجدداً' })
    }

    await prisma.session.delete({ where: { id: session.id } })

    const { accessToken, refreshToken } = await generateTokens(app, session.merchantId)

    return reply.send({ accessToken, refreshToken })
  })

  // ── Logout ────────────────────────────────────
  app.post('/logout', { preHandler: authenticate }, async (request, reply) => {
    const { refreshToken } = request.body as { refreshToken?: string }

    if (refreshToken) {
      await prisma.session.deleteMany({ where: { refreshToken } })
    }

    return reply.send({ message: 'تم تسجيل الخروج بنجاح' })
  })

  // ── Me (Current User) ─────────────────────────
  app.get('/me', { preHandler: authenticate }, async (request, reply) => {
    const merchant = await prisma.merchant.findUnique({
      where: { id: (request.user as any).id },
      select: {
        id: true, email: true, phone: true,
        firstName: true, lastName: true,
        isVerified: true, twoFactorEnabled: true,
        createdAt: true,
        stores: {
          select: { id: true, name: true, nameAr: true, slug: true, subdomain: true, plan: true, isActive: true },
        },
      },
    })

    if (!merchant) {
      return reply.status(404).send({ error: 'الحساب غير موجود' })
    }

    return reply.send({ merchant })
  })
}

// ── Helpers ───────────────────────────────────────
async function generateTokens(app: FastifyInstance, merchantId: string) {
  const accessToken = app.jwt.sign(
    { id: merchantId },
    { expiresIn: '15m' }
  )

  const refreshToken = app.jwt.sign(
    { id: merchantId, type: 'refresh' },
    { expiresIn: '30d' }
  )

  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + 30)

  await prisma.session.create({
    data: { merchantId, refreshToken, expiresAt },
  })

  return { accessToken, refreshToken }
}
