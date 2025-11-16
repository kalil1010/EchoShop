/**
 * PDF generation for vendor payout statements
 */

import PDFDocument from 'pdfkit'

interface Payout {
  id: string
  payout_number: string
  amount: number
  currency: string
  status: string
  payout_date: string
  paid_at: string | null
  payment_method: string | null
  payment_reference: string | null
  notes: string | null
  created_at: string
}

interface Transaction {
  id: string
  order_id: string | null
  amount: number
  currency: string
  description: string | null
  transaction_type: string
  created_at: string
}

interface VendorInfo {
  name: string
  address: string
  email: string
}

interface PayoutStatementData {
  payout: Payout
  transactions: Transaction[]
  vendor: VendorInfo
}

/**
 * Generate a PDF statement for a payout
 */
export async function generatePayoutStatementPDF(
  data: PayoutStatementData,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 50, size: 'A4' })
      const chunks: Buffer[] = []

      doc.on('data', (chunk) => chunks.push(chunk))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      // Header
      doc.fontSize(20).text('Payout Statement', { align: 'center' })
      doc.moveDown()

      // Vendor Info
      doc.fontSize(12)
      doc.text(`Vendor: ${data.vendor.name}`)
      if (data.vendor.address) {
        doc.text(`Address: ${data.vendor.address}`)
      }
      if (data.vendor.email) {
        doc.text(`Email: ${data.vendor.email}`)
      }
      doc.moveDown()

      // Payout Details
      doc.fontSize(14).text('Payout Details', { underline: true })
      doc.fontSize(10)
      doc.text(`Payout Number: ${data.payout.payout_number}`)
      doc.text(`Amount: ${data.payout.amount.toFixed(2)} ${data.payout.currency}`)
      doc.text(`Status: ${data.payout.status.toUpperCase()}`)
      doc.text(`Payout Date: ${new Date(data.payout.payout_date).toLocaleDateString()}`)
      if (data.payout.paid_at) {
        doc.text(`Paid At: ${new Date(data.payout.paid_at).toLocaleString()}`)
      }
      if (data.payout.payment_method) {
        doc.text(`Payment Method: ${data.payout.payment_method}`)
      }
      if (data.payout.payment_reference) {
        doc.text(`Payment Reference: ${data.payout.payment_reference}`)
      }
      doc.moveDown()

      // Transactions
      if (data.transactions.length > 0) {
        doc.fontSize(14).text('Transactions', { underline: true })
        doc.moveDown(0.5)

        // Table header
        doc.fontSize(10)
        const tableTop = doc.y
        doc.text('Date', 50, tableTop)
        doc.text('Description', 150, tableTop)
        doc.text('Type', 350, tableTop)
        doc.text('Amount', 400, tableTop, { align: 'right' })
        doc.moveDown(0.3)

        // Draw line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
        doc.moveDown(0.3)

        // Transactions
        let totalAmount = 0
        data.transactions.forEach((transaction) => {
          const date = new Date(transaction.created_at).toLocaleDateString()
          const description = transaction.description || `Order ${transaction.order_id || 'N/A'}`
          const type = transaction.transaction_type.toUpperCase()
          const amount = transaction.amount

          totalAmount += amount

          doc.text(date, 50)
          doc.text(description.substring(0, 30), 150)
          doc.text(type, 350)
          doc.text(`${amount.toFixed(2)} ${transaction.currency}`, 400, undefined, { align: 'right' })
          doc.moveDown(0.3)
        })

        // Total line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
        doc.moveDown(0.3)
        doc.fontSize(12).font('Helvetica-Bold')
        doc.text('Total:', 350)
        doc.text(
          `${totalAmount.toFixed(2)} ${data.payout.currency}`,
          400,
          undefined,
          { align: 'right' },
        )
        doc.font('Helvetica')
        doc.moveDown()
      }

      // Notes
      if (data.payout.notes) {
        doc.fontSize(12).text('Notes', { underline: true })
        doc.fontSize(10).text(data.payout.notes)
        doc.moveDown()
      }

      // Footer
      doc.fontSize(8)
      doc.text(
        `Generated on ${new Date().toLocaleString()}`,
        50,
        doc.page.height - 50,
        { align: 'center' },
      )

      doc.end()
    } catch (error) {
      reject(error)
    }
  })
}

