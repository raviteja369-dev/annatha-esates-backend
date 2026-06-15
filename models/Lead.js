import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    source: { type: String, default: 'walk-in' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'converted', 'lost'],
      default: 'new',
    },
    interestedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    notes: { type: String, default: '' },
    followUpDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
