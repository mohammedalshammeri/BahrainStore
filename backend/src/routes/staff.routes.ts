import type { FastifyInstance } from 'fastify'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { prisma } from '../lib/prisma'
import { authenticate } from '../middleware/auth.middleware'
import { sendStaffInviteEmail } from '../lib/email'

export async function staffRoutes(app: FastifyInstance) {
  // ── List Store Staff ──────────────────────────
  app.get('/:storeId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const staff = await prisma.storeStaff.findMany({
      where: { storeId },
      select: {
        id: true, email: true, firstName: true, lastName: true,
        role: true, isActive: true, acceptedAt: true, createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({ staff })
  })

  // ── Invite Staff Member ───────────────────────
  app.post('/:storeId/invite', { preHandler: authenticate }, async (request, reply) => {
    const { storeId } = request.params as { storeId: string }
    const merchantId = (request.user as any).id
    const { email, firstName, lastName, role } = request.body as {
      email?: string; firstName?: string; lastName?: string; role?: string
    }

    if (!email || !firstName || !lastName) {
      return reply.status(400).send({ error: 'البريد الإلكتروني والاسم مطلوبان' })
    }

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const staffRole = (['ADMIN', 'STAFF'] as const).includes(role as 'ADMIN' | 'STAFF')
      ? (role as 'ADMIN' | 'STAFF')
      : 'STAFF'

    const existing = await prisma.storeStaff.findUnique({
      where: { storeId_email: { storeId, email } },
    })
    if (existing) return reply.status(409).send({ error: 'هذا البريد الإلكتروني مضاف بالفعل' })

    const inviteToken = crypto.randomBytes(32).toString('hex')
    const inviteExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    const staffMember = await prisma.storeStaff.create({
      data: { storeId, email, firstName, lastName, role: staffRole, inviteToken, inviteExpires },
    })

    const dashboardUrl = process.env.DASHBOARD_URL ?? 'http://localhost:3002'
    const inviteUrl = `${dashboardUrl}/accept-invite?token=${inviteToken}`

    await sendStaffInviteEmail({
      to: email,
      firstName,
      storeName: store.nameAr || store.name,
      role: staffRole,
      inviteUrl,
    })

    return reply.status(201).send({ message: 'تم إرسال دعوة الانضمام بنجاح', staff: staffMember })
  })

  // ── Update Staff Role / Status ────────────────
  app.patch('/:storeId/:staffId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, staffId } = request.params as { storeId: string; staffId: string }
    const merchantId = (request.user as any).id
    const { role, isActive } = request.body as { role?: string; isActive?: boolean }

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    const data: Record<string, unknown> = {}
    if (role && ['ADMIN', 'STAFF'].includes(role)) data.role = role
    if (typeof isActive === 'boolean') data.isActive = isActive

    const staff = await prisma.storeStaff.update({
      where: { id: staffId, storeId },
      data,
    })

    return reply.send({ staff })
  })

  // ── Remove Staff Member ───────────────────────
  app.delete('/:storeId/:staffId', { preHandler: authenticate }, async (request, reply) => {
    const { storeId, staffId } = request.params as { storeId: string; staffId: string }
    const merchantId = (request.user as any).id

    const store = await prisma.store.findFirst({ where: { id: storeId, merchantId } })
    if (!store) return reply.status(403).send({ error: 'غير مصرح' })

    await prisma.storeStaff.delete({ where: { id: staffId, storeId } })

    return reply.send({ message: 'تم إزالة عضو الفريق بنجاح' })
  })

  // ── Accept Invite (public) ────────────────────
  app.post('/accept-invite', async (request, reply) => {
    const { token, password } = request.body as { token?: string; password?: string }
    if (!token || !password) return reply.status(400).send({ error: 'البيانات ناقصة' })
    if (password.length < 8) return reply.status(400).send({ error: 'كلمة المرور 8 أحرف على الأقل' })

    const staff = await prisma.storeStaff.findFirst({
      where: {
        inviteToken: token,
        inviteExpires: { gt: new Date() },
        acceptedAt: null,
      },
    })
    if (!staff) {
      return reply.status(400).send({ error: 'رابط الدعوة غير صحيح أو منتهي الصلاحية' })
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await prisma.storeStaff.update({
      where: { id: staff.id },
      data: { passwordHash, inviteToken: null, inviteExpires: null, acceptedAt: new Date(), isActive: true },
    })

    return reply.send({ message: 'تم قبول الدعوة بنجاح، يمكنك الآن تسجيل الدخول كموظف' })
  })
}
