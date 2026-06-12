import express from 'express';
import Lead from '../models/Lead.js';
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

router.post('/', async (req, res) => {
  try {
    const { name, mobile, email, source, status, interestedProject } = req.body;

    if (!name?.trim() || !mobile) {
      return res.status(400).json({ message: 'Name and mobile are required' });
    }

    const mobileCheck = validateMobile(mobile);
    if (!mobileCheck.valid) {
      return res.status(400).json({ message: mobileCheck.message });
    }

    const data = sanitizeLeadBody({
      name: name.trim(),
      mobile: mobileCheck.value,
      email: email?.trim() || '',
      source: source || 'walk-in',
      status: status || 'new',
      interestedProject,
    });

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) {
        return res.status(400).json({ message: 'Employee profile not found' });
      }
      data.assignedEmployee = employee._id;
    }

    const lead = await Lead.create(data);
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
    const existing = await Lead.findById(req.params.id);
    if (!existing) return res.status(404).json({ message: 'Lead not found' });

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ user: req.user._id });
      if (existing.assignedEmployee?.toString() !== employee?._id?.toString()) {
        return res.status(403).json({ message: 'Not authorized to update this lead' });
      }
    }

    const updates = sanitizeLeadBody(req.body);
    if (updates.mobile) {
      const mobileCheck = validateMobile(updates.mobile);
      if (!mobileCheck.valid) {
        return res.status(400).json({ message: mobileCheck.message });
      }
      updates.mobile = mobileCheck.value;
    }

    const lead = await Lead.findByIdAndUpdate(req.params.id, updates, { new: true })
      .populate('interestedProject', 'name')
      .populate('assignedEmployee', 'name employeeCode');
    res.json(lead);
  } catch (error) {
    res.status(400).json({ message: error.message });
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
