import crypto from 'node:crypto'

interface OrderTrackingTokenPayload {
  orderId: string
  orderNumber: string
  storeId: string
  exp: number
}

function getTrackingSecret() {
  const secret = process.env.ORDER_TRACKING_SECRET ?? process.env.JWT_SECRET
  if (!secret) {
    throw new Error('ORDER_TRACKING_SECRET_OR_JWT_SECRET_MISSING')
  }

  return secret
}

function toBase64Url(value: string) {
  return Buffer.from(value).toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signRawPayload(payload: string) {
  return crypto
    .createHmac('sha256', getTrackingSecret())
    .update(payload)
    .digest('base64url')
}

export function createOrderTrackingToken(input: {
  orderId: string
  orderNumber: string
  storeId: string
  expiresInDays?: number
}) {
  const payload: OrderTrackingTokenPayload = {
    orderId: input.orderId,
    orderNumber: input.orderNumber,
    storeId: input.storeId,
    exp: Date.now() + (input.expiresInDays ?? 30) * 24 * 60 * 60 * 1000,
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = signRawPayload(encodedPayload)

  return `${encodedPayload}.${signature}`
}

export function verifyOrderTrackingToken(token: string | undefined, orderNumber: string) {
  if (!token) {
    return { valid: false as const, reason: 'missing-token' }
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return { valid: false as const, reason: 'malformed-token' }
  }

  const expectedSignature = signRawPayload(encodedPayload)
  const signatureBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expectedSignature)

  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !crypto.timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { valid: false as const, reason: 'invalid-signature' }
  }

  try {
    const payload = JSON.parse(fromBase64Url(encodedPayload)) as OrderTrackingTokenPayload

    if (payload.exp < Date.now()) {
      return { valid: false as const, reason: 'expired-token' }
    }

    if (payload.orderNumber !== orderNumber) {
      return { valid: false as const, reason: 'order-mismatch' }
    }

    return { valid: true as const, payload }
  } catch {
    return { valid: false as const, reason: 'invalid-payload' }
  }
}