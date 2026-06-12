import express from 'express';
import Lead from '../models/Lead.js';
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
    const leads = await Lead.find(filter)
      .populate('interestedProject', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .sort({ createdAt: -1 });
    res.json(leads);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

const sanitizeLeadBody = (body) => {
  const data = { ...body };
  ['assignedEmployee', 'interestedProject'].forEach((key) => {
    if (!data[key]) delete data[key];
  });
  return data;
};

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const lead = await Lead.create(sanitizeLeadBody(req.body));
    const populated = await Lead.findById(lead._id)
      .populate('interestedProject', 'name')
      .populate('assignedEmployee', 'name employeeCode');
    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, sanitizeLeadBody(req.body), { new: true });
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    res.json(lead);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const lead = await Lead.findById(req.params.id);
    if (!lead) return res.status(404).json({ message: 'Lead not found' });
    await lead.deleteOne();
    res.json({ message: 'Lead deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
