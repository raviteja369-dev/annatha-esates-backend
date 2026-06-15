import PDFDocument from 'pdfkit';

const COMPANY = {
  name: 'Anantha Estates',
  tagline: 'Premium Real Estate Plot Management',
  address: 'Hyderabad, Telangana, India',
  email: 'info@ananthaestates.com',
  phone: '+91 98765 43210',
  gst: 'GSTIN: 36XXXXX1234X1ZX',
};

const COLORS = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  accent: '#10B981',
  accentLight: '#D1FAE5',
  slate: '#64748B',
  dark: '#0F172A',
  light: '#F8FAFC',
  border: '#E2E8F0',
};

function formatINR(amount) {
  return `₹${Number(amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function drawHeader(doc, title, receiptNo) {
  const pageWidth = doc.page.width;
  doc.save();
  doc.rect(0, 0, pageWidth, 110).fill(COLORS.primary);
  doc.rect(0, 100, pageWidth, 10).fill(COLORS.primaryDark);

  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(22)
    .text(COMPANY.name, 50, 32);
  doc.font('Helvetica').fontSize(9)
    .text(COMPANY.tagline, 50, 58)
    .text(`${COMPANY.address}  |  ${COMPANY.phone}  |  ${COMPANY.email}`, 50, 72);

  doc.font('Helvetica-Bold').fontSize(16)
    .text(title, pageWidth - 250, 36, { width: 200, align: 'right' });
  doc.font('Helvetica').fontSize(9)
    .text(`Receipt No: ${receiptNo}`, pageWidth - 250, 62, { width: 200, align: 'right' })
    .text(`Date: ${new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}`, pageWidth - 250, 76, { width: 200, align: 'right' });

  doc.restore();
  doc.y = 130;
}

function drawSectionTitle(doc, label, y) {
  doc.fillColor(COLORS.primary).font('Helvetica-Bold').fontSize(11).text(label, 50, y);
  doc.moveTo(50, y + 16).lineTo(545, y + 16).strokeColor(COLORS.border).lineWidth(1).stroke();
  return y + 28;
}

function drawDetailRow(doc, label, value, y, xLabel = 50, xValue = 200) {
  doc.fillColor(COLORS.slate).font('Helvetica').fontSize(10).text(label, xLabel, y);
  doc.fillColor(COLORS.dark).font('Helvetica-Bold').fontSize(10).text(value || '—', xValue, y, { width: 340 });
  return y + 20;
}

export function generatePaymentPdf(payment, type = 'receipt') {
  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  const titles = {
    receipt: 'Payment Receipt',
    booking: 'Booking Confirmation',
    agreement: 'Sale Agreement',
  };
  const receiptNo = payment.transactions?.[0]?.receiptNumber
    || `INV-${String(payment._id).slice(-8).toUpperCase()}`;

  const plot = payment.plot || {};
  const projectName = plot.project?.name || '—';
  const phaseName = plot.phase?.name || '—';
  const customer = payment.customer || {};

  drawHeader(doc, titles[type] || 'Invoice', receiptNo);

  let y = drawSectionTitle(doc, 'Customer Details', 130);
  y = drawDetailRow(doc, 'Name', customer.name, y);
  y = drawDetailRow(doc, 'Mobile', customer.mobile, y);
  y = drawDetailRow(doc, 'Email', customer.email, y);

  y = drawSectionTitle(doc, 'Property Details', y + 10);
  y = drawDetailRow(doc, 'Project', projectName, y);
  y = drawDetailRow(doc, 'Phase', phaseName, y);
  y = drawDetailRow(doc, 'Plot Number', plot.plotNumber, y);
  y = drawDetailRow(doc, 'Plot Size', plot.size ? `${plot.size} sqft` : '—', y);
  y = drawDetailRow(doc, 'Facing', plot.facing, y);
  y = drawDetailRow(doc, 'Plot Value', formatINR(plot.cost), y);

  y = drawSectionTitle(doc, 'Payment Summary', y + 10);

  const rows = [
    ['Total Amount', formatINR(payment.totalAmount)],
    ['Booking Amount', formatINR(payment.bookingAmount)],
    ['Down Payment', formatINR(payment.downPayment)],
    ['Total Paid', formatINR(payment.totalPaid)],
    ['Balance Due', formatINR(payment.remainingAmount)],
  ];

  const tableTop = y;
  doc.rect(50, tableTop, 495, 24).fill(COLORS.primary);
  doc.fillColor('#FFFFFF').font('Helvetica-Bold').fontSize(10)
    .text('Description', 60, tableTop + 7)
    .text('Amount', 420, tableTop + 7);

  let rowY = tableTop + 24;
  rows.forEach((row, i) => {
    const bg = i % 2 === 0 ? COLORS.light : '#FFFFFF';
    doc.rect(50, rowY, 495, 22).fill(bg);
    doc.fillColor(COLORS.dark).font(i === rows.length - 1 ? 'Helvetica-Bold' : 'Helvetica').fontSize(10)
      .text(row[0], 60, rowY + 6)
      .text(row[1], 420, rowY + 6);
    rowY += 22;
  });

  doc.rect(50, tableTop, 495, rowY - tableTop).strokeColor(COLORS.border).lineWidth(1).stroke();

  if (payment.transactions?.length) {
    y = rowY + 20;
    y = drawSectionTitle(doc, 'Transaction History', y);
    payment.transactions.forEach((txn) => {
      y = drawDetailRow(
        doc,
        new Date(txn.date).toLocaleDateString('en-IN'),
        `${txn.type?.replace('_', ' ')} — ${formatINR(txn.amount)}`,
        y
      );
    });
  }

  const footerY = doc.page.height - 80;
  doc.rect(0, footerY, doc.page.width, 60).fill(COLORS.accentLight);
  doc.fillColor(COLORS.primaryDark).font('Helvetica-Bold').fontSize(11)
    .text('Thank you for choosing Anantha Estates!', 50, footerY + 14, { align: 'center', width: doc.page.width - 100 });
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.slate)
    .text(`${COMPANY.gst}  |  This is a computer-generated document.`, 50, footerY + 34, { align: 'center', width: doc.page.width - 100 });

  return doc;
}
