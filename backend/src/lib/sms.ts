// SMS service via Twilio REST API (no SDK required)

interface SmsConfig {
  accountSid: string
  authToken: string
  from: string
}

function normalizePhone(phone: string): string {
  if (phone.startsWith('+')) return phone
  // Bahrain numbers are 8 digits
  if (/^\d{8}$/.test(phone)) return `+973${phone}`
  return `+${phone}`
}

export async function sendSms(to: string, body: string, config: SmsConfig): Promise<void> {
  const normalized = normalizePhone(to)
  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`
  const creds = Buffer.from(`${config.accountSid}:${config.authToken}`).toString('base64')

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${creds}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: normalized, From: config.from, Body: body }).toString(),
    })
    if (!res.ok) {
      const err = await res.json()
      console.error('[SMS] Twilio error:', err)
    }
  } catch (err) {
    console.error('[SMS] Failed to send SMS:', err)
  }
}

export async function sendOrderConfirmationSms(
  params: { to: string; orderNumber: string; storeName: string },
  config: SmsConfig
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS DEV] Order confirmation to ${params.to}: طلب #${params.orderNumber} — ${params.storeName}`)
    return
  }
  const body = `${params.storeName}: تم استلام طلبك رقم #${params.orderNumber} بنجاح. شكراً لتسوقك معنا!`
  return sendSms(params.to, body, config)
}

export async function sendOrderStatusUpdateSms(
  params: { to: string; orderNumber: string; status: string; storeName: string; trackingNumber?: string },
  config: SmsConfig
): Promise<void> {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[SMS DEV] Status update to ${params.to}: طلب #${params.orderNumber} → ${params.status}`)
    return
  }
  const statusAr: Record<string, string> = {
    CONFIRMED: 'تم تأكيد طلبك',
    PROCESSING: 'طلبك قيد التجهيز',
    SHIPPED: 'تم شحن طلبك',
    DELIVERED: 'تم تسليم طلبك',
    CANCELLED: 'تم إلغاء طلبك',
  }
  const label = statusAr[params.status] ?? params.status
  const tracking = params.trackingNumber ? ` · رقم التتبع: ${params.trackingNumber}` : ''
  const body = `${params.storeName}: ${label} #${params.orderNumber}${tracking}`
  return sendSms(params.to, body, config)
}
