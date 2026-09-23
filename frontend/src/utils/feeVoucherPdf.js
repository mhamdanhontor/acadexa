import { jsPDF } from 'jspdf'

/**
 * Calculates or formats the last fee date (10th of each month).
 * @param {string} feeMonth e.g. "September 2026"
 * @returns {string} e.g. "10th September 2026"
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

  // Stamp Colors: Vibrant Emerald Green or Ruby Ink
  const r = 5, g = 150, b = 105 // Rich Stamp Emerald (#059669)

  // Outer thick circle
  doc.setDrawColor(r, g, b)
  doc.setLineWidth(0.7)
  doc.circle(cx, cy, 14, 'S')

  // Inner dashed circle
  doc.setLineWidth(0.3)
  doc.setLineDashPattern?.([1, 1], 0)
  doc.circle(cx, cy, 12.2, 'S')
  doc.setLineDashPattern?.([], 0)

  // Arc / Header text inside stamp: "HONOR KNOWLEDGE ACADEMY"
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(r, g, b)
  doc.text('HONOR KNOWLEDGE', cx, cy - 8, { align: 'center' })
  doc.text('ACADEMY', cx, cy - 5.5, { align: 'center' })

  // Middle Horizontal banner lines
  doc.setLineWidth(0.4)
  doc.line(cx - 10, cy - 3.2, cx + 10, cy - 3.2)
  doc.line(cx - 10, cy + 3.8, cx + 10, cy + 3.8)

  // Big Bold Center Stamp: "★ PAID ★"
  doc.setFontSize(10.5)
  doc.setFont('helvetica', 'bold')
  doc.text('★  PAID  ★', cx, cy + 1.8, { align: 'center' })

  // Bottom verification line & date
  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'bold')
  doc.text('VERIFIED & RECORDED', cx, cy + 6.5, { align: 'center' })
  doc.setFontSize(5)
  doc.setFont('helvetica', 'normal')
  doc.text(dateStr || 'FEE SECURED', cx, cy + 9.2, { align: 'center' })

  doc.restoreGraphicsState?.()
}

/**
 * Draws a single voucher copy (either Student Copy or Academy Copy).
 * @param {jsPDF} doc
 * @param {number} startY Top offset in mm
 * @param {string} copyType "STUDENT COPY" | "INSTITUTE COPY" | "OFFICE COPY"
 * @param {object} data
 */
