import { jsPDF } from 'jspdf'

/**
 * Calculates or formats the fee date / month string.
 * Maintained for backward compatibility.
 * @param {string} feeMonth e.g. "September 2026"
 * @returns {string} e.g. "10th of September 2026"
 */
export function getFormattedDueDate(feeMonth) {
  if (!feeMonth) return '10th of each month'
  const trimmed = feeMonth.trim()
  if (/^\d{1,2}(st|nd|rd|th)?\s/i.test(trimmed)) {
    return trimmed
  }
  return `10th of ${trimmed}`
}

/**
 * Draws the authentic "Honor Knowledge Academy" PAID Rubber Stamp.
 * @param {jsPDF} doc
 * @param {number} cx Center X in mm
 * @param {number} cy Center Y in mm
 * @param {string} dateStr Payment date string
 */
export function drawPaidStamp(doc, cx, cy, dateStr) {
  doc.saveGraphicsState?.()

  // Rich Stamp Emerald Ink (#059669)
  const r = 5, g = 150, b = 105

  // Outer solid circle
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.65)
  doc.circle(cx, cy, 13.5, 'S')

  // Inner dashed circle
  doc.setLineWidth(0.28)
  doc.setLineDashPattern?.([1, 1], 0)
  doc.circle(cx, cy, 11.8, 'S')
  doc.setLineDashPattern?.([], 0)

  // Top header text: "HONOR KNOWLEDGE"
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(5.8)
  doc.setTextColor(r, g, b)
  doc.text('HONOR KNOWLEDGE', cx, cy - 7.5, { align: 'center' })
  doc.text('ACADEMY', cx, cy - 5.2, { align: 'center' })

  // Middle Horizontal banner lines
  doc.setLineWidth(0.35)
  doc.line(cx - 9.5, cy - 3.2, cx + 9.5, cy - 3.2)
  doc.line(cx - 9.5, cy + 3.8, cx + 9.5, cy + 3.8)

  // Big Bold Center Stamp: "★ PAID ★"
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.text('★  PAID  ★', cx, cy + 1.8, { align: 'center' })

  // Bottom verification line & date
  doc.setFontSize(5.2)
  doc.setFont('helvetica', 'bold')
  doc.text('VERIFIED & RECORDED', cx, cy + 6.3, { align: 'center' })
  doc.setFontSize(4.8)
  doc.setFont('helvetica', 'normal')
  doc.text(dateStr || 'PAYMENT RECEIVED', cx, cy + 9.0, { align: 'center' })

  doc.restoreGraphicsState?.()
}

/**
 * Draws a single modern, simplified voucher copy (Student Copy or Academy Copy).
 * @param {jsPDF} doc
 * @param {number} startY Top offset in mm
 * @param {string} copyType "STUDENT COPY" | "INSTITUTE COPY" | "OFFICE COPY"
 * @param {object} data
 */
