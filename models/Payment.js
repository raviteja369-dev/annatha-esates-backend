import mongoose from 'mongoose';

const paymentSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    plot: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot', required: true },
    bookingAmount: { type: Number, default: 0 },
    downPayment: { type: Number, default: 0 },
    emiAmount: { type: Number, default: 0 },
    emiMonths: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true },
    totalPaid: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },
    duePayments: [
      {
        amount: Number,
        dueDate: Date,
        status: { type: String, enum: ['pending', 'paid', 'overdue'], default: 'pending' },
        paidDate: Date,
      },
    ],
    transactions: [
      {
        amount: Number,
        type: { type: String, enum: ['booking', 'down_payment', 'emi', 'other'] },
        date: { type: Date, default: Date.now },
        receiptNumber: String,
        notes: String,
      },
    ],
    status: { type: String, enum: ['active', 'completed', 'defaulted'], default: 'active' },
  },
  { timestamps: true }
);

export default mongoose.model('Payment', paymentSchema);
