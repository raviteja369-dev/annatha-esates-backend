import express from 'express';
import PDFDocument from 'pdfkit';
import Payment from '../models/Payment.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const payments = await Payment.find()
      .populate('customer', 'name mobile email')
      .populate('plot', 'plotNumber size cost')
      .sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customer')
      .populate({ path: 'plot', populate: { path: 'project phase' } });
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const { totalAmount, totalPaid = 0 } = req.body;
    const payment = await Payment.create({
      ...req.body,
      remainingAmount: totalAmount - totalPaid,
    });
    res.status(201).json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/transaction', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ message: 'Payment not found' });
    const { amount, type, notes } = req.body;
    payment.transactions.push({
      amount,
      type,
      notes,
      receiptNumber: `RCP-${Date.now()}`,
    });
    payment.totalPaid += amount;
    payment.remainingAmount = payment.totalAmount - payment.totalPaid;
    if (payment.remainingAmount <= 0) payment.status = 'completed';
    await payment.save();
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/pdf/:type', async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customer')
      .populate('plot');
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const doc = new PDFDocument();
    const type = req.params.type;
    const titles = { receipt: 'Payment Receipt', booking: 'Booking Confirmation', agreement: 'Sale Agreement' };
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${payment._id}.pdf`);
    doc.pipe(res);
    doc.fontSize(20).text(titles[type] || 'Document', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Customer: ${payment.customer?.name}`);
    doc.text(`Plot: ${payment.plot?.plotNumber}`);
    doc.text(`Total Amount: ₹${payment.totalAmount.toLocaleString('en-IN')}`);
    doc.text(`Total Paid: ₹${payment.totalPaid.toLocaleString('en-IN')}`);
    doc.text(`Remaining: ₹${payment.remainingAmount.toLocaleString('en-IN')}`);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`);
    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
