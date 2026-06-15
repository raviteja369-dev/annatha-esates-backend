import express from 'express';
import Payment from '../models/Payment.js';
import { protect, authorize } from '../middleware/auth.js';
import { generatePaymentPdf } from '../utils/paymentInvoice.js';

const router = express.Router();

router.use(protect);

const populatePayment = (query) => query
  .populate('customer', 'name mobile email address')
  .populate({
    path: 'plot',
    select: 'plotNumber plotName size facing cost project phase',
    populate: [
      { path: 'project', select: 'name location' },
      { path: 'phase', select: 'name' },
    ],
  });

router.get('/', async (req, res) => {
  try {
    const payments = await populatePayment(Payment.find()).sort({ createdAt: -1 });
    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const payment = await populatePayment(Payment.findById(req.params.id));
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
      transactions: totalPaid > 0 ? [{
        amount: totalPaid,
        type: 'booking',
        receiptNumber: `RCP-${Date.now()}`,
        notes: 'Initial payment on record creation',
      }] : [],
    });
    const populated = await populatePayment(Payment.findById(payment._id));
    res.status(201).json(populated);
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
    const populated = await populatePayment(Payment.findById(payment._id));
    res.json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id/pdf/:type', async (req, res) => {
  try {
    const payment = await populatePayment(Payment.findById(req.params.id));
    if (!payment) return res.status(404).json({ message: 'Payment not found' });

    const type = req.params.type;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=${type}-${payment._id}.pdf`);

    const doc = generatePaymentPdf(payment, type);
    doc.pipe(res);
    doc.end();
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