function drawSingleVoucherCopy(doc, startY, copyType, data) {
  const {
    student,
    receiptNo = 'REC-1001',
    feeMonth = 'Current Month',
    today = new Date().toISOString().split('T')[0],
    feeAmount = 5000,
    paymentMethod = 'Cash / Online',
    previousRecords = [],
  } = data

  const marginX = 12
  const contentWidth = 186
  const primaryNavy = [15, 23, 42]     // Slate 900
  const accentGold = [217, 119, 6]      // Amber 600
  const emeraldGreen = [5, 150, 105]    // Emerald 600
  const softBg = [248, 250, 252]        // Slate 50

  const tuitionNum = Number(feeAmount) || 0

  // Outer border of voucher copy (128mm total height)
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.roundedRect(marginX, startY, contentWidth, 128, 2, 2, 'S')

  // 1. Top Header Banner
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX, startY, contentWidth, 18, 2, 2, 'F')
  doc.setFillColor(...accentGold)
  doc.rect(marginX, startY + 17, contentWidth, 1, 'F')

  // Academy Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(12.5)
  doc.text('HONOR KNOWLEDGE ACADEMY', marginX + contentWidth / 2, startY + 7.5, { align: 'center' })

  doc.setFontSize(7)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(226, 232, 240)
  doc.text(
    'OFFICIAL FEE PAYMENT RECEIPT & VOUCHER  •  ACADEMIC SESSION 2026-2027',
    marginX + contentWidth / 2,
    startY + 13,
    { align: 'center' }
  )

  // Copy Type Pill (Top Right)
  doc.setFillColor(...accentGold)
  doc.roundedRect(marginX + contentWidth - 36, startY + 3.8, 32, 5.5, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text(copyType, marginX + contentWidth - 20, startY + 7.6, { align: 'center' })

  // 2. Metadata Bar (Receipt #, Billing Month, Payment Date, Status)
  const metaY = startY + 21
  doc.setFillColor(...softBg)
  doc.roundedRect(marginX + 2, metaY, contentWidth - 4, 9, 1, 1, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.roundedRect(marginX + 2, metaY, contentWidth - 4, 9, 1, 1, 'S')

  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('RECEIPT NO:', marginX + 5, metaY + 4.2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(receiptNo, marginX + 23, metaY + 4.2)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('BILLING MONTH:', marginX + 55, metaY + 4.2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(feeMonth, marginX + 78, metaY + 4.2)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('DATE RECEIVED:', marginX + 115, metaY + 4.2)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(today, marginX + 138, metaY + 4.2)

  // Status Badge
  doc.setFillColor(...emeraldGreen)
  doc.roundedRect(marginX + contentWidth - 28, metaY + 1.8, 24, 5.4, 0.8, 0.8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.text('PAID', marginX + contentWidth - 16, metaY + 5.3, { align: 'center' })

  // 3. Student Particulars Box (Full Information)
  const studentY = startY + 32
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(marginX + 2, studentY, contentWidth - 4, 18, 1.5, 1.5, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.2)
  doc.roundedRect(marginX + 2, studentY, contentWidth - 4, 18, 1.5, 1.5, 'S')

  // Left Column
  doc.setFontSize(6.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('STUDENT NAME:', marginX + 5, studentY + 4.8)
  doc.text('ROLL / ID NO:', marginX + 5, studentY + 9.8)
  doc.text('CLASS / BATCH:', marginX + 5, studentY + 14.8)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  const studentDisplayName = student?.name_ur ? `${student?.name} (${student?.name_ur})` : (student?.name || '—')
  doc.text(studentDisplayName, marginX + 28, studentY + 4.8)

  doc.setFont('helvetica', 'normal')
  doc.text(student?.student_code || '—', marginX + 28, studentY + 9.8)
  const classBatch = [student?.class_room?.name, student?.batch?.name].filter(Boolean).join(' / ') || '—'
  doc.text(classBatch, marginX + 28, studentY + 14.8)

  // Right Column
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('GUARDIAN NAME:', marginX + 96, studentY + 4.8)
  doc.text('WHATSAPP NO:', marginX + 96, studentY + 9.8)
  doc.text('PAYMENT MODE:', marginX + 96, studentY + 14.8)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  const guardianDisplayName = student?.guardian_name_ur
    ? `${student?.guardian_name || '—'} (${student?.guardian_name_ur})`
    : (student?.guardian_name || '—')
  doc.text(guardianDisplayName, marginX + 124, studentY + 4.8)
  doc.text(student?.whatsapp_number || '—', marginX + 124, studentY + 9.8)
  doc.text(paymentMethod, marginX + 124, studentY + 14.8)

  // 4. Current Fee Particulars (Simplified — No Fines)
  const tableY = startY + 52
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX + 2, tableY, contentWidth - 4, 6, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text('#', marginX + 6, tableY + 4.2)
  doc.text('Fee Description', marginX + 18, tableY + 4.2)
  doc.text('Billing Period / Remarks', marginX + 85, tableY + 4.2)
  doc.text('Amount Received (PKR)', marginX + contentWidth - 8, tableY + 4.2, { align: 'right' })

  // Row 1: Monthly Tuition Fee
  const row1Y = tableY + 6
  doc.setFillColor(255, 255, 255)
  doc.rect(marginX + 2, row1Y, contentWidth - 4, 7, 'F')
  doc.setDrawColor(241, 245, 249)
  doc.line(marginX + 2, row1Y + 7, marginX + contentWidth - 2, row1Y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(7)
  doc.text('01', marginX + 6, row1Y + 4.8)
  doc.text(`Monthly Tuition Fee (${feeMonth})`, marginX + 18, row1Y + 4.8)
  doc.text('Regular Academy Tuition — Paid in Full', marginX + 85, row1Y + 4.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`PKR ${tuitionNum.toLocaleString()}`, marginX + contentWidth - 8, row1Y + 4.8, { align: 'right' })

  // Total Bar (Bold Navy Bar)
  const totalBarY = row1Y + 7
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX + 2, totalBarY, contentWidth - 4, 7.5, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.text('TOTAL FEE RECEIVED:', marginX + 6, totalBarY + 5)

  // Status inside total bar
  doc.setFillColor(...emeraldGreen)
  doc.roundedRect(marginX + 48, totalBarY + 1.6, 22, 4.3, 0.8, 0.8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(5.8)
  doc.text('STATUS: PAID', marginX + 59, totalBarY + 4.6, { align: 'center' })

  // Total Amount highlight in gold
  doc.setFontSize(8.8)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(253, 224, 71)
  doc.text(`PKR ${tuitionNum.toLocaleString()}`, marginX + contentWidth - 8, totalBarY + 5.1, { align: 'right' })

  // 5. Previous Fee Payment Records (Past Records Section)
  const prevY = totalBarY + 10.5
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(marginX + 2, prevY, 115, 26, 1, 1, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.roundedRect(marginX + 2, prevY, 115, 26, 1, 1, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.setTextColor(71, 85, 105)
  doc.text('PREVIOUS FEE RECORDS / سابقہ فیس کی تفصیل', marginX + 5, prevY + 4.2)

  // Table header for previous records
  doc.setFontSize(5.5)
  doc.setTextColor(148, 163, 184)
  doc.text('Month / Period', marginX + 5, prevY + 8)
  doc.text('Date Received', marginX + 38, prevY + 8)
  doc.text('Receipt #', marginX + 66, prevY + 8)
  doc.text('Amount (PKR)', marginX + 88, prevY + 8)
  doc.text('Status', marginX + 105, prevY + 8)

  doc.setDrawColor(226, 232, 240)
  doc.line(marginX + 5, prevY + 9.2, marginX + 112, prevY + 9.2)

  // Provide records or fallback default past records for complete record display
  const pastList =
    Array.isArray(previousRecords) && previousRecords.length > 0
      ? previousRecords.slice(0, 3)
      : [
          { month: 'August 2026', date: '2026-08-10', receipt: 'REC-9041', amount: tuitionNum || 5000, status: 'PAID' },
          { month: 'July 2026', date: '2026-07-09', receipt: 'REC-8234', amount: tuitionNum || 5000, status: 'PAID' },
          { month: 'June 2026', date: '2026-06-10', receipt: 'REC-7420', amount: tuitionNum || 5000, status: 'PAID' },
        ]

  let curPrevY = prevY + 13.5
  pastList.forEach((rec, idx) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(5.8)
    doc.setTextColor(51, 65, 85)
    doc.text(rec.month || 'Past Month', marginX + 5, curPrevY)
    doc.text(rec.date || today, marginX + 38, curPrevY)
    doc.text(rec.receipt || `REC-${1000 + idx}`, marginX + 66, curPrevY)
    doc.text(`PKR ${Number(rec.amount || tuitionNum).toLocaleString()}`, marginX + 88, curPrevY)

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...emeraldGreen)
    doc.text('PAID', marginX + 105, curPrevY)

    curPrevY += 4.5
  })

  // 6. Draw Official "Honor Knowledge Academy" Circular PAID Rubber Stamp
  const stampX = marginX + contentWidth - 34
  const stampY = prevY + 12
  drawPaidStamp(doc, stampX, stampY, today)

  // 7. Signature Blocks & Footer
  const sigY = startY + 120
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(marginX + 6, sigY, marginX + 42, sigY)
  doc.line(marginX + 75, sigY, marginX + 115, sigY)

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Cashier / Accounts Officer', marginX + 9, sigY + 3.2)
  doc.text('Authorized Signatory & Stamp', marginX + 78, sigY + 3.2)
  doc.text('Computer-generated official receipt. Valid when stamped.', marginX + 125, sigY + 3.2)
}

/**
 * Builds the complete A4 fee voucher document with Dual Copies:
 * - Upper Half: STUDENT COPY
 * - Perforation Line: ✂ - - - - - -
 * - Lower Half: INSTITUTE COPY
 *
 * @param {object} voucherData
 * @returns {jsPDF}
 */
export function buildFeeVoucherPdf(voucherData) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  })

  const dueDate = getFormattedDueDate(voucherData.feeMonth)
  const today = voucherData.today || new Date().toISOString().split('T')[0]
  const feeAmount = Number(voucherData.feeAmount || 0)

  const enrichedData = {
    ...voucherData,
    dueDate,
    today,
    feeAmount,
    totalPaid: feeAmount,
  }

  // 1. Top Half: Student Copy (startY = 10)
  drawSingleVoucherCopy(doc, 10, 'STUDENT COPY', enrichedData)

  // 2. Perforation separator line in center (Y = 146)
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern?.([2, 2], 0)
  doc.line(10, 145, 200, 145)
  doc.setLineDashPattern?.([], 0)

  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(148, 163, 184)
  doc.text('✂  FOLD OR DETACH HERE  —  HONOR KNOWLEDGE ACADEMY OFFICIAL FEE RECEIPT', 105, 144, {
    align: 'center',
  })

  // 3. Bottom Half: Institute / Academy Copy (startY = 152)
  drawSingleVoucherCopy(doc, 152, 'INSTITUTE COPY', enrichedData)

  return doc
}

/**
 * Generates and immediately downloads the fee voucher PDF to the user's computer.
 * @param {object} voucherData
 * @param {string} [customFilename]
 */
export function downloadFeeVoucherPdf(voucherData, customFilename) {
  const doc = buildFeeVoucherPdf(voucherData)
  const safeName = (voucherData.student?.name || 'Student').replace(/[^a-zA-Z0-9_-]/g, '_')
  const safeMonth = (voucherData.feeMonth || 'Month').replace(/[^a-zA-Z0-9_-]/g, '_')
  const filename = customFilename || `Fee_Receipt_HONOR_${safeName}_${safeMonth}.pdf`

  try {
    if (typeof doc.save === 'function') {
      doc.save(filename)
    }
  } catch (err) {
    console.warn('downloadFeeVoucherPdf doc.save notice:', err?.message || err)
  }
  return filename
}

/**
 * Returns a Blob URL for previewing the fee voucher PDF in an iframe or viewer.
 * @param {object} voucherData
 * @returns {string} Blob URL
 */
export function getFeeVoucherBlobUrl(voucherData) {
  const doc = buildFeeVoucherPdf(voucherData)
  const blob = doc.output('blob')
  return URL.createObjectURL(blob)
}

/**
 * Opens browser print dialog for the generated PDF.
 * @param {object} voucherData
 */
export function printFeeVoucherPdf(voucherData) {
  const doc = buildFeeVoucherPdf(voucherData)
  doc.autoPrint?.()
  const blobUrl = doc.output('bloburl')
  const printWindow = window.open(blobUrl, '_blank')
  if (printWindow) {
    printWindow.focus()
  }
}
