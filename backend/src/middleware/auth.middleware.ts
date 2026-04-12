import type { FastifyRequest, FastifyReply } from 'fastify'
import { prisma } from '../lib/prisma'

export type PlatformPermission =
  | 'canViewMerchants'
  | 'canDisableStore'
  | 'canReplyTickets'
  | 'canEditPlans'
  | 'canManageApps'
  | 'canViewFinancials'
  | 'canViewAuditLog'
  | 'canManageContent'
  | 'canReviewKYC'
  | 'canManageTeam'

export type PlatformAccess = {
  merchantId: string
  email: string
  isFullAdmin: boolean
  staffId: string | null
  permissions: Record<PlatformPermission, boolean>
}

const ALL_PLATFORM_PERMISSIONS: PlatformPermission[] = [
  'canViewMerchants',
  'canDisableStore',
  'canReplyTickets',
  'canEditPlans',
  'canManageApps',
  'canViewFinancials',
  'canViewAuditLog',
  'canManageContent',
  'canReviewKYC',
  'canManageTeam',
]

function getFullAccessPermissions(): Record<PlatformPermission, boolean> {
  return Object.fromEntries(ALL_PLATFORM_PERMISSIONS.map((permission) => [permission, true])) as Record<PlatformPermission, boolean>
}

async function enforceAdminIpWhitelist(request: FastifyRequest, reply: FastifyReply) {
  const settings = await prisma.securitySettings.findUnique({ where: { id: 'platform' } })
  if (!settings?.ipWhitelistEnabled) return

  const reqIp = (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0]?.trim()
    ?? (request as any).ip
    ?? ''
  const allowed = await prisma.adminIpWhitelist.findFirst({ where: { ip: reqIp } })
  if (!allowed) {
    return reply.status(403).send({ error: `الوصول مرفوض: عنوان IP (${reqIp}) غير مدرج في القائمة البيضاء`, code: 'IP_BLOCKED' })
  }
}

export async function resolvePlatformAccess(request: FastifyRequest, reply: FastifyReply): Promise<PlatformAccess | null> {
  const cached = (request as any).platformAccess as PlatformAccess | undefined
  if (cached) return cached

  const user = request.user as any
  const merchant = await prisma.merchant.findUnique({
    where: { id: user.id },
    select: {
      id: true,
      email: true,
      isAdmin: true,
      isActive: true,
    },
  })

  if (!merchant?.isAdmin || !merchant.isActive) {
    reply.status(403).send({ error: 'هذا المسار للمشرفين فقط', code: 'FORBIDDEN' })
    return null
  }

  await enforceAdminIpWhitelist(request, reply)
  if (reply.sent) return null

  const staff = await prisma.platformStaff.findFirst({
    where: {
      email: { equals: merchant.email, mode: 'insensitive' },
      isActive: true,
    },
    include: { role: true },
  })

  const access: PlatformAccess = staff
    ? {
        merchantId: merchant.id,
        email: merchant.email,
        isFullAdmin: false,
        staffId: staff.id,
        permissions: {
          canViewMerchants: staff.role.canViewMerchants,
          canDisableStore: staff.role.canDisableStore,
          canReplyTickets: staff.role.canReplyTickets,
          canEditPlans: staff.role.canEditPlans,
          canManageApps: staff.role.canManageApps,
          canViewFinancials: staff.role.canViewFinancials,
          canViewAuditLog: staff.role.canViewAuditLog,
          canManageContent: staff.role.canManageContent,
          canReviewKYC: staff.role.canReviewKYC,
          canManageTeam: staff.role.canManageTeam,
        },
      }
    : {
        merchantId: merchant.id,
        email: merchant.email,
        isFullAdmin: true,
        staffId: null,
        permissions: getFullAccessPermissions(),
      }

  ;(request as any).platformAccess = access
  return access
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()

    // Staff JWT contains { id: staffId, type: 'staff', storeId, role }
    // All routes use `user.id` as merchantId — resolve it here for staff tokens
    const user = request.user as any
    if (user?.type === 'staff') {
      const staff = await prisma.storeStaff.findUnique({
        where: { id: user.id },
        select: { id: true, storeId: true, store: { select: { merchantId: true } } },
      })
      if (!staff) {
        return reply.status(401).send({ error: 'غير مصرح', code: 'UNAUTHORIZED' })
      }
      // Keep staffId accessible while making user.id the merchantId for route compatibility
      user.staffId = user.id
      user.id = staff.store.merchantId
      user.storeId = staff.storeId
    }
  } catch {
    return reply.status(401).send({ error: 'غير مصرح، سجّل دخولك أولاً', code: 'UNAUTHORIZED' })
  }
}

export async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  try {
    await request.jwtVerify()
    await resolvePlatformAccess(request, reply)
  } catch (err: any) {
    if (err?.code === 'IP_BLOCKED' || err?.statusCode) throw err
    return reply.status(401).send({ error: 'غير مصرح، سجّل دخولك أولاً', code: 'UNAUTHORIZED' })
  }
}

export function requirePlatformPermission(permission: PlatformPermission) {
  return async function platformPermissionGuard(request: FastifyRequest, reply: FastifyReply) {
    const access = await resolvePlatformAccess(request, reply)
    if (!access || reply.sent) return

    if (!access.permissions[permission]) {
      return reply.status(403).send({ error: 'لا تملك الصلاحية المطلوبة لهذا الإجراء', code: 'FORBIDDEN_PERMISSION' })
    }
  }
}

export async function requireFullPlatformAdmin(request: FastifyRequest, reply: FastifyReply) {
  const access = await resolvePlatformAccess(request, reply)
  if (!access || reply.sent) return

  if (!access.isFullAdmin) {
    return reply.status(403).send({ error: 'هذا الإجراء متاح فقط لمشرف المنصة الكامل', code: 'FORBIDDEN_FULL_ADMIN' })
  }
}

