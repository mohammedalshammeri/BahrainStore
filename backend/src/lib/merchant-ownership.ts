import { prisma } from './prisma'

export async function findMerchantStore(merchantId: string, storeId: string) {
  return prisma.store.findFirst({
    where: { id: storeId, merchantId },
    select: { id: true, merchantId: true },
  })
}

export async function findMerchantWarehouse(merchantId: string, warehouseId: string) {
  return prisma.warehouse.findFirst({
    where: { id: warehouseId, store: { merchantId } },
    select: { id: true, storeId: true, isDefault: true },
  })
}

export async function findMerchantShippingZone(merchantId: string, zoneId: string) {
  return prisma.shippingZone.findFirst({
    where: { id: zoneId, store: { merchantId } },
    select: { id: true, storeId: true },
  })
}

export async function findMerchantShippingRate(merchantId: string, rateId: string) {
  return prisma.shippingRate.findFirst({
    where: { id: rateId, zone: { store: { merchantId } } },
    select: { id: true, zoneId: true, zone: { select: { storeId: true } } },
  })
}

export async function findMerchantOrder(merchantId: string, orderId: string) {
  return prisma.order.findFirst({
    where: { id: orderId, store: { merchantId } },
    select: { id: true, storeId: true },
  })
}

export async function findMerchantShipmentTracking(merchantId: string, trackingId: string) {
  return prisma.shipmentTracking.findFirst({
    where: { id: trackingId, order: { store: { merchantId } } },
    select: { id: true, orderId: true },
  })
}

export async function findMerchantShipmentTrackingByNumber(merchantId: string, trackingNumber: string) {
  return prisma.shipmentTracking.findFirst({
    where: { trackingNumber, order: { store: { merchantId } } },
    select: { id: true, orderId: true, provider: true, trackingNumber: true, status: true, events: true, updatedAt: true },
  })
}

export async function findMerchantLiveStream(merchantId: string, streamId: string) {
  return prisma.liveStream.findFirst({
    where: { id: streamId, store: { merchantId } },
    select: { id: true, storeId: true },
  })
}

export async function findMerchantLiveChatSession(merchantId: string, sessionId: string) {
  return prisma.liveChatSession.findFirst({
    where: { id: sessionId, store: { merchantId } },
    select: { id: true, storeId: true, visitorId: true, status: true },
  })
}

export async function findMerchantLiveChatMessage(merchantId: string, messageId: string) {
  return prisma.liveChatMessage.findFirst({
    where: { id: messageId, stream: { store: { merchantId } } },
    select: { id: true, streamId: true },
  })
}

export async function findMerchantEmailCampaign(merchantId: string, campaignId: string) {
  return prisma.emailCampaign.findFirst({
    where: { id: campaignId, store: { merchantId } },
    select: { id: true, storeId: true, status: true },
  })
}

export async function findMerchantEmailSubscriber(merchantId: string, subscriberId: string) {
  return prisma.emailSubscriber.findFirst({
    where: { id: subscriberId, store: { merchantId } },
    select: { id: true, storeId: true, isActive: true },
  })
}

export async function findMerchantUpsellRule(merchantId: string, ruleId: string) {
  return prisma.upsellRule.findFirst({
    where: { id: ruleId, store: { merchantId } },
    select: { id: true, storeId: true, isActive: true },
  })
}

export async function findMerchantCountdownTimer(merchantId: string, timerId: string) {
  return prisma.countdownTimer.findFirst({
    where: { id: timerId, store: { merchantId } },
    select: { id: true, storeId: true, isActive: true },
  })
}

export async function findMerchantPosSession(merchantId: string, sessionId: string) {
  return prisma.posSession.findFirst({
    where: { id: sessionId, store: { merchantId } },
    select: { id: true, storeId: true, status: true },
  })
}

export async function findMerchantImportJob(merchantId: string, jobId: string) {
  return prisma.importJob.findFirst({
    where: { id: jobId, store: { merchantId } },
    select: { id: true, storeId: true, status: true },
  })
}

export async function findMerchantLoan(merchantId: string, loanId: string) {
  return prisma.merchantLoan.findFirst({
    where: { id: loanId, store: { merchantId } },
    select: {
      id: true,
      storeId: true,
      merchantId: true,
      status: true,
      requestedAmount: true,
      approvedAmount: true,
      feeAmount: true,
      feeRate: true,
      repaymentRate: true,
      repaidAmount: true,
    },
  })
}

export async function findMerchantPaymentByGatewayRef(merchantId: string, gatewayRef: string) {
  return prisma.payment.findFirst({
    where: { gatewayRef, order: { store: { merchantId } } },
    select: {
      id: true,
      orderId: true,
      status: true,
      gatewayRef: true,
      order: { select: { id: true, storeId: true, paymentStatus: true } },
    },
  })
}

export async function findMerchantPage(merchantId: string, pageId: string) {
  return prisma.page.findFirst({
    where: { id: pageId, store: { merchantId } },
    select: { id: true, storeId: true, slug: true, isActive: true },
  })
}

export async function findMerchantBlogPost(merchantId: string, postId: string) {
  return prisma.blogPost.findFirst({
    where: { id: postId, store: { merchantId } },
    select: { id: true, storeId: true, slug: true, isPublished: true, publishedAt: true },
  })
}

export async function findMerchantFlashSale(merchantId: string, flashSaleId: string) {
  return prisma.flashSale.findFirst({
    where: { id: flashSaleId, store: { merchantId } },
    select: { id: true, storeId: true, startsAt: true, endsAt: true, isActive: true },
  })
}

export async function findMerchantRestaurantTable(merchantId: string, tableId: string) {
  return prisma.restaurantTable.findFirst({
    where: { id: tableId, store: { merchantId } },
    select: { id: true, storeId: true, isActive: true },
  })
}

export async function findMerchantRestaurantOrder(merchantId: string, restaurantOrderId: string) {
  return prisma.restaurantOrder.findFirst({
    where: { id: restaurantOrderId, store: { merchantId } },
    select: { id: true, storeId: true, orderId: true, status: true },
  })
}

export async function findMerchantWhatsappConfig(merchantId: string, storeId: string) {
  return prisma.whatsappCommerceConfig.findFirst({
    where: { storeId, store: { merchantId } },
    select: {
      id: true,
      storeId: true,
      phoneNumberId: true,
      accessToken: true,
      verifyToken: true,
      welcomeMessage: true,
      isActive: true,
      createdAt: true,
    },
  })
}

export async function ensureProductBelongsToStore(productId: string, storeId: string) {
  return prisma.product.findFirst({
    where: { id: productId, storeId },
    select: { id: true, storeId: true },
  })
}

export async function ensureVariantBelongsToProduct(variantId: string, productId: string) {
  return prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    select: { id: true, productId: true },
  })
}