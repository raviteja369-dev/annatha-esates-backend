import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Project from './models/Project.js';
import Phase from './models/Phase.js';
import Plot from './models/Plot.js';
import Layout from './models/Layout.js';
import Employee from './models/Employee.js';
import Customer from './models/Customer.js';

dotenv.config();

const seed = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 5000 });
  } catch (err) {
    console.error('\n❌ Could not connect to MongoDB.');
    console.error('   Make sure MongoDB is running, or set MONGODB_URI in backend/.env to a MongoDB Atlas connection string.\n');
    console.error(`   Error: ${err.message}\n`);
    process.exit(1);
  }
  console.log('Connected to MongoDB');

  await Promise.all([
    User.deleteMany(),
    Project.deleteMany(),
    Phase.deleteMany(),
    Plot.deleteMany(),
    Layout.deleteMany(),
    Employee.deleteMany(),
    Customer.deleteMany(),
  ]);

  const admin = await User.create({
    name: 'Super Admin',
    email: 'admin@ananthaestates.com',
    password: 'admin123',
    role: 'super_admin',
  });

  const employee = await Employee.create({
    employeeCode: 'EMP001',
    name: 'Amit Kumar',
    mobile: '9876543210',
    email: 'amit@ananthaestates.com',
    address: 'Hyderabad, Telangana',
    salesTarget: 5000000,
    joiningDate: new Date('2024-01-15'),
  });

  const empUser = await User.create({
    name: 'Amit Kumar',
    email: 'employee@ananthaestates.com',
    password: 'employee123',
    role: 'employee',
    employeeId: employee._id,
  });
  employee.user = empUser._id;
  await employee.save();

  const projects = await Project.insertMany([
    { name: 'Anantha Valley', description: 'Premium residential plots', location: 'Hyderabad', publishStatus: 'published', createdBy: admin._id },
    { name: 'Green City', description: 'Modern urban living', location: 'Bangalore', publishStatus: 'published', createdBy: admin._id },
    { name: 'Royal County', description: 'Luxury gated community', location: 'Bangalore', publishStatus: 'published', createdBy: admin._id },
    { name: 'Sunrise Layout', description: 'Affordable housing plots', location: 'Chennai', publishStatus: 'published', createdBy: admin._id },
  ]);

  const phaseConfigs = [
    ['Phase 1', 'Phase 2', 'Phase 3'],
    ['Phase 1', 'Phase 2'],
    ['Phase 1', 'Phase 2', 'Phase 3'],
    ['Phase 1', 'Phase 2', 'Phase 3'],
  ];

  const phases = [];
  for (let p = 0; p < projects.length; p++) {
    for (let i = 0; i < phaseConfigs[p].length; i++) {
      phases.push(await Phase.create({
        name: phaseConfigs[p][i],
        project: projects[p]._id,
        order: i,
        publishStatus: 'published',
      }));
    }
  }

  const facings = ['North', 'South', 'East', 'West'];
  const sizes = [1200, 1500, 1800, 2000, 2400];
  const costs = [2500000, 3000000, 3500000, 4000000, 4500000];

  const customers = await Customer.insertMany([
    { name: 'Rahul Sharma', mobile: '9123456789', email: 'rahul@email.com', assignedEmployee: employee._id },
    { name: 'Priya Patel', mobile: '9234567890', email: 'priya@email.com', assignedEmployee: employee._id },
    { name: 'Vikram Singh', mobile: '9345678901', email: 'vikram@email.com', assignedEmployee: employee._id },
  ]);

  let plotIndex = 0;
  for (const project of projects) {
    const projectPhases = phases.filter((ph) => ph.project.toString() === project._id.toString());
    for (const phase of projectPhases) {
      const phaseNum = phase.name.replace(/\D/g, '') || '1';
      for (let i = 1; i <= 12; i++) {
        await Plot.create({
          plotNumber: `P${phaseNum}-${i}`,
          plotName: `Plot P${phaseNum}-${i}`,
          size: sizes[i % 5],
          facing: facings[i % 4],
          cost: costs[i % 5],
          status: 'available',
          project: project._id,
          phase: phase._id,
          assignedEmployee: employee._id,
          position: { x: (i % 4) * 120, y: Math.floor((i - 1) / 4) * 100 },
          order: i,
        });
        plotIndex++;
      }
    }
  }

  // Sample layouts for first phase of each project
  for (const project of projects) {
    const firstPhase = phases.find((ph) => ph.project.toString() === project._id.toString());
    if (!firstPhase) continue;
    const phasePlots = await Plot.find({ project: project._id, phase: firstPhase._id }).limit(6);
    await Layout.create({
      name: `${project.name} — ${firstPhase.name}`,
      description: `Master layout for ${firstPhase.name}`,
      projectId: project._id,
      phaseId: firstPhase._id,
      version: 1,
      publishStatus: 'published',
      publishedAt: new Date(),
      elements: phasePlots.map((plot, i) => ({
        id: `plot-${plot._id}`,
        type: 'plot',
        layer: 'plots',
        shape: 'rectangle',
        x: (i % 3) * 140 + 100,
        y: Math.floor(i / 3) * 120 + 100,
        width: 120,
        height: 100,
        fillColor: '#22C55E',
        strokeColor: '#15803D',
        metadata: {
          plotId: plot._id,
          plotNumber: plot.plotNumber,
          plotName: plot.plotName,
          size: String(plot.size),
          facing: plot.facing,
          price: plot.cost,
          status: plot.status,
          project: project._id,
          phase: firstPhase._id,
        },
        zIndex: i,
      })),
      updatedBy: admin._id,
    });
  }

  console.log('Seed data created successfully!');
  console.log('Admin: admin@ananthaestates.com / admin123');
  console.log('Employee: employee@ananthaestates.com / employee123');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