function drawSingleVoucherCopy(doc, startY, copyType, data) {
  const {
    student,
    receiptNo,
    feeMonth,
    dueDate,
    today,
    tuitionAmount,
    fineAmount,
    totalPaid,
    paymentMethod = 'Cash / Online',
    notes,
  } = data

  const marginX = 12
  const contentWidth = 186
  const primaryNavy = [26, 44, 76]
  const accentGold = [217, 119, 6]
  const crimsonRed = [220, 38, 38]
  const emeraldGreen = [5, 150, 105]

  // Outer border of voucher copy
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.4)
  doc.roundedRect(marginX, startY, contentWidth, 126, 2, 2, 'S')

  // 1. Top Header Banner
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX, startY, contentWidth, 20, 2, 2, 'F')
  doc.setFillColor(...accentGold)
  doc.rect(marginX, startY + 19, contentWidth, 1, 'F')

  // Academy Name
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text('HONOR KNOWLEDGE ACADEMY', marginX + contentWidth / 2, startY + 8.5, { align: 'center' })

  doc.setFontSize(7.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(226, 232, 240)
  doc.text(
    'OFFICIAL FEE PAYMENT VOUCHER & RECEIPT  •  ACADEMIC SESSION 2026-2027',
    marginX + contentWidth / 2,
    startY + 14.5,
    { align: 'center' }
  )

  // Copy Type Pill (Top Right)
  doc.setFillColor(...accentGold)
  doc.roundedRect(marginX + contentWidth - 36, startY + 4, 32, 6, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.text(copyType, marginX + contentWidth - 20, startY + 8.2, { align: 'center' })

  // 2. Metadata Strip (Receipt #, Issue Date, Billing Month, Last Fee Date)
  const metaY = startY + 24
  doc.setFillColor(248, 250, 252)
  doc.roundedRect(marginX + 2, metaY, contentWidth - 4, 10, 1, 1, 'F')
  doc.setDrawColor(226, 232, 240)
  doc.setLineWidth(0.2)
  doc.roundedRect(marginX + 2, metaY, contentWidth - 4, 10, 1, 1, 'S')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Receipt No:', marginX + 5, metaY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(receiptNo || 'REC-1042', marginX + 22, metaY + 4)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Billing Month:', marginX + 48, metaY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(feeMonth || 'Current Month', marginX + 66, metaY + 4)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(71, 85, 105)
  doc.text('Payment Date:', marginX + 104, metaY + 4)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(today || new Date().toISOString().split('T')[0], marginX + 125, metaY + 4)

  // Last Fee Date (Prominent badge on right)
  doc.setFillColor(238, 242, 255)
  doc.roundedRect(marginX + 145, metaY + 1.5, 36, 7, 1, 1, 'F')
  doc.setDrawColor(99, 102, 241)
  doc.roundedRect(marginX + 145, metaY + 1.5, 36, 7, 1, 1, 'S')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(67, 56, 202)
  doc.text(`Last Fee Date: 10th of Month`, marginX + 163, metaY + 4.5, { align: 'center' })
  doc.setFontSize(5.5)
  doc.text(`(${dueDate})`, marginX + 163, metaY + 7.2, { align: 'center' })

  // 3. Student Particulars Card
  const studentY = startY + 36
  doc.setFillColor(241, 245, 249)
  doc.roundedRect(marginX + 2, studentY, contentWidth - 4, 18, 1.5, 1.5, 'F')
  doc.setDrawColor(203, 213, 225)
  doc.roundedRect(marginX + 2, studentY, contentWidth - 4, 18, 1.5, 1.5, 'S')

  doc.setFontSize(7)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('STUDENT NAME:', marginX + 5, studentY + 5)
  doc.text('ROLL / ID NO:', marginX + 5, studentY + 10)
  doc.text('CLASS / BATCH:', marginX + 5, studentY + 15)

  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(student?.name || '—', marginX + 28, studentY + 5)
  doc.setFont('helvetica', 'normal')
  doc.text(student?.student_code || '—', marginX + 28, studentY + 10)
  const classBatch = [student?.class_room?.name, student?.batch?.name].filter(Boolean).join(' - ') || '—'
  doc.text(classBatch, marginX + 28, studentY + 15)

  // Right column of student particulars
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(100, 116, 139)
  doc.text('GUARDIAN NAME:', marginX + 95, studentY + 5)
  doc.text('WHATSAPP NO:', marginX + 95, studentY + 10)
  doc.text('PAYMENT MODE:', marginX + 95, studentY + 15)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(15, 23, 42)
  doc.text(student?.guardian_name || '—', marginX + 122, studentY + 5)
  doc.text(student?.whatsapp_number || '—', marginX + 122, studentY + 10)
  doc.text(paymentMethod, marginX + 122, studentY + 15)

  // 4. Fee Particulars Table
  const tableY = startY + 56
  // Table Header
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX + 2, tableY, contentWidth - 4, 6.5, 1, 1, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.8)
  doc.text('Sr #', marginX + 6, tableY + 4.5)
  doc.text('Fee Description', marginX + 20, tableY + 4.5)
  doc.text('Due Rule / Terms', marginX + 90, tableY + 4.5)
  doc.text('Amount (PKR)', marginX + contentWidth - 10, tableY + 4.5, { align: 'right' })

  // Row 1: Tuition Fee
  const row1Y = tableY + 6.5
  doc.setFillColor(255, 255, 255)
  doc.rect(marginX + 2, row1Y, contentWidth - 4, 7, 'F')
  doc.setDrawColor(241, 245, 249)
  doc.line(marginX + 2, row1Y + 7, marginX + contentWidth - 2, row1Y + 7)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(51, 65, 85)
  doc.setFontSize(7)
  doc.text('01', marginX + 6, row1Y + 4.5)
  doc.text(`Monthly Tuition Fee (${feeMonth})`, marginX + 20, row1Y + 4.5)
  doc.text('Standard Monthly Academic Fee', marginX + 90, row1Y + 4.5)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(15, 23, 42)
  doc.text(`PKR ${Number(tuitionAmount || 0).toLocaleString()}`, marginX + contentWidth - 10, row1Y + 4.5, {
    align: 'right',
  })

  // Row 2: Late Fee / Fine (IN RED)
  const row2Y = row1Y + 7
  const hasFine = Number(fineAmount) > 0
  if (hasFine) {
    doc.setFillColor(254, 242, 242) // light red background
    doc.rect(marginX + 2, row2Y, contentWidth - 4, 7.5, 'F')
    doc.setDrawColor(254, 202, 202)
    doc.line(marginX + 2, row2Y + 7.5, marginX + contentWidth - 2, row2Y + 7.5)

    // RED text and badge for late fine
    doc.setTextColor(...crimsonRed)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.text('02', marginX + 6, row2Y + 4.8)
    doc.text('Late Fee / Fine (After 10th of Month)', marginX + 20, row2Y + 4.8)

    // Red pill
    doc.setFillColor(...crimsonRed)
    doc.roundedRect(marginX + 86, row2Y + 1.8, 30, 4.2, 0.8, 0.8, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(5.5)
    doc.text('FINE APPLIED (RED)', marginX + 101, row2Y + 4.8, { align: 'center' })

    // Fine Amount in BOLD RED
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...crimsonRed)
    doc.text(`+ PKR ${Number(fineAmount).toLocaleString()}`, marginX + contentWidth - 10, row2Y + 4.8, {
      align: 'right',
    })
  } else {
    doc.setFillColor(250, 250, 250)
    doc.rect(marginX + 2, row2Y, contentWidth - 4, 6.5, 'F')
    doc.setTextColor(148, 163, 184)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(6.8)
    doc.text('02', marginX + 6, row2Y + 4.2)
    doc.text('Late Fee / Fine (Waived / Paid on Time)', marginX + 20, row2Y + 4.2)
    doc.text('Paid on or before 10th of month', marginX + 90, row2Y + 4.2)
    doc.text('PKR 0', marginX + contentWidth - 10, row2Y + 4.2, { align: 'right' })
  }

  // Row 3: Total Paid & Status Banner
  const totalRowY = row2Y + (hasFine ? 7.5 : 6.5)
  doc.setFillColor(...primaryNavy)
  doc.roundedRect(marginX + 2, totalRowY, contentWidth - 4, 8, 1, 1, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.text('TOTAL AMOUNT PAID:', marginX + 6, totalRowY + 5.2)

  // Status badge inside total bar
  doc.setFillColor(...emeraldGreen)
  doc.roundedRect(marginX + 55, totalRowY + 1.8, 22, 4.6, 0.8, 0.8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFontSize(6)
  doc.text('STATUS: PAID', marginX + 66, totalRowY + 4.9, { align: 'center' })

  // Total figure
  doc.setFontSize(9)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(253, 224, 71) // Gold yellow highlight
  doc.text(`PKR ${Number(totalPaid || 0).toLocaleString()}`, marginX + contentWidth - 10, totalRowY + 5.4, {
    align: 'right',
  })

  // 5. Red Notice Box & Rules
  const noticeY = totalRowY + 10
  doc.setFillColor(254, 242, 242)
  doc.roundedRect(marginX + 2, noticeY, 118, 12, 1, 1, 'F')
  doc.setDrawColor(248, 113, 113)
  doc.setLineWidth(0.3)
  doc.roundedRect(marginX + 2, noticeY, 118, 12, 1, 1, 'S')

  doc.setTextColor(...crimsonRed)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.2)
  doc.text('IMPORTANT ACADEMY FEE POLICY & DUE DATE NOTICE:', marginX + 4, noticeY + 3.8)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(5.8)
  doc.text(
    `1. Last fee date is the 10th of each month (${dueDate}).`,
    marginX + 4,
    noticeY + 7.2
  )
  doc.text(
    hasFine
      ? `2. A late fine of PKR ${Number(fineAmount).toLocaleString()} is included in red above due to post-10th payment.`
      : '2. Fees received after the 10th are subject to a late voucher fine.',
    marginX + 4,
    noticeY + 10.4
  )

  // 6. Draw Official "Honor Knowledge Academy" PAID Rubber Stamp
  const stampX = marginX + contentWidth - 35
  const stampY = noticeY + 6
  drawPaidStamp(doc, stampX, stampY, today)

  // 7. Signature lines
  const sigY = startY + 118
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.line(marginX + 6, sigY, marginX + 45, sigY)
  doc.line(marginX + 80, sigY, marginX + 120, sigY)

  doc.setFontSize(5.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text('Cashier / Accounts Officer', marginX + 12, sigY + 3.2)
  doc.text('Authorized Signatory & Stamp', marginX + 83, sigY + 3.2)
  doc.text('Computer-generated valid receipt. No signature needed if stamped.', marginX + 130, sigY + 3.2)
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
  const tuitionAmount = Number(voucherData.feeAmount || 0)
  const fineAmount = Number(voucherData.fineAmount || 0)
  const totalPaid = tuitionAmount + fineAmount

  const enrichedData = {
    ...voucherData,
    dueDate,
    today,
    tuitionAmount,
    fineAmount,
    totalPaid,
  }

  // 1. Top Half: Student Copy
  drawSingleVoucherCopy(doc, 10, 'STUDENT COPY', enrichedData)

  // 2. Perforation separator line in center
  doc.setDrawColor(148, 163, 184)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern?.([2, 2], 0)
  doc.line(10, 147, 200, 147)
  doc.setLineDashPattern?.([], 0)

  doc.setFontSize(6)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(148, 163, 184)
  doc.text('✂  FOLD OR DETACH HERE  —  HONOR KNOWLEDGE ACADEMY OFFICIAL FEE VOUCHER', 105, 146, {
    align: 'center',
  })

  // 3. Bottom Half: Institute / Academy Copy
  drawSingleVoucherCopy(doc, 154, 'INSTITUTE COPY', enrichedData)

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
