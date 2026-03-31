// WhatsApp Business Cloud API (Meta) service

interface WhatsAppConfig {
  phoneNumberId: string
  token: string
}

interface OrderParams {
  to: string
  customerName: string
  orderNumber: string
  storeName: string
  total: number
  currency: string
}

const STATUS_AR: Record<string, string> = {
  PENDING:    'قيد الانتظار',
  CONFIRMED:  'تم التأكيد',
  PROCESSING: 'قيد التجهيز',
  SHIPPED:    'تم الشحن 🚚',
  DELIVERED:  'تم التوصيل ✅',
  CANCELLED:  'ملغي',
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.startsWith('973') || digits.startsWith('966') || digits.startsWith('971')) {
    return digits
  }
  // Assume Bahrain (+973) if 8 digits
  return digits.length === 8 ? `973${digits}` : digits
}

async function sendMessage(to: string, body: string, config: WhatsAppConfig): Promise<void> {
  try {
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: normalizePhone(to),
          type: 'text',
          text: { body },
        }),
      }
    )
    if (!res.ok) {
      const err = await res.text()
      console.error('[WhatsApp] API error:', err)
    }
  } catch (err) {
    console.error('[WhatsApp] Network error:', err)
  }
}

export async function sendWhatsAppOrderConfirmation(
  params: OrderParams,
  config: WhatsAppConfig
): Promise<void> {
  const body =
    `مرحباً ${params.customerName} 👋\n\n` +
    `شكراً لطلبك من *${params.storeName}*!\n\n` +
    `🛍️ رقم الطلب: *#${params.orderNumber}*\n` +
    `💰 الإجمالي: *${Number(params.total).toFixed(3)} ${params.currency}*\n\n` +
    `سيتم التواصل معك قريباً لتأكيد الطلب. شكراً! 🙏`

  await sendMessage(params.to, body, config)
}

export async function sendWhatsAppStatusUpdate(
  params: OrderParams & { status: string; trackingNumber?: string | null },
  config: WhatsAppConfig
): Promise<void> {
  const statusAr = STATUS_AR[params.status] ?? params.status

  let body =
    `مرحباً ${params.customerName} 👋\n\n` +
    `تحديث طلبك من *${params.storeName}*:\n\n` +
    `🛍️ رقم الطلب: *#${params.orderNumber}*\n` +
    `📦 الحالة: *${statusAr}*`

  if (params.trackingNumber) {
    body += `\n🚚 رقم التتبع: *${params.trackingNumber}*`
  }

  await sendMessage(params.to, body, config)
}
