import mongoose from 'mongoose';

const customerSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, default: '' },
    aadhaar: { type: String, default: '' },
    address: { type: String, default: '' },
    plotPurchased: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot' },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    notes: { type: String, default: '' },
    followUpDate: { type: Date },
    followUpStatus: { type: String, enum: ['pending', 'contacted', 'interested', 'not_interested'], default: 'pending' },
  },
  { timestamps: true }
);

export default mongoose.model('Customer', customerSchema);
