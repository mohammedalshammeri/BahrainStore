import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { z } from 'zod'
import * as OTPAuth from 'otpauth'
import QRCode from 'qrcode'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { sendPasswordResetEmail } from '../lib/email'

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

    let merchant
    try {
      merchant = await prisma.merchant.create({
        data: { email, phone, passwordHash, firstName, lastName },
        select: { id: true, email: true, phone: true, firstName: true, lastName: true, isAdmin: true, createdAt: true },
      })
    } catch (err: any) {
      if (err?.code === 'P2002') {
        return reply.status(409).send({ error: 'البريد الإلكتروني أو رقم الهاتف مستخدم بالفعل' })
      }
      throw err
    }

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

    const reqIp = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
      ?? (request as any).ip ?? 'unknown'
    const userAgent = (request.headers['user-agent'] as string | undefined) ?? null

    // Check IP ban (too many failures from this IP)
    const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
    const maxAttempts = settings?.maxLoginAttempts ?? 5
    const banMinutes  = settings?.banDurationMinutes ?? 30
    const banSince    = new Date(Date.now() - banMinutes * 60 * 1000)
    const recentFails = await prisma.loginAttempt.count({
      where: { ip: reqIp, success: false, createdAt: { gte: banSince } },
    })
    if (recentFails >= maxAttempts) {
      return reply.status(429).send({ error: `تم تجاوز الحد المسموح من المحاولات. يُرجى الانتظار ${banMinutes} دقيقة.`, code: 'IP_BANNED' })
    }

    const merchant = await prisma.merchant.findUnique({
      where: { email },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, passwordHash: true, isActive: true, isAdmin: true, twoFactorEnabled: true, lastLoginIp: true },
    })

    if (!merchant || !(await bcrypt.compare(password, merchant.passwordHash))) {
      // Record failed attempt (fire-and-forget)
      prisma.loginAttempt.create({ data: { ip: reqIp, email, success: false, userAgent } }).catch(() => {})
      return reply.status(401).send({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' })
    }

    if (!merchant.isActive) {
      prisma.loginAttempt.create({ data: { ip: reqIp, email, success: false, userAgent } }).catch(() => {})
      return reply.status(403).send({ error: 'الحساب موقوف، تواصل مع الدعم' })
    }

    // Record successful attempt + update login metadata (fire-and-forget)
    const isNewIp = merchant.lastLoginIp && merchant.lastLoginIp !== reqIp
    prisma.loginAttempt.create({ data: { ip: reqIp, email, success: true, userAgent } }).catch(() => {})
    prisma.merchant.update({
      where: { id: merchant.id },
      data: { lastLoginIp: reqIp, lastLoginAt: new Date() },
    }).catch(() => {})

    // If 2FA is enabled, issue a short-lived temp token instead of full tokens
    if (merchant.twoFactorEnabled) {
      const tempToken = app.jwt.sign(
        { id: merchant.id, type: '2fa_pending' },
        { expiresIn: '5m' }
      )
      return reply.send({ requires2FA: true, tempToken })
    }

    const { accessToken, refreshToken } = await generateTokens(app, merchant.id)

    return reply.send({
      message: 'تم تسجيل الدخول بنجاح',
      newIpDetected: !!isNewIp,
      merchant: {
        id: merchant.id,
        email: merchant.email,
        phone: merchant.phone,
        firstName: merchant.firstName,
        lastName: merchant.lastName,
        isAdmin: merchant.isAdmin,
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
        isVerified: true, isAdmin: true, twoFactorEnabled: true,
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

  // ── Forgot Password ───────────────────────────
  app.post('/forgot-password', async (request, reply) => {
    const { email } = request.body as { email?: string }
    if (!email) return reply.status(400).send({ error: 'البريد الإلكتروني مطلوب' })

    const merchant = await prisma.merchant.findUnique({ where: { email } })

    // Always return 200 to avoid email enumeration
    if (!merchant) return reply.send({ message: 'إذا كان الحساب موجوداً، ستصلك رسالة بريد إلكتروني' })

    const token = crypto.randomBytes(32).toString('hex')
    const expires = new Date(Date.now() + 3600_000) // 1 hour

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { passwordResetToken: token, passwordResetExpires: expires },
    })

    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3002'
    const resetUrl = `${dashboardUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail({
      to: merchant.email,
      firstName: merchant.firstName,
      resetUrl,
    })

    return reply.send({ message: 'إذا كان الحساب موجوداً، ستصلك رسالة بريد إلكتروني' })
  })

  // ── Reset Password ────────────────────────────
  app.post('/reset-password', async (request, reply) => {
    const { token, password } = request.body as { token?: string; password?: string }
    if (!token || !password) return reply.status(400).send({ error: 'البيانات ناقصة' })
    if (password.length < 8) return reply.status(400).send({ error: 'كلمة المرور يجب أن تكون 8 أحرف على الأقل' })

    const merchant = await prisma.merchant.findFirst({
      where: {
        passwordResetToken: token,
        passwordResetExpires: { gt: new Date() },
      },
    })

    if (!merchant) {
      return reply.status(400).send({ error: 'الرابط غير صحيح أو منتهي الصلاحية' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.merchant.update({
      where: { id: merchant.id },
      data: { passwordHash, passwordResetToken: null, passwordResetExpires: null },
    })

    // Invalidate all sessions
    await prisma.session.deleteMany({ where: { merchantId: merchant.id } })

    return reply.send({ message: 'تم تغيير كلمة المرور بنجاح، يرجى تسجيل الدخول' })
  })

  // ── 2FA: Setup (generate secret + QR code) ────
  app.post('/2fa/setup', { preHandler: authenticate }, async (request, reply) => {
    const merchantId = (request.user as any).id
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, email: true, twoFactorEnabled: true },
    })
    if (!merchant) return reply.status(404).send({ error: 'الحساب غير موجود' })
    if (merchant.twoFactorEnabled) {
      return reply.status(400).send({ error: 'المصادقة الثنائية مفعّلة بالفعل' })
    }

    const secret = new OTPAuth.Secret({ size: 20 })
    const totp = new OTPAuth.TOTP({
      issuer: 'BahrainStore',
      label: merchant.email,
      algorithm: 'SHA1',
      digits: 6,
      period: 30,
      secret,
    })

    const otpauthUri = totp.toString()
    const qrDataUrl = await QRCode.toDataURL(otpauthUri)

    // Store the secret temporarily (not enabled yet)
    await prisma.merchant.update({
      where: { id: merchantId },
      data: { twoFactorSecret: secret.base32 },
    })

    return reply.send({ secret: secret.base32, qrCode: qrDataUrl, otpauthUri })
  })

  // ── 2FA: Enable (verify code and activate) ────
  app.post('/2fa/enable', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.body as { code?: string }
    if (!code) return reply.status(400).send({ error: 'رمز التحقق مطلوب' })

    const merchantId = (request.user as any).id
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
    })
    if (!merchant?.twoFactorSecret) {
      return reply.status(400).send({ error: 'قم بإعداد المصادقة الثنائية أولاً' })
    }
    if (merchant.twoFactorEnabled) {
      return reply.status(400).send({ error: 'المصادقة الثنائية مفعّلة بالفعل' })
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(merchant.twoFactorSecret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) return reply.status(400).send({ error: 'رمز التحقق غير صحيح' })

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { twoFactorEnabled: true },
    })

    return reply.send({ message: 'تم تفعيل المصادقة الثنائية بنجاح' })
  })

  // ── 2FA: Verify during login ──────────────────
  app.post('/2fa/verify', async (request, reply) => {
    const { tempToken, code } = request.body as { tempToken?: string; code?: string }
    if (!tempToken || !code) return reply.status(400).send({ error: 'البيانات ناقصة' })

    let payload: { id: string; type: string }
    try {
      payload = app.jwt.verify(tempToken) as { id: string; type: string }
    } catch {
      return reply.status(401).send({ error: 'الرمز المؤقت غير صحيح أو منتهي الصلاحية' })
    }

    if (payload.type !== '2fa_pending') {
      return reply.status(401).send({ error: 'رمز مميز غير صحيح' })
    }

    const merchant = await prisma.merchant.findUnique({
      where: { id: payload.id },
      select: { id: true, email: true, phone: true, firstName: true, lastName: true, twoFactorSecret: true, isActive: true },
    })
    if (!merchant?.twoFactorSecret) return reply.status(400).send({ error: 'الحساب غير مجهّز للمصادقة الثنائية' })
    if (!merchant.isActive) return reply.status(403).send({ error: 'الحساب موقوف' })

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(merchant.twoFactorSecret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) return reply.status(400).send({ error: 'رمز التحقق غير صحيح' })

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

  // ── 2FA: Disable ──────────────────────────────
  app.post('/2fa/disable', { preHandler: authenticate }, async (request, reply) => {
    const { code } = request.body as { code?: string }
    if (!code) return reply.status(400).send({ error: 'رمز التحقق مطلوب' })

    const merchantId = (request.user as any).id
    const merchant = await prisma.merchant.findUnique({
      where: { id: merchantId },
      select: { id: true, twoFactorSecret: true, twoFactorEnabled: true },
    })
    if (!merchant?.twoFactorEnabled || !merchant.twoFactorSecret) {
      return reply.status(400).send({ error: 'المصادقة الثنائية غير مفعّلة' })
    }

    const totp = new OTPAuth.TOTP({
      algorithm: 'SHA1', digits: 6, period: 30,
      secret: OTPAuth.Secret.fromBase32(merchant.twoFactorSecret),
    })
    const delta = totp.validate({ token: code, window: 1 })
    if (delta === null) return reply.status(400).send({ error: 'رمز التحقق غير صحيح' })

    await prisma.merchant.update({
      where: { id: merchantId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    })

    return reply.send({ message: 'تم تعطيل المصادقة الثنائية' })
  })

  // ── Google OAuth: Initiate ────────────────────
  app.get('/google', async (request, reply) => {
    const clientId = process.env.GOOGLE_CLIENT_ID
    if (!clientId) {
      return reply.status(503).send({ error: 'تسجيل الدخول بجوجل غير مفعّل' })
    }
    const backendUrl = process.env.BACKEND_URL ?? 'http://localhost:3001'
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${backendUrl}/api/v1/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account',
    })
    return reply.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302)
  })

  // ── Google OAuth: Callback ────────────────────
  app.get('/google/callback', async (request, reply) => {
    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3002'
    const backendUrl  = process.env.BACKEND_URL  ?? 'http://localhost:3001'
    const { code, error } = request.query as { code?: string; error?: string }

    if (error || !code) {
      return reply.redirect(`${dashboardUrl}/login?error=google_auth_failed`, 302)
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${backendUrl}/api/v1/auth/google/callback`,
          grant_type: 'authorization_code',
        }),
      })
      const tokenData = await tokenRes.json() as { access_token?: string }
      if (!tokenData.access_token) {
        return reply.redirect(`${dashboardUrl}/login?error=google_token_failed`, 302)
      }

      // Get user info
      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const user = await userRes.json() as {
        sub?: string; email?: string; given_name?: string; family_name?: string; name?: string
      }
      if (!user.email || !user.sub) {
        return reply.redirect(`${dashboardUrl}/login?error=google_user_failed`, 302)
      }

      // Find or create merchant
      let merchant = await prisma.merchant.findFirst({
        where: { OR: [{ googleId: user.sub }, { email: user.email }] },
      })

      if (!merchant) {
        merchant = await prisma.merchant.create({
          data: {
            email: user.email,
            phone: `g_${user.sub!.slice(-10)}`,
            passwordHash: await bcrypt.hash(crypto.randomBytes(20).toString('hex'), 12),
            firstName: user.given_name ?? user.name?.split(' ')[0] ?? 'مستخدم',
            lastName: user.family_name ?? (user.name?.split(' ').slice(1).join(' ') ?? ''),
            googleId: user.sub,
            isVerified: true,
          },
        })
      } else if (!merchant.googleId) {
        merchant = await prisma.merchant.update({
          where: { id: merchant.id },
          data: { googleId: user.sub, isVerified: true },
        })
      }

      if (!merchant.isActive) {
        return reply.redirect(`${dashboardUrl}/login?error=account_disabled`, 302)
      }

      const { accessToken, refreshToken } = await generateTokens(app, merchant.id)
      return reply.redirect(
        `${dashboardUrl}/google-callback?at=${encodeURIComponent(accessToken)}&rt=${encodeURIComponent(refreshToken)}`,
        302
      )
    } catch {
      return reply.redirect(`${dashboardUrl}/login?error=google_auth_failed`, 302)
    }
  })

  // ── Staff Login ───────────────────────────────
  app.post('/staff/login', async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string }
    if (!email || !password) {
      return reply.status(400).send({ error: 'البريد وكلمة المرور مطلوبان' })
    }

    const staff = await prisma.storeStaff.findFirst({
      where: { email, isActive: true },
      include: {
        store: { select: { id: true, name: true, nameAr: true, subdomain: true, plan: true, isActive: true } },
      },
    })

    if (!staff || !staff.passwordHash || !(await bcrypt.compare(password, staff.passwordHash))) {
      return reply.status(401).send({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' })
    }

    const accessToken = app.jwt.sign(
      { id: staff.id, type: 'staff', storeId: staff.storeId, role: staff.role },
      { expiresIn: '8h' }
    )

    return reply.send({
      message: 'تم تسجيل دخول الموظف بنجاح',
      staff: {
        id: staff.id, email: staff.email,
        firstName: staff.firstName, lastName: staff.lastName,
        role: staff.role, store: staff.store,
      },
      accessToken,
    })
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
