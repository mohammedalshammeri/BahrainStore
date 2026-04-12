import nodemailer from 'nodemailer'

// Create transporter — uses SMTP env vars or falls back to Ethereal (preview in dev)
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
  CASH_ON_DELIVERY: 'الدفع عند الاستلام',
  BENEFIT_PAY: 'BenefitPay',
  CREDIMAX: 'Credimax',
  VISA_MASTERCARD: 'Visa / Mastercard',
  BANK_TRANSFER: 'تحويل بنكي',
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
    ? `${data.address.area}${data.address.block ? ' — بلوك ' + data.address.block : ''}${data.address.road ? '، شارع ' + data.address.road : ''}${data.address.building ? '، مبنى ' + data.address.building : ''}${data.address.flat ? '، شقة ' + data.address.flat : ''}`
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
          <p style="color:#94a3b8;margin:6px 0 0;">تأكيد الطلب</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 8px;">أهلاً <strong>${data.customerName}</strong> 👋</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">تم استلام طلبك بنجاح! سنتواصل معك قريباً لتأكيد التوصيل.</p>

          <!-- Order number -->
          <div style="background:#f1f5f9;border-radius:8px;padding:12px 16px;margin-bottom:24px;text-align:center;">
            <p style="margin:0;color:#6b7280;font-size:12px;">رقم الطلب</p>
            <p style="margin:4px 0 0;color:#1e293b;font-size:20px;font-weight:bold;font-family:monospace;">${data.orderNumber}</p>
          </div>

          <!-- Items table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e2e8f0;margin-bottom:20px;">
            <thead>
              <tr style="background:#f8fafc;">
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:right;">المنتج</th>
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:center;">الكمية</th>
                <th style="padding:10px 12px;font-size:12px;color:#6b7280;font-weight:600;text-align:right;">الإجمالي</th>
              </tr>
            </thead>
            <tbody>${itemRows}</tbody>
          </table>

          <!-- Totals -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${data.discountAmount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">المجموع الفرعي</td><td style="padding:4px 0;text-align:left;color:#1e293b;font-size:13px;">${formatBHD(data.subtotal)}</td></tr>` : ''}
            ${data.discountAmount > 0 ? `<tr><td style="padding:4px 0;color:#16a34a;font-size:13px;">الخصم</td><td style="padding:4px 0;text-align:left;color:#16a34a;font-size:13px;">- ${formatBHD(data.discountAmount)}</td></tr>` : ''}
            ${data.vatAmount > 0 ? `<tr><td style="padding:4px 0;color:#6b7280;font-size:13px;">ضريبة القيمة المضافة</td><td style="padding:4px 0;text-align:left;color:#1e293b;font-size:13px;">${formatBHD(data.vatAmount)}</td></tr>` : ''}
            <tr><td style="padding:8px 0 0;border-top:1px solid #e2e8f0;color:#1e293b;font-size:16px;font-weight:bold;">الإجمالي</td><td style="padding:8px 0 0;text-align:left;border-top:1px solid #e2e8f0;color:#1e293b;font-size:16px;font-weight:bold;">${formatBHD(data.total)}</td></tr>
          </table>

          <!-- Details -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:0 12px 0 0;vertical-align:top;width:50%;">
                <div style="background:#f8fafc;border-radius:8px;padding:14px;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;">طريقة الدفع</p>
                  <p style="margin:0;color:#1e293b;font-size:13px;">${PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod}</p>
                </div>
              </td>
              ${address ? `<td style="vertical-align:top;width:50%;">
                <div style="background:#f8fafc;border-radius:8px;padding:14px;">
                  <p style="margin:0 0 4px;color:#6b7280;font-size:11px;font-weight:600;">عنوان التوصيل</p>
                  <p style="margin:0;color:#1e293b;font-size:13px;">${address}</p>
                </div>
              </td>` : ''}
            </tr>
          </table>

          <!-- CTA -->
          <div style="text-align:center;margin-top:28px;">
            <a href="${process.env.NEXT_PUBLIC_STOREFRONT_URL ?? 'http://localhost:3000'}/${data.storeSubdomain}/orders/${data.orderNumber}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 32px;border-radius:50px;font-size:14px;font-weight:600;">
              تتبع طلبك
            </a>
          </div>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">مدعوم بواسطة <strong>بزار</strong> — المنصة التجارية لمتاجر البحرين 🇧🇭</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

export async function sendOrderConfirmationEmail(data: OrderEmailData): Promise<void> {
  const html = buildOrderHtml(data)
  const subject = `تأكيد طلبك من ${data.storeName} — ${data.orderNumber}`

  if (!transporter) {
    // No SMTP configured — log to console for dev visibility
    console.log(`\n📧 [EMAIL] To: ${data.to}\nSubject: ${subject}\n[HTML content omitted]\n`)
    return
  }

  await transporter.sendMail({
    from: `"${data.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: data.to,
    subject,
    html,
  })
}

// ── Order status update email ───────────────────────────────────────────────

const STATUS_LABELS: Record<string, { ar: string; emoji: string; color: string }> = {
  PENDING:    { ar: 'قيد المراجعة',     emoji: '🕐', color: '#f59e0b' },
  CONFIRMED:  { ar: 'تم التأكيد',       emoji: '✅', color: '#3b82f6' },
  PROCESSING: { ar: 'قيد التحضير',     emoji: '📦', color: '#8b5cf6' },
  SHIPPED:    { ar: 'في الطريق إليك',  emoji: '🚚', color: '#06b6d4' },
  DELIVERED:  { ar: 'تم التسليم',       emoji: '🎉', color: '#22c55e' },
  CANCELLED:  { ar: 'ملغي',             emoji: '❌', color: '#ef4444' },
  REFUNDED:   { ar: 'تم الاسترداد',    emoji: '↩️', color: '#6b7280' },
}

// ── Staff Invite Email ─────────────────────────────────────────────────────
export async function sendStaffInviteEmail(opts: {
  to: string
  firstName: string
  storeName: string
  role: string
  inviteUrl: string
}): Promise<void> {
  const roleAr = opts.role === 'ADMIN' ? 'مدير' : 'موظف'
  const subject = `دعوة للانضمام إلى ${opts.storeName} على بزار`
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 16px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#1e293b;padding:24px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">بزار — ${opts.storeName}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">أهلاً <strong>${opts.firstName}</strong> 👋</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">تمت دعوتك للانضمام إلى متجر <strong>${opts.storeName}</strong> كـ <strong>${roleAr}</strong>.</p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${opts.inviteUrl}" style="display:inline-block;background:#4f46e5;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">قبول الدعوة وإنشاء كلمة المرور</a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;">الرابط صالح لمدة 7 أيام</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\n📧 [STAFF INVITE] To: ${opts.to}\nSubject: ${subject}\nInvite URL: ${opts.inviteUrl}\n`)
    return
  }

  await transporter.sendMail({
    from: `"بزار" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// ── Order status update email ───────────────────────────────────────────────
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
  const info = STATUS_LABELS[opts.newStatus] ?? { ar: opts.newStatus, emoji: '📋', color: '#1e293b' }
  const subject = `${info.emoji} تحديث طلبك من ${opts.storeName} — ${opts.orderNumber}`

  const trackingHtml = opts.trackingNumber
    ? `<div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:12px 16px;margin-top:16px;text-align:center;">
        <p style="margin:0;color:#166534;font-size:13px;">رقم التتبع: <strong style="font-family:monospace;">${opts.trackingNumber}</strong>${opts.shippingCompany ? ` — ${opts.shippingCompany}` : ''}</p>
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
          <p style="color:#374151;font-size:16px;margin:0 0 20px;">أهلاً <strong>${opts.customerName}</strong>،</p>

          <div style="text-align:center;padding:24px;background:#f8fafc;border-radius:12px;margin-bottom:20px;">
            <div style="font-size:48px;margin-bottom:8px;">${info.emoji}</div>
            <div style="display:inline-block;background:${info.color}20;color:${info.color};padding:8px 20px;border-radius:50px;font-size:16px;font-weight:bold;">${info.ar}</div>
            <p style="margin:12px 0 0;color:#6b7280;font-size:13px;">طلب رقم: <strong style="font-family:monospace;">${opts.orderNumber}</strong></p>
          </div>

          ${trackingHtml}

          <div style="text-align:center;margin-top:24px;">
            <a href="${process.env.STOREFRONT_URL ?? 'http://localhost:3000'}/${opts.storeSubdomain}/orders/${opts.orderNumber}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:12px 28px;border-radius:50px;font-size:14px;font-weight:600;">
              تتبع طلبك
            </a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px 32px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">مدعوم بواسطة <strong>بزار</strong> 🇧🇭</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\n📧 [EMAIL STATUS] To: ${opts.to}\nSubject: ${subject}\nStatus: ${info.ar}\n`)
    return
  }

  await transporter.sendMail({
    from: `"${opts.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// ── Password reset email ────────────────────────────────────────────────────

export async function sendPasswordResetEmail(opts: {
  to: string
  firstName: string
  resetUrl: string
}): Promise<void> {
  const subject = 'إعادة تعيين كلمة المرور — بزار'

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
          <p style="color:#374151;font-size:16px;margin:0 0 12px;">أهلاً <strong>${opts.firstName}</strong>،</p>
          <p style="color:#6b7280;font-size:14px;margin:0 0 24px;">
            تلقّينا طلباً لإعادة تعيين كلمة مرور حسابك. اضغط على الزر أدناه لاختيار كلمة مرور جديدة.
          </p>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${opts.resetUrl}"
               style="display:inline-block;background:#1e293b;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">
              إعادة تعيين كلمة المرور
            </a>
          </div>
          <p style="color:#94a3b8;font-size:12px;text-align:center;margin:0;">
            هذا الرابط صالح لـ 1 ساعة فقط. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذا البريد.
          </p>
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
    console.log(`\n📧 [PASSWORD RESET] To: ${opts.to}\nReset URL: ${opts.resetUrl}\n`)
    return
  }

  await transporter.sendMail({
    from: `"����" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// ?? Custom admin email (sent directly from super admin dashboard) ?????????????
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
          <h1 style="color:#fff;margin:0;font-size:20px;">���� ????</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">����� <strong>${opts.firstName}</strong>�</p>
          <div style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${safeBody}</div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">���� � ������ �������� ������� ????</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`\n?? [ADMIN EMAIL] To: ${opts.to}\nSubject: ${opts.subject}\nBody: ${opts.body}\n`)
    return
  }
  await transporter.sendMail({
    from: `"����" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
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
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">����� <strong>${opts.firstName ?? '������'}</strong>�</p>
          <div style="color:#374151;font-size:14px;line-height:1.7;white-space:pre-wrap;">${safeBody}</div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">${opts.storeName} � ��� ����</p>
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
    ? '��� �������� ��� ����� KYC ������ �� �� ����'
    : '����� ������ ����� KYC ������ �� �� ����'
  const noteHtml = opts.reviewNote?.trim()
    ? `<div style="margin-top:16px;padding:12px 14px;border-radius:10px;background:#f8fafc;border:1px solid #e2e8f0;"><p style="margin:0 0 6px;color:#475569;font-size:12px;font-weight:700;">������ ���� ��������</p><p style="margin:0;color:#0f172a;font-size:14px;line-height:1.7;">${opts.reviewNote.trim()}</p></div>`
    : ''
  const expiryHtml = opts.expiresAt
    ? `<p style="margin:10px 0 0;color:#475569;font-size:13px;">����� ������ ������� ��������: <strong>${new Date(opts.expiresAt).toLocaleDateString('ar-BH')}</strong></p>`
    : ''
  const reverifyHtml = opts.reVerifyBy
    ? `<p style="margin:8px 0 0;color:#475569;font-size:13px;">���� ����� ������: <strong>${new Date(opts.reVerifyBy).toLocaleDateString('ar-BH')}</strong></p>`
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
          <h1 style="color:#fff;margin:0;font-size:20px;">${approved ? '��� �������� ��� ����� KYC' : '�� ��� ����� KYC'}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 16px;">����� <strong>${opts.merchantName}</strong>�</p>
          <p style="color:#475569;font-size:14px;line-height:1.8;margin:0;">��� ������ ����� <strong>${opts.documentType}</strong> ������ ��.</p>
          <div style="margin-top:16px;padding:14px;border-radius:12px;background:${approved ? 'rgba(16,185,129,.10)' : 'rgba(239,68,68,.10)'};border:1px solid ${approved ? 'rgba(16,185,129,.25)' : 'rgba(239,68,68,.25)'};">
            <p style="margin:0;color:${approved ? '#047857' : '#b91c1c'};font-size:15px;font-weight:700;">${approved ? '������: ����� �����' : '������: ������'}</p>
            ${expiryHtml}
            ${reverifyHtml}
          </div>
          ${noteHtml}
          <p style="margin:24px 0 0;color:#94a3b8;font-size:12px;">����� ������ ���� KYC �� ���� ������ ���� ����� ���� ��� ������.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await activeTransporter.sendMail({
    from: `"����" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
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
  const subject = `${opts.storeName}: ���� ������ �� ���� ??`
  const itemsHtml = opts.items.slice(0, 5).map((item) => `
      <tr>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">
          <p style="margin:0;font-size:14px;color:#374151;font-weight:600;">${item.nameAr ?? item.name}</p>
          <p style="margin:2px 0 0;font-size:12px;color:#6b7280;">������: ${item.quantity}</p>
        </td>
        <td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:left;font-weight:600;color:#1e293b;">
          ${(item.price * item.quantity).toFixed(3)} �.�
        </td>
      </tr>`).join('')
  const html = `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;"><tr><td align="center"><table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);"><tr><td style="background:#1e293b;padding:20px 32px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:20px;">${opts.storeName}</h1></td></tr><tr><td style="padding:32px;"><h2 style="color:#1e293b;font-size:20px;margin:0 0 8px;">���� ���� ??</h2><p style="color:#6b7280;font-size:14px;margin:0 0 24px;">���� ${opts.firstName} �� ���� �������� ������� ������ �� ����:</p><table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">${itemsHtml}</table><div style="text-align:center;margin-bottom:24px;"><a href="${opts.cartUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:14px 36px;border-radius:50px;font-size:15px;font-weight:600;">����� ������</a></div></td></tr><tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;"><p style="margin:0;color:#94a3b8;font-size:12px;">${opts.storeName} � ����� ������ ���� ????</p></td></tr></table></td></tr></table></body></html>`
  if (!transporter) {
    console.log(`\n?? [ABANDONED CART] To: ${opts.to}\nCart URL: ${opts.cartUrl}\n`)
    return
  }
  await transporter.sendMail({
    from: `"${opts.storeName}" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}

// ── Merchant: new order alert ────────────────────────────────────────────────
export async function sendMerchantNewOrderEmail(opts: {
  to: string
  merchantName: string
  storeName: string
  orderNumber: string
  total: number
  currency: string
  customerName: string
  itemCount: number
  dashboardUrl: string
}): Promise<void> {
  const subject = `طلب جديد من ${opts.storeName} — #${opts.orderNumber}`
  const html = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,sans-serif;direction:rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f8fafc;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.1);">
        <tr><td style="background:#0f172a;padding:20px 32px;text-align:center;">
          <h1 style="color:#fff;margin:0;font-size:20px;">طلب جديد!</h1>
          <p style="color:#94a3b8;margin:4px 0 0;font-size:13px;">${opts.storeName}</p>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="color:#374151;font-size:16px;margin:0 0 20px;">مرحباً <strong>${opts.merchantName}</strong></p>
          <p style="color:#475569;font-size:14px;margin:0 0 20px;">تلقّيت طلباً جديداً من <strong>${opts.customerName}</strong> يحتوي على <strong>${opts.itemCount} منتج</strong>.</p>
          <div style="background:#f1f5f9;border-radius:8px;padding:16px;margin-bottom:24px;">
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">رقم الطلب</p>
            <p style="margin:0 0 12px;color:#1e293b;font-size:18px;font-weight:bold;font-family:monospace;">${opts.orderNumber}</p>
            <p style="margin:0 0 4px;color:#6b7280;font-size:12px;">الإجمالي</p>
            <p style="margin:0;color:#1e293b;font-size:22px;font-weight:bold;">${Number(opts.total).toFixed(3)} ${opts.currency}</p>
          </div>
          <div style="text-align:center;">
            <a href="${opts.dashboardUrl}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:13px 32px;border-radius:50px;font-size:15px;font-weight:600;">عرض الطلب في لوحة التحكم</a>
          </div>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:14px;text-align:center;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">بازار — منصة التجارة الإلكترونية البحرينية</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  if (!transporter) {
    console.log(`[NEW ORDER] Merchant: ${opts.to} | Order: ${opts.orderNumber} | Total: ${opts.total} ${opts.currency}`)
    return
  }
  await transporter.sendMail({
    from: `"بازار" <${process.env.SMTP_FROM ?? process.env.SMTP_USER}>`,
    to: opts.to,
    subject,
    html,
  })
}