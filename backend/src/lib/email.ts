import nodemailer from 'nodemailer'

// Create transporter â€” uses SMTP env vars or falls back to Ethereal (preview in dev)
function createTransporter() {
  if (process.env.SMTP_HOST) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    })
  }
  // In dev without SMTP config, log emails to console
  return null
}

const transporter = createTransporter()

function requireTransporter() {
  if (!transporter) {
    const error = new Error('EMAIL_NOT_CONFIGURED')
    error.name = 'EMAIL_NOT_CONFIGURED'
    throw error
  }

  return transporter
}

interface OrderEmailData {
  to: string
  customerName: string
  orderNumber: string
  storeName: string
  storeSubdomain: string
  items: { nameAr: string; quantity: number; price: number; total: number }[]
  subtotal: number
  discountAmount: number
  shippingCost: number
  vatAmount: number
  total: number
  paymentMethod: string
  address?: {
    area: string; block?: string; road?: string; building?: string; flat?: string
  }
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'ط§ظ„ط¯ظپط¹ ط¹ظ†ط¯ ط§ظ„ط§ط³طھظ„ط§ظ…',
  BENEFIT_PAY: 'BenefitPay',
  CREDIMAX: 'Credimax',
  VISA_MASTERCARD: 'Visa / Mastercard',
  BANK_TRANSFER: 'طھط­ظˆظٹظ„ ط¨ظ†ظƒظٹ',
}

function formatBHD(amount: number) {
  return `${Number(amount).toFixed(3)} BHD`
}

