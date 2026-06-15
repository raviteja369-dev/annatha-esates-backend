import express from 'express';
import Employee from '../models/Employee.js';
import User from '../models/User.js';
import Plot from '../models/Plot.js';
import Customer from '../models/Customer.js';
import Lead from '../models/Lead.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateMobile, generateEmployeeCode } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

router.get('/dropdown', async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true })
      .select('name employeeCode')
      .sort({ name: 1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/', authorize('super_admin'), async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/next-code', authorize('super_admin'), async (req, res) => {
  try {
    const employeeCode = await generateEmployeeCode();
    res.json({ employeeCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    if (req.user.role === 'employee') {
      const emp = await Employee.findOne({ user: req.user._id });
      if (emp?._id.toString() !== req.params.id) {
        return res.status(403).json({ message: 'Not authorized' });
      }
    }
    const plots = await Plot.find({ assignedEmployee: employee._id });
    const customers = await Customer.find({ assignedEmployee: employee._id });
    const leads = await Lead.find({ assignedEmployee: employee._id });
    const soldPlots = plots.filter((p) => p.status === 'sold');
    const revenue = soldPlots.reduce((sum, p) => sum + p.cost, 0);
    res.json({ employee, stats: { plots: plots.length, customers: customers.length, leads: leads.length, revenue } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const { name, email, password, employeeCode, mobile, address, salesTarget, joiningDate } = req.body;

    if (!name || !mobile || !email) {
      return res.status(400).json({ message: 'Name, mobile, and email are required' });
    }
    if (!password) {
      return res.status(400).json({ message: 'Password is required for new employees' });
    }

    const mobileCheck = validateMobile(mobile);
    if (!mobileCheck.valid) {
      return res.status(400).json({ message: mobileCheck.message });
    }

    const existingUser = await User.findOne({ email: email.trim().toLowerCase() });
    if (existingUser) {
      return res.status(400).json({ message: 'A user with this email already exists' });
    }

    const code = employeeCode?.trim() || await generateEmployeeCode();

    const employee = await Employee.create({
      employeeCode: code,
      name: name.trim(),
      mobile: mobileCheck.value,
      email: email.trim().toLowerCase(),
      address: address?.trim() || '',
      salesTarget: Number(salesTarget) || 0,
      joiningDate: joiningDate || new Date(),
    });

    const user = await User.create({
      name: employee.name,
      email: employee.email,
      password,
      role: 'employee',
      employeeId: employee._id,
    });

    employee.user = user._id;
    await employee.save();

    res.status(201).json(employee);
  } catch (error) {
    if (error.code === 11000) {
      const field = Object.keys(error.keyPattern || {})[0] || 'field';
      return res.status(400).json({ message: `Employee ${field} already exists` });
    }
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const { password, employeeCode, ...updates } = req.body;
    if (updates.email) updates.email = updates.email.trim().toLowerCase();
    if (updates.salesTarget !== undefined) updates.salesTarget = Number(updates.salesTarget) || 0;
    if (updates.mobile) {
      const mobileCheck = validateMobile(updates.mobile);
      if (!mobileCheck.valid) {
        return res.status(400).json({ message: mobileCheck.message });
      }
      updates.mobile = mobileCheck.value;
    }

    const employee = await Employee.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
    if (!employee) return res.status(404).json({ message: 'Employee not found' });

    if (employee.user) {
      await User.findByIdAndUpdate(employee.user, {
        name: employee.name,
        email: employee.email,
      });
    }

    res.json(employee);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: 'Employee ID or email already exists' });
    }
    res.status(400).json({ message: error.message });
  }
});

router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const employee = await Employee.findById(req.params.id);
    if (!employee) return res.status(404).json({ message: 'Employee not found' });
    if (employee.user) await User.findByIdAndDelete(employee.user);
    await employee.deleteOne();
    res.json({ message: 'Employee deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/assign-plots', authorize('super_admin'), async (req, res) => {
  try {
    const { plotIds } = req.body;
    await Plot.updateMany({ _id: { $in: plotIds } }, { assignedEmployee: req.params.id });
    res.json({ message: 'Plots assigned' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/assign-customers', authorize('super_admin'), async (req, res) => {
  try {
    const { customerIds } = req.body;
    await Customer.updateMany({ _id: { $in: customerIds } }, { assignedEmployee: req.params.id });
    res.json({ message: 'Customers assigned' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:id/assign-leads', authorize('super_admin'), async (req, res) => {
  try {
    const { leadIds } = req.body;
    await Lead.updateMany({ _id: { $in: leadIds } }, { assignedEmployee: req.params.id });
    res.json({ message: 'Leads assigned' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
