import express from 'express';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import { protect, authorize } from '../middleware/auth.js';
import { validateMobile } from '../utils/validators.js';

const router = express.Router();

router.use(protect);

const getEmployeeFilter = async (user) => {
  if (user.role === 'super_admin') return {};
  const employee = await Employee.findOne({ user: user._id });
  return employee ? { assignedEmployee: employee._id } : { assignedEmployee: null };
};

router.get('/', async (req, res) => {
  try {
    const filter = await getEmployeeFilter(req.user);
    const customers = await Customer.find(filter)
      .populate('plotPurchased', 'plotNumber size cost status')
      .populate('assignedEmployee', 'name employeeCode')
      .sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id)
      .populate('plotPurchased')
      .populate('assignedEmployee', 'name employeeCode mobile');
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { name, mobile, email, address, assignedEmployee } = req.body;

    if (!name?.trim() || !mobile) {
      return res.status(400).json({ message: 'Name and mobile are required' });
    }

    const mobileCheck = validateMobile(mobile);
    if (!mobileCheck.valid) {
      return res.status(400).json({ message: mobileCheck.message });
    }

    const data = {
      name: name.trim(),
      mobile: mobileCheck.value,
      email: email?.trim() || '',
      address: address?.trim() || '',
    };

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) {
        return res.status(400).json({ message: 'Employee profile not found' });
      }
      data.assignedEmployee = employee._id;
    } else if (assignedEmployee) {
      data.assignedEmployee = assignedEmployee;
    }

    const customer = await Customer.create(data);
    const populated = await Customer.findById(customer._id)
      .populate('plotPurchased', 'plotNumber size cost status')
      .populate('assignedEmployee', 'name employeeCode');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ user: req.user._id });
      const existing = await Customer.findById(req.params.id);
      if (!existing) return res.status(404).json({ message: 'Customer not found' });
      if (existing.assignedEmployee?.toString() !== employee?._id?.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this customer' });
      }

      const { name, mobile, email, address, followUpDate, followUpStatus, notes } = req.body;
      const updates = { followUpDate, followUpStatus, notes };
      if (name) updates.name = name.trim();
      if (email !== undefined) updates.email = email.trim();
      if (address !== undefined) updates.address = address.trim();
      if (mobile) {
        const mobileCheck = validateMobile(mobile);
        if (!mobileCheck.valid) {
          return res.status(400).json({ message: mobileCheck.message });
        }
        updates.mobile = mobileCheck.value;
      }

      const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true })
        .populate('plotPurchased', 'plotNumber size cost status')
        .populate('assignedEmployee', 'name employeeCode');
      return res.json(customer);
    }
    const updates = { ...req.body };
    if (updates.mobile) {
      const mobileCheck = validateMobile(updates.mobile);
      if (!mobileCheck.valid) {
        return res.status(400).json({ message: mobileCheck.message });
      }
      updates.mobile = mobileCheck.value;
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, updates, { new: true });
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    res.json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const customer = await Customer.findById(req.params.id);
    if (!customer) return res.status(404).json({ message: 'Customer not found' });
    await customer.deleteOne();
    res.json({ message: 'Customer deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