function buildOrderHtml(data: OrderEmailData): string {
  const itemRows = data.items
    .map(
      (item) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;">${item.nameAr}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:center;">${item.quantity}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #f1f5f9;text-align:right;">${formatBHD(item.total)}</td>
      </tr>`
    )
    .join('')

  const address = data.address
    ? `${data.address.area}${data.address.block ? ' â€” ط¨ظ„ظˆظƒ ' + data.address.block : ''}${data.address.road ? 'طŒ ط´ط§ط±ط¹ ' + data.address.road : ''}${data.address.building ? 'طŒ ظ…ط¨ظ†ظ‰ ' + data.address.building : ''}${data.address.flat ? 'طŒ ط´ظ‚ط© ' + data.address.flat : ''}`
    : ''

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <!-- Header -->
        <tr><td style="background:#1e293b;padding:24px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:22px;">${data.storeName}</h1>
          <p style="color:#94a3b8;margin:6px 0 0;">طھط£ظƒظٹط¯ ط§ظ„ط·ظ„ط¨</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 8px;">ط£ظ‡ظ„ط§ظ‹ <strong>${data.customerName}</strong> ًں‘‹</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">طھظ… ط§ط³طھظ„ط§ظ… ط·ظ„ط¨ظƒ ط¨ظ†ط¬ط§ط­! ط³ظ†طھظˆط§طµظ„ ظ…ط¹ظƒ ظ‚ط±ظٹط¨ط§ظ‹ ظ„طھط£ظƒظٹط¯ ط§ظ„طھظˆطµظٹظ„.</p>

          <!-- Order number -->
          <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:12px;">ط±ظ‚ظ… ط§ظ„ط·ظ„ط¨</p>
            <p style="margin:4px 0 0;color:#1e293b;font-size:20px;font-weight:bold;font-family:monospace;">${data.orderNumber}</p>
          </div>

          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:right;">ط§ظ„ظ…ظ†طھط¬</th>
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:center;">ط§ظ„ظƒظ…ظٹط©</th>
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:right;">ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${data.discountAmount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">ط§ظ„ظ…ط¬ظ…ظˆط¹ ط§ظ„ظپط±ط¹ظٹ</td><td style="padding:4px 0;text-align:left;color:#1e293b;font-size:13px;">${formatBHD(data.subtotal)}</td></tr>` : ''}
            ${data.discountAmount > 0 ? `<tr><td style="padding:4px 0;color:#16a34a;font-size:13px;">ط§ظ„ط®طµظ…</td><td style="padding:4px 0;text-align:left;color:#16a34a;font-size:13px;">- ${formatBHD(data.discountAmount)}</td></tr>` : ''}
            ${data.vatAmount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">ط¶ط±ظٹط¨ط© ط§ظ„ظ‚ظٹظ…ط© ط§ظ„ظ…ط¶ط§ظپط©</td><td style="padding:4px 0;text-align:left;color:#1e293b;font-size:13px;">${formatBHD(data.vatAmount)}</td></tr>` : ''}
            <tr><td style="padding:8px 0 0;border-top:1px solid #e2e8f0;color:#1e293b;font-size:16px;font-weight:bold;">ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ</td><td style="padding:8px 0 0;text-align:left;border-top:1px solid #e2e8f0;color:#1e293b;font-size:16px;font-weight:bold;">${formatBHD(data.total)}</td></tr>
          </table>

          <!-- Details -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 12px 0 0;vertical-align:top;width:50%;">
                <div style="background:#f8fafc;border-radius:8px;padding:14px;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;">ط·ط±ظٹظ‚ط© ط§ظ„ط¯ظپط¹</p>
                  <p style="margin:0;color:#1e293b;font-size:13px;">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</p>
                </div>
              </td>
              ${address ? `<td style="vertical-align:top;width:50%;">
                <div style="background:#f8fafc;border-radius:8px;padding:14px;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;">ط¹ظ†ظˆط§ظ† ط§ظ„طھظˆطµظٹظ„</p>
                  <p style="margin:0;color:#1e293b;font-size:13px;">${address}</p>
                </div>
              </td>` : ''}
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-top:28px;">
            <a href="${process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000'}/${data.storeSubdomain}/orders/${data.orderNumber}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:600;">
              طھطھط¨ط¹ ط·ظ„ط¨ظƒ
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">ظ…ط¯ط¹ظˆظ… ط¨ظˆط§ط³ط·ط© <strong>ط¨ط²ط§ط±</strong> â€” ط§ظ„ظ…ظ†طµط© ط§ظ„طھط¬ط§ط±ظٹط© ظ„ظ…طھط§ط¬ط± ط§ظ„ط¨ط­ط±ظٹظ† ًں‡§ًں‡­</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  const html = buildOrderHtml(data)
  const subject = `طھط£ظƒظٹط¯ ط·ظ„ط¨ظƒ ظ…ظ† ${data.storeName} â€” ${data.orderNumber}`

  if (!transporter) {
    // No SMTP configured â€” log to console for dev visibility
    console.log(`\nًں“§ [EMAIL] To: ${data.to}\nSubject: ${subject}\n[HTML content omitted]\n`)
    return
  }

  await transporter.sendMail({
    from: `"${data.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: data.to,
    subject,
    html,
  })
}

// â”€â”€ Order status update email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

const STATUS_LABELS: Record<string, { ar: string; emoji: string; color: string }> = {
  PENDING:    { ar: 'ظ‚ظٹط¯ ط§ظ„ظ…ط±ط§ط¬ط¹ط©',     emoji: 'ًں•گ', color: '#f59e0b' },
  CONFIRMED:  { ar: 'طھظ… ط§ظ„طھط£ظƒظٹط¯',       emoji: 'âœ…', color: '#3b82f6' },
  PROCESSING: { ar: 'ظ‚ظٹط¯ ط§ظ„طھط­ط¶ظٹط±',     emoji: 'ًں“¦', color: '#8b5cf6' },
  SHIPPED:    { ar: 'ظپظٹ ط§ظ„ط·ط±ظٹظ‚ ط¥ظ„ظٹظƒ',  emoji: 'ًںڑڑ', color: '#06b6d4' },
  DELIVERED:  { ar: 'طھظ… ط§ظ„طھط³ظ„ظٹظ…',       emoji: 'ًںژ‰', color: '#22c55e' },
  CANCELLED:  { ar: 'ظ…ظ„ط؛ظٹ',             emoji: 'â‌Œ', color: '#ef4444' },
  REFUNDED:   { ar: 'طھظ… ط§ظ„ط§ط³طھط±ط¯ط§ط¯',    emoji: 'â†©ï¸ڈ', color: '#6b7280' },
}

// â”€â”€ Staff Invite Email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function sendStaffInviteEmail(opts: {
  to: string
  firstName: string
  storeName: string
  role: string
  inviteUrl: string
}): Promise<void> {
  const roleAr = opts.role === 'ADMIN' ? 'ظ…ط¯ظٹط±' : 'ظ…ظˆط¸ظپ'
  const subject = `ط¯ط¹ظˆط© ظ„ظ„ط§ظ†ط¶ظ…ط§ظ… ط¥ظ„ظ‰ ${opts.storeName} ط¹ظ„ظ‰ ط¨ط²ط§ط±`
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:24px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">ط¨ط²ط§ط± â€” ${opts.storeName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">ط£ظ‡ظ„ط§ظ‹ <strong>${opts.firstName}</strong> ًں‘‹</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">طھظ…طھ ط¯ط¹ظˆطھظƒ ظ„ظ„ط§ظ†ط¶ظ…ط§ظ… ط¥ظ„ظ‰ ظ…طھط¬ط± <strong>${opts.storeName}</strong> ظƒظ€ <strong>${roleAr}</strong>.</p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${opts.inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">ظ‚ط¨ظˆظ„ ط§ظ„ط¯ط¹ظˆط© ظˆط¥ظ†ط´ط§ط، ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±</a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;">ط§ظ„ط±ط§ط¨ط· طµط§ظ„ط­ ظ„ظ…ط¯ط© 7 ط£ظٹط§ظ…</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\nًں“§ [STAFF INVITE] To: ${opts.to}\nSubject: ${subject}\nInvite URL: ${opts.inviteUrl}\n`)
    return
  }

  await transporter.sendMail({
    from: `"ط¨ط²ط§ط±" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// â”€â”€ Order status update email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export async function sendOrderStatusUpdateEmail(opts: {
  to: string
  customerName: string
  orderNumber: string
  storeName: string
  storeSubdomain: string
  newStatus: string
  trackingNumber?: string | null
  shippingCompany?: string | null
}): Promise<void> {
  const info = STATUS_LABELS[opts.newStatus] ?? { ar: opts.newStatus, emoji: 'ًں“‹', color: '#1e293b' }
  const subject = `${info.emoji} طھط­ط¯ظٹط« ط·ظ„ط¨ظƒ ظ…ظ† ${opts.storeName} â€” ${opts.orderNumber}`

  const trackingHtml = opts.trackingNumber
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:16px;text-align:center;">
        <p style="margin:0;color:#166534;font-size:13px;">ط±ظ‚ظ… ط§ظ„طھطھط¨ط¹: <strong style="font-family:monospace;">${opts.trackingNumber}</strong>${opts.shippingCompany ? ` â€” ${opts.shippingCompany}` : ''}</p>
       </div>`
    : ''

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">${opts.storeName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 20px;">ط£ظ‡ظ„ط§ظ‹ <strong>${opts.customerName}</strong>طŒ</p>

          <div style="text-align:center;padding:24px;background:#f8fafc;border-radius:12px;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:8px;">${info.emoji}</div>
            <div style="display:inline-block;background:${info.color}20;color:${info.color};padding:8px 20px;border-radius:50px;font-size:16px;font-weight:bold;">${info.ar}</div>
            <p style="margin:12px 0 0;color:#6b7280;font-size:13px;">ط·ظ„ط¨ ط±ظ‚ظ…: <strong style="font-family:monospace;">${opts.orderNumber}</strong></p>
          </div>

          ${trackingHtml}

          <div style="text-align:center;margin-top:24px;">
            <a href="${process.env.STOREFRONT_URL ?? 'http://localhost:3000'}/${opts.storeSubdomain}/orders/${opts.orderNumber}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-size:14px;font-weight:600;">
              طھطھط¨ط¹ ط·ظ„ط¨ظƒ
            </a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">ظ…ط¯ط¹ظˆظ… ط¨ظˆط§ط³ط·ط© <strong>ط¨ط²ط§ط±</strong> ًں‡§ًں‡­</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\nًں“§ [EMAIL STATUS] To: ${opts.to}\nSubject: ${subject}\nStatus: ${info.ar}\n`)
    return
  }

  await transporter.sendMail({
    from: `"${opts.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// â”€â”€ Password reset email â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export async function sendPasswordResetEmail(opts: {
  to: string
  firstName: string
  resetUrl: string
}): Promise<void> {
  const subject = 'ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط± â€” ط¨ط²ط§ط±'

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">ط¨ط²ط§ط± ًں‡§ًں‡­</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 12px;">ط£ظ‡ظ„ط§ظ‹ <strong>${opts.firstName}</strong>طŒ</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
            طھظ„ظ‚ظ‘ظٹظ†ط§ ط·ظ„ط¨ط§ظ‹ ظ„ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ظƒظ„ظ…ط© ظ…ط±ظˆط± ط­ط³ط§ط¨ظƒ. ط§ط¶ط؛ط· ط¹ظ„ظ‰ ط§ظ„ط²ط± ط£ط¯ظ†ط§ظ‡ ظ„ط§ط®طھظٹط§ط± ظƒظ„ظ…ط© ظ…ط±ظˆط± ط¬ط¯ظٹط¯ط©.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${opts.resetUrl}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">
              ط¥ط¹ط§ط¯ط© طھط¹ظٹظٹظ† ظƒظ„ظ…ط© ط§ظ„ظ…ط±ظˆط±
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
            ظ‡ط°ط§ ط§ظ„ط±ط§ط¨ط· طµط§ظ„ط­ ظ„ظ€ 1 ط³ط§ط¹ط© ظپظ‚ط·. ط¥ط°ط§ ظ„ظ… طھط·ظ„ط¨ ط¥ط¹ط§ط¯ط© ط§ظ„طھط¹ظٹظٹظ†طŒ ظٹظ…ظƒظ†ظƒ طھط¬ط§ظ‡ظ„ ظ‡ط°ط§ ط§ظ„ط¨ط±ظٹط¯.
          </p>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">ط¨ط²ط§ط± â€” ط§ظ„ظ…ظ†طµط© ط§ظ„طھط¬ط§ط±ظٹط© ظ„ظ„ط¨ط­ط±ظٹظ† ًں‡§ًں‡­</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\nًں“§ [PASSWORD RESET] To: ${opts.to}\nReset URL: ${opts.resetUrl}\n`)
    return
  }

  await transporter.sendMail({
    from: `"بزار" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// ── Custom admin email (sent directly from super admin dashboard) ─────────────
export async function sendCustomAdminEmail(opts: {
  to: string
  firstName: string
  subject: string
  body: string
}): Promise<void> {
  const safeBody = opts.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">بزار 🇧🇭</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">أهلاً <strong>${opts.firstName}</strong>،</p>
          <div style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${safeBody}</div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">بزار — المنصة التجارية للبحرين 🇧🇭</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\n📧 [ADMIN EMAIL] To: ${opts.to}\nSubject: ${opts.subject}\nBody: ${opts.body}\n`)
    return
  }
  await transporter.sendMail({
    from: `"بزار" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html,
  })
}

export async function sendStoreCampaignEmail(opts: {
  to: string
  firstName?: string | null
  storeName: string
  subject: string
  body: string
}): Promise<void> {
  const safeBody = opts.body.replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">${opts.storeName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">أهلاً <strong>${opts.firstName ?? 'عميلنا'}</strong>،</p>
          <div style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${safeBody}</div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">${opts.storeName} — عبر بزار</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  const activeTransporter = requireTransporter()
  await activeTransporter.sendMail({
    from: `"${opts.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject: opts.subject,
    html,
  })
}

export async function sendKycDecisionEmail(opts: {
  to: string
  merchantName: string
  status: 'APPROVED' | 'REJECTED'
  reviewNote?: string | null
  documentType: string
  expiresAt?: Date | string | null
  reVerifyBy?: Date | string | null
}): Promise<void> {
  const activeTransporter = requireTransporter()
  const approved = opts.status === 'APPROVED'
  const subject = approved
    ? 'تمت الموافقة على وثيقة KYC الخاصة بك في بزار'
    : 'تحديث مراجعة وثيقة KYC الخاصة بك في بزار'
  const noteHtml = opts.reviewNote?.trim()
    ? `<div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><p style="margin:0 0 6px;color:#475569;font-size:12px;font-weight:700;">ملاحظة فريق المراجعة</p><p style="margin:0;color:#0f172a;font-size:14px;line-height:1.7;">${opts.reviewNote.trim()}</p></div>`
    : ''
  const expiryHtml = opts.expiresAt
    ? `<p style="margin:10px 0 0;color:#475569;font-size:13px;">تاريخ انتهاء الوثيقة المعتمدة: <strong>${new Date(opts.expiresAt).toLocaleDateString('ar-BH')}</strong></p>`
    : ''
  const reverifyHtml = opts.reVerifyBy
    ? `<p style="margin:8px 0 0;color:#475569;font-size:13px;">موعد إعادة التحقق: <strong>${new Date(opts.reVerifyBy).toLocaleDateString('ar-BH')}</strong></p>`
    : ''

  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:${approved ? '#065f46' : '#991b1b'};padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">${approved ? 'تمت الموافقة على وثيقة KYC' : 'تم رفض وثيقة KYC'}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">أهلاً <strong>${opts.merchantName}</strong>،</p>
          <p style="color:#475569;font-size:14px;line-height:1.8;margin:0;">تمت مراجعة وثيقة <strong>${opts.documentType}</strong> الخاصة بك.</p>
          <div style="margin-top:16px;padding:14px;border-radius:12px;background:${approved ? 'rgba(16,185,129,.10)' : 'rgba(239,68,68,.10)'};border:1px solid ${approved ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'};">
            <p style="margin:0;color:${approved ? '#047857' : '#b91c1c'};font-size:15px;font-weight:700;">${approved ? 'الحالة: موافق عليها' : 'الحالة: مرفوضة'}</p>
            ${expiryHtml}
            ${reverifyHtml}
          </div>
          ${noteHtml}
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">يمكنك متابعة حالة KYC من لوحة التاجر ورفع مستند جديد عند الحاجة.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await activeTransporter.sendMail({
    from: `"بزار" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// -- Abandoned Cart Reminder --
export async function sendAbandonedCartEmail(opts: {
  to: string
  firstName: string
  storeName: string
  cartUrl: string
  items: Array<{ nameAr?: string; name: string; price: number; quantity: number; image?: string }>
}): Promise<void> {
  const subject = `${opts.storeName}: لديك منتجات في سلتك 🛒`
  const itemsHtml = opts.items.slice(0, 5).map((item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">${item.nameAr ?? item.name}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">الكمية: ${item.quantity}</p>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:left;font-weight:600;color:#1e293b;">
          ${(item.price * item.quantity).toFixed(3)} د.ب
        </td>
      </tr>`).join('')
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);"><tr><td style="background:#1e293b;padding:20px 32px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:20px;">${opts.storeName}</h1></td></tr><tr><td style="padding:32px;"><h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">نسيت شيئا 🛒</h2><p style="color:#6b7280;font-size:14px;margin:0 0 24px;">أهلا ${opts.firstName} لا تزال المنتجات التالية تنتظرك في سلتك:</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${itemsHtml}</table><div style="text-align:center;margin-bottom:24px;"><a href="${opts.cartUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">إكمال الشراء</a></div></td></tr><tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">${opts.storeName} — مدعوم بواسطة بزار 🇧🇭</p></td></tr></table></td></tr></table></body></html>`
  if (!transporter) {
    console.log(`\n📧 [ABANDONED CART] To: ${opts.to}\nCart URL: ${opts.cartUrl}\n`)
    return
  }
  await transporter.sendMail({
    from: `"${opts.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}
