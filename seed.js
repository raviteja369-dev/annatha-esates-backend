import dotenv from 'dotenv';
import mongoose from 'mongoose';
import User from './models/User.js';
import Project from './models/Project.js';
import Phase from './models/Phase.js';
import Plot from './models/Plot.js';
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
    { name: 'Green Valley', description: 'Premium residential plots', location: 'Hyderabad', createdBy: admin._id },
    { name: 'Royal County', description: 'Luxury gated community', location: 'Bangalore', createdBy: admin._id },
    { name: 'Sunrise Enclave', description: 'Affordable housing plots', location: 'Chennai', createdBy: admin._id },
  ]);

  const phases = [];
  for (const project of projects) {
    for (const [i, name] of ['Phase A', 'Phase B', 'Phase C'].entries()) {
      phases.push(await Phase.create({ name, project: project._id, order: i }));
    }
  }

  const statuses = ['available', 'reserved', 'sold', 'under_processing'];
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
    const projectPhases = phases.filter((p) => p.project.toString() === project._id.toString());
    for (const phase of projectPhases) {
      const phaseLetter = phase.name.split(' ')[1];
      for (let i = 1; i <= 12; i++) {
        const status = statuses[plotIndex % 4];
        const customer = status === 'sold' || status === 'reserved' ? customers[plotIndex % 3]._id : null;
        await Plot.create({
          plotNumber: `${phaseLetter}${i}`,
          plotName: `Plot ${phaseLetter}${i}`,
          size: sizes[i % 5],
          facing: facings[i % 4],
          cost: costs[i % 5],
          status,
          project: project._id,
          phase: phase._id,
          assignedEmployee: employee._id,
          customer,
          position: { x: (i % 4) * 120, y: Math.floor((i - 1) / 4) * 100 },
          order: i,
        });
        plotIndex++;
      }
    }
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
