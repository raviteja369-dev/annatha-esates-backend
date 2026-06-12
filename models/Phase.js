import mongoose from 'mongoose';

const phaseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    description: { type: String, default: '' },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

export default mongoose.model('Phase', phaseSchema);
