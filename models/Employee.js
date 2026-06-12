import mongoose from 'mongoose';

const employeeSchema = new mongoose.Schema(
  {
    employeeCode: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    mobile: { type: String, required: true },
    email: { type: String, required: true },
    address: { type: String, default: '' },
    profilePhoto: { type: String, default: '' },
    salesTarget: { type: Number, default: 0 },
    joiningDate: { type: Date, default: Date.now },
    isActive: { type: Boolean, default: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export default mongoose.model('Employee', employeeSchema);
