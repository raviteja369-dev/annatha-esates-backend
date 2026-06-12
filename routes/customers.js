import express from 'express';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import { protect, authorize } from '../middleware/auth.js';

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

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const customer = await Customer.create(req.body);
    res.status(201).json(customer);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    if (req.user.role === 'employee') {
      const { followUpDate, followUpStatus, notes } = req.body;
      const customer = await Customer.findByIdAndUpdate(
        req.params.id,
        { followUpDate, followUpStatus, notes },
        { new: true }
      );
      return res.json(customer);
    }
    const customer = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
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
