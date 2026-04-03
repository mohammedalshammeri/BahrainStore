import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
  } catch {
    return reply.status(401).send({ error: 'غير مصرح، سجّل دخولك أولاً', code: 'UNAUTHORIZED' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    const user = request.user as any
    const merchant = await prisma.merchant.findUnique({ where: { id: user.id }, select: { isAdmin: true } })
    if (!merchant?.isAdmin) {
      return reply.status(403).send({ error: 'هذا المسار للمشرفين فقط', code: 'FORBIDDEN' })
    }

    // Check IP whitelist if enabled
    const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
    if (settings?.ipWhitelistEnabled) {
      const reqIp = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
        ?? (request as any).ip
        ?? ''
      const allowed = await prisma.adminIpWhitelist.findFirst({ where: { ip: reqIp } })
      if (!allowed) {
        return reply.status(403).send({ error: `الوصول مرفوض: عنوان IP (${reqIp}) غير مدرج في القائمة البيضاء`, code: 'IP_BLOCKED' })
      }
    }
  } catch (err: any) {
    if (err?.code === 'IP_BLOCKED' || err?.statusCode) throw err
    return reply.status(401).send({ error: 'غير مصرح، سجّل دخولك أولاً', code: 'UNAUTHORIZED' })
  }
}

