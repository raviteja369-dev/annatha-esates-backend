import mongoose from 'mongoose';

const plotSchema = new mongoose.Schema(
  {
    plotNumber: { type: String, required: true },
    plotName: { type: String, default: '' },
    size: { type: Number, required: true },
    facing: { type: String, enum: ['North', 'South', 'East', 'West', 'NE', 'NW', 'SE', 'SW'], default: 'East' },
    cost: { type: Number, required: true },
    status: {
      type: String,
      enum: ['available', 'pending', 'reserved', 'sold', 'cancelled', 'under_processing'],
      default: 'available',
    },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phase: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase', required: true },
    assignedEmployee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
    notes: { type: String, default: '' },
    documents: [{ name: String, url: String, uploadedAt: { type: Date, default: Date.now } }],
    position: { x: { type: Number, default: 0 }, y: { type: Number, default: 0 } },
    order: { type: Number, default: 0 },
    active: { type: Boolean, default: false },
    sourceLayoutId: { type: mongoose.Schema.Types.ObjectId, ref: 'Layout', default: null },
  },
  { timestamps: true }
);

plotSchema.index({ project: 1, phase: 1, plotNumber: 1 }, { unique: true });
plotSchema.index({ active: 1, project: 1, phase: 1 });

export default mongoose.model('Plot', plotSchema);
