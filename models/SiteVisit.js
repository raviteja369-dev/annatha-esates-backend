import mongoose from 'mongoose';

const siteVisitSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead' },
    plot: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot' },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true },
    scheduledDate: { type: Date, required: true },
    status: { type: String, enum: ['scheduled', 'completed', 'cancelled', 'rescheduled'], default: 'scheduled' },
    notes: { type: String, default: '' },
    feedback: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('SiteVisit', siteVisitSchema);
