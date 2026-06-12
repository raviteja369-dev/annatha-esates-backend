import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, default: '' },
    source: { type: String, default: 'walk-in' },
    status: {
      type: String,
      enum: ['new', 'contacted', 'qualified', 'site_visit', 'negotiation', 'converted', 'lost'],
      default: 'new',
    },
    interestedProject: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    notes: { type: String, default: '' },
    followUpDate: { type: Date },
  },
  { timestamps: true }
);

export default mongoose.model('Lead', leadSchema);
