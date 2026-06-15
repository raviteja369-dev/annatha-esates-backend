import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: '' },
    location: { type: String, default: '' },
    totalArea: { type: String, default: '' },
    status: { type: String, enum: ['active', 'completed', 'upcoming'], default: 'active' },
    publishStatus: { type: String, enum: ['draft', 'published'], default: 'published' },
    image: { type: String, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Project', projectSchema);
