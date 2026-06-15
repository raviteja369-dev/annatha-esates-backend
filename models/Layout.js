import mongoose from 'mongoose';

const layoutElementSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: {
      type: String,
      enum: ['plot', 'road', 'tree', 'landscape', 'amenity', 'boundary', 'phase', 'text'],
      required: true,
    },
    layer: {
      type: String,
      enum: ['boundary', 'roads', 'plots', 'amenities', 'trees', 'labels', 'phases'],
      default: 'plots',
    },
    shape: {
      type: String,
      enum: ['rectangle', 'square', 'circle', 'triangle', 'polygon', 'lShape', 'freeDraw', 'line', 'icon'],
      default: 'rectangle',
    },
    subtype: { type: String, default: '' },
    points: [{ type: Number }],
    x: { type: Number, default: 0 },
    y: { type: Number, default: 0 },
    width: { type: Number, default: 120 },
    height: { type: Number, default: 100 },
    rotation: { type: Number, default: 0 },
    fillColor: { type: String, default: '#22C55E' },
    strokeColor: { type: String, default: '#15803D' },
    strokeWidth: { type: Number, default: 2 },
    opacity: { type: Number, default: 1 },
    text: { type: String, default: '' },
    metadata: {
      plotId: { type: mongoose.Schema.Types.ObjectId, ref: 'Plot' },
      plotNumber: String,
      plotName: String,
      size: String,
      facing: String,
      price: Number,
      status: { type: String, default: 'available' },
      project: { type: mongoose.Schema.Types.ObjectId, ref: 'Project' },
      phase: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase' },
      employee: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
      customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer' },
      notes: String,
      roadType: String,
      roadName: String,
      roadWidth: Number,
      roadLength: Number,
      amenityType: String,
      boundaryType: String,
      phaseName: String,
      phaseBorderColor: String,
      label: String,
      landscapeType: String,
    },
    zIndex: { type: Number, default: 0 },
  },
  { _id: false }
);

const layoutSchema = new mongoose.Schema(
  {
    name: { type: String, default: '' },
    description: { type: String, default: '' },
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
    phaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'Phase', required: true },
    version: { type: Number, default: 1 },
    publishStatus: { type: String, enum: ['draft', 'published'], default: 'draft' },
    publishedAt: { type: Date, default: null },
    elements: [layoutElementSchema],
    viewport: {
      scale: { type: Number, default: 1 },
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
    },
    gridSize: { type: Number, default: 20 },
    snapToGrid: { type: Boolean, default: true },
    layerVisibility: {
      boundary: { type: Boolean, default: true },
      roads: { type: Boolean, default: true },
      plots: { type: Boolean, default: true },
      amenities: { type: Boolean, default: true },
      trees: { type: Boolean, default: true },
      labels: { type: Boolean, default: true },
      phases: { type: Boolean, default: true },
    },
    layerLocks: {
      boundary: { type: Boolean, default: false },
      roads: { type: Boolean, default: false },
      plots: { type: Boolean, default: false },
      amenities: { type: Boolean, default: false },
      trees: { type: Boolean, default: false },
      labels: { type: Boolean, default: false },
      phases: { type: Boolean, default: false },
    },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

layoutSchema.index({ projectId: 1 });
layoutSchema.index({ phaseId: 1, version: -1 });
layoutSchema.index({ phaseId: 1, publishStatus: 1 });

export default mongoose.model('Layout', layoutSchema);
