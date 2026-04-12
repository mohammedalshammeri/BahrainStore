/**
 * Scheduled background jobs – all use native setInterval (no extra dependencies).
 * Registered once at server startup via startCronJobs().
 */
import dns from 'node:dns/promises'
import { prisma } from './prisma'
import { processExpiredSubscriptions } from './subscription-renewal'
import { sendStoreCampaignEmail } from './email'

// ── 1. Flash Sale activation / deactivation (every 5 minutes) ──

async function processFlashSales(): Promise<void> {
  const now = new Date()

  // Deactivate expired sales
  await prisma.flashSale.updateMany({
    where: { isActive: true, endsAt: { lt: now } },
    data: { isActive: false },
  })

  // Activate sales whose start time has arrived (and haven't ended yet)
  await prisma.flashSale.updateMany({
    where: { isActive: false, startsAt: { lte: now }, endsAt: { gte: now } },
    data: { isActive: true },
  })
}

// ── 2. SaaS plan expiry (every hour) ──
// Stores whose planExpiresAt has passed get deactivated. A 7-day grace period
// is recorded in gracePeriodEnds so merchants can still log in and renew.

async function processPlanExpiry(): Promise<void> {
  const now = new Date()

  // Deactivate stores past their grace period
  await prisma.store.updateMany({
    where: {
      isActive: true,
      gracePeriodEnds: { lt: now },
    },
    data: { isActive: false },
  })

  // Set grace period for stores where plan just expired (no grace period set yet)
  const graceWindowEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // +7 days
  await prisma.store.updateMany({
    where: {
      isActive: true,
      plan: { not: 'STARTER' },
      planExpiresAt: { lt: now },
      gracePeriodEnds: null,
    },
    data: { gracePeriodEnds: graceWindowEnd },
  })
}

// ── 3. Scheduled email campaigns (every 5 minutes) ──
// Finds campaigns in SCHEDULED status whose scheduledAt has arrived and dispatches them.

async function processScheduledEmailCampaigns(): Promise<void> {
  const now = new Date()

  const dueCampaigns = await prisma.emailCampaign.findMany({
    where: {
      status: 'SCHEDULED',
      scheduledAt: { lte: now },
    },
    select: {
      id: true,
      storeId: true,
      subject: true,
      subjectAr: true,
      body: true,
      bodyAr: true,
      store: { select: { name: true, nameAr: true } },
    },
  })

  for (const campaign of dueCampaigns) {
    const subject = campaign.subjectAr ?? campaign.subject
    const body = campaign.bodyAr ?? campaign.body
    if (!subject || !body) continue

    // Mark as SENDING immediately to prevent duplicate dispatch on next tick
    await prisma.emailCampaign.update({
      where: { id: campaign.id },
      data: { status: 'SENDING' },
    })

    const subscribers = await prisma.emailSubscriber.findMany({
      where: { storeId: campaign.storeId, isActive: true },
      select: { email: true, firstName: true },
    })

    let sent = 0
    try {
      for (const subscriber of subscribers) {
        await sendStoreCampaignEmail({
          to: subscriber.email,
          firstName: subscriber.firstName,
          storeName: campaign.store.nameAr ?? campaign.store.name,
          subject,
          body,
        })
        sent++
      }

      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'SENT', sentAt: new Date(), recipientCount: sent },
      })
    } catch {
      // Roll back to SCHEDULED so it can be retried next tick, or let merchant retry manually
      await prisma.emailCampaign.update({
        where: { id: campaign.id },
        data: { status: 'SCHEDULED' },
      }).catch(() => {})
    }
  }
}

// ── 4. Auto DNS verification (every 10 minutes) ──
// Checks all unverified domains and updates their status when the TXT record is present.

export async function runDnsVerificationCheck(): Promise<void> {
  const unverified = await prisma.domainVerification.findMany({
    where: { isVerified: false },
    select: { storeId: true, domain: true, verifyToken: true },
  })

  for (const record of unverified) {
    try {
      const txtRecords = await dns.resolveTxt(record.domain)
      const flat = txtRecords.flat()
      const verified = flat.includes(`bazar-verify=${record.verifyToken}`)

      if (verified) {
        await prisma.domainVerification.update({
          where: { storeId: record.storeId },
          data: { isVerified: true, verifiedAt: new Date() },
        })
      }
    } catch {
      // DNS lookup failure is expected for unverified / mis-configured domains – ignore
    }
  }
}

// ── 5. AI chat record pruning (every 24 hours) ──
// Removes AI chat messages older than 90 days to keep the DB lean.

async function pruneAiChatRecords(): Promise<void> {
  const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  await prisma.aiChat.deleteMany({ where: { createdAt: { lt: cutoff } } })
}

// ── Entry point ────────────────────────────────────────────────────────────────

export function startCronJobs(): void {
  // Flash sale transitions — every 5 minutes
  setInterval(() => { processFlashSales().catch(console.error) }, 5 * 60 * 1000)
  processFlashSales().catch(console.error)

  // Plan expiry — every hour (in addition to the subscription renewal already in index.ts)
  setInterval(() => { processPlanExpiry().catch(console.error) }, 60 * 60 * 1000)
  processPlanExpiry().catch(console.error)

  // Scheduled email campaigns — every 5 minutes
  setInterval(() => { processScheduledEmailCampaigns().catch(console.error) }, 5 * 60 * 1000)
  processScheduledEmailCampaigns().catch(console.error)

  // Auto DNS verification — every 10 minutes
  setInterval(() => { runDnsVerificationCheck().catch(console.error) }, 10 * 60 * 1000)

  // AI chat pruning — every 24 hours
  setInterval(() => { pruneAiChatRecords().catch(console.error) }, 24 * 60 * 60 * 1000)

  // Subscription product renewal — delegate to existing lib
  setInterval(() => { processExpiredSubscriptions().catch(console.error) }, 60 * 60 * 1000)

  console.log('⏰ Cron jobs started')
}
