import PDFDocument from 'pdfkit'
import { Readable } from 'stream'

interface InvoiceLineItem {
  nameAr: string
  name: string
  quantity: number
  price: number
  total: number
}

interface InvoiceData {
  orderNumber: string
  createdAt: Date
  storeName: string
  storeNameAr: string
  vatNumber?: string | null
  crNumber?: string | null
  customerName: string
  customerPhone: string
  address?: string | null
  items: InvoiceLineItem[]
  subtotal: number
  discountAmount: number
  shippingCost: number
  vatAmount: number
  total: number
  paymentMethod: string
  currency: string
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH_ON_DELIVERY: 'Cash on Delivery',
  BENEFIT_PAY: 'BenefitPay',
  CREDIMAX: 'Credimax',
  VISA_MASTERCARD: 'Visa / Mastercard',
  BANK_TRANSFER: 'Bank Transfer',
  APPLE_PAY: 'Apple Pay',
  GOOGLE_PAY: 'Google Pay',
}

function fmt(amount: number, currency = 'BHD') {
  return `${Number(amount).toFixed(3)} ${currency}`
}

export function generateInvoicePDF(data: InvoiceData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 })
    const buffers: Buffer[] = []

    doc.on('data', (chunk) => buffers.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(buffers)))
    doc.on('error', reject)

    const pageWidth = doc.page.width - 100 // margins

    // ── Header ─────────────────────────────────────
    doc
      .fillColor('#1e293b')
      .fontSize(22)
      .font('Helvetica-Bold')
      .text(data.storeNameAr || data.storeName, 50, 50, { align: 'right', width: pageWidth })

    doc
      .fontSize(10)
      .font('Helvetica')
      .fillColor('#64748b')
      .text('TAX INVOICE / فاتورة ضريبية', 50, 80, { align: 'right', width: pageWidth })

    if (data.vatNumber) {
      doc.text(`VAT Reg. No: ${data.vatNumber}`, 50, 94, { align: 'right', width: pageWidth })
    }
    if (data.crNumber) {
      doc.text(`CR No: ${data.crNumber}`, 50, 108, { align: 'right', width: pageWidth })
    }

    // Divider
    const dividerY = 130
    doc.moveTo(50, dividerY).lineTo(545, dividerY).strokeColor('#e2e8f0').lineWidth(1).stroke()

    // ── Invoice meta (two columns) ──────────────────
    const metaY = dividerY + 14
    doc.font('Helvetica-Bold').fillColor('#374151').fontSize(10)
      .text('Invoice No:', 50, metaY)
      .text('Date:', 50, metaY + 16)
      .text('Payment:', 50, metaY + 32)

    doc.font('Helvetica').fillColor('#1e293b')
      .text(data.orderNumber, 160, metaY)
      .text(new Date(data.createdAt).toLocaleDateString('en-GB'), 160, metaY + 16)
      .text(PAYMENT_LABELS[data.paymentMethod] ?? data.paymentMethod, 160, metaY + 32)

    doc.font('Helvetica-Bold').fillColor('#374151')
      .text('Billed To:', 330, metaY)
    doc.font('Helvetica').fillColor('#1e293b')
      .text(data.customerName, 430, metaY)
      .text(data.customerPhone, 430, metaY + 16)
    if (data.address) {
      doc.text(data.address, 430, metaY + 32, { width: 115 })
    }

    // ── Items Table ────────────────────────────────
    const tableTop = metaY + 80

    // Table header background
    doc.rect(50, tableTop, pageWidth, 22).fill('#1e293b')
    doc.font('Helvetica-Bold').fillColor('#ffffff').fontSize(9)
      .text('ITEM', 60, tableTop + 7, { width: 240 })
      .text('QTY', 300, tableTop + 7, { width: 60, align: 'right' })
      .text('UNIT PRICE', 360, tableTop + 7, { width: 80, align: 'right' })
      .text('TOTAL', 440, tableTop + 7, { width: 100 - 5, align: 'right' })

    let rowY = tableTop + 22
    data.items.forEach((item, i) => {
      const bg = i % 2 === 0 ? '#f8fafc' : '#ffffff'
      doc.rect(50, rowY, pageWidth, 20).fill(bg)

      doc.font('Helvetica').fillColor('#1e293b').fontSize(9)
        .text(`${item.nameAr} / ${item.name}`, 60, rowY + 5, { width: 235, ellipsis: true })
        .text(String(item.quantity), 300, rowY + 5, { width: 60, align: 'right' })
        .text(fmt(item.price, data.currency), 360, rowY + 5, { width: 80, align: 'right' })
        .text(fmt(item.total, data.currency), 440, rowY + 5, { width: 100 - 5, align: 'right' })

      rowY += 20
    })

    // Table bottom border
    doc.moveTo(50, rowY).lineTo(545, rowY).strokeColor('#e2e8f0').lineWidth(1).stroke()

    // ── Totals ─────────────────────────────────────
    rowY += 12
    const totalsX = 380
    const totalsValueX = 480

    const addTotal = (label: string, value: string, bold = false) => {
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fillColor(bold ? '#1e293b' : '#64748b')
        .fontSize(9)
        .text(label, totalsX, rowY, { width: 90 })
        .text(value, totalsValueX, rowY, { width: 60, align: 'right' })
      rowY += 16
    }

    addTotal('Subtotal:', fmt(data.subtotal, data.currency))
    if (data.discountAmount > 0) {
      doc.fillColor('#16a34a')
      addTotal('Discount:', `- ${fmt(data.discountAmount, data.currency)}`)
    }
    if (data.shippingCost > 0) addTotal('Shipping:', fmt(data.shippingCost, data.currency))
    if (data.vatAmount > 0) addTotal('VAT (10%):', fmt(data.vatAmount, data.currency))

    // Total line
    doc.moveTo(totalsX, rowY).lineTo(545, rowY).strokeColor('#1e293b').lineWidth(1).stroke()
    rowY += 6
    addTotal('TOTAL:', fmt(data.total, data.currency), true)

    // ── Footer ─────────────────────────────────────
    doc
      .fontSize(8)
      .font('Helvetica')
      .fillColor('#94a3b8')
      .text('Powered by Bazar — بزار | bazar.bh', 50, doc.page.height - 60, {
        align: 'center',
        width: pageWidth,
      })

    doc.end()
  })
}
