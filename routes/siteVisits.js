import express from 'express';
import SiteVisit from '../models/SiteVisit.js';
import Employee from '../models/Employee.js';
import Plot from '../models/Plot.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

const getEmployeeFilter = async (user) => {
  if (user.role === 'super_admin') return {};
  const employee = await Employee.findOne({ user: user._id });
  return employee ? { assignedEmployee: employee._id } : { assignedEmployee: null };
};

const sanitizeVisitBody = (body) => {
  const data = { ...body };
  ['customer', 'lead', 'plot', 'project', 'assignedEmployee'].forEach((key) => {
    if (!data[key]) delete data[key];
  });
  return data;
};

router.get('/', async (req, res) => {
  try {
    const filter = await getEmployeeFilter(req.user);
    const visits = await SiteVisit.find(filter)
      .populate('customer', 'name mobile')
      .populate('lead', 'name mobile')
      .populate('plot', 'plotNumber')
      .populate('project', 'name')
      .populate('assignedEmployee', 'name')
      .sort({ scheduledDate: 1 });
    res.json(visits);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const data = sanitizeVisitBody(req.body);

    if (!data.scheduledDate) {
      return res.status(400).json({ message: 'Date and time are required' });
    }

    if (req.user.role === 'employee') {
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee) {
        return res.status(400).json({ message: 'Employee profile not found' });
      }
      data.assignedEmployee = employee._id;
    }

    if (!data.assignedEmployee && data.plot) {
      const plot = await Plot.findById(data.plot);
      if (plot?.assignedEmployee) {
        data.assignedEmployee = plot.assignedEmployee;
      }
    }

    if (!data.assignedEmployee) {
      return res.status(400).json({ message: 'Please assign an employee for this site visit' });
    }

    if (data.plot && !data.project) {
      const plot = await Plot.findById(data.plot);
      if (plot?.project) data.project = plot.project;
    }

    const visit = await SiteVisit.create(data);
    const populated = await SiteVisit.findById(visit._id)
      .populate('customer', 'name mobile')
      .populate('lead', 'name mobile')
      .populate('plot', 'plotNumber')
      .populate('project', 'name')
      .populate('assignedEmployee', 'name');

    res.status(201).json(populated);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const visit = await SiteVisit.findByIdAndUpdate(req.params.id, sanitizeVisitBody(req.body), { new: true })
      .populate('customer', 'name mobile')
      .populate('lead', 'name mobile')
      .populate('plot', 'plotNumber')
      .populate('project', 'name')
      .populate('assignedEmployee', 'name');
    if (!visit) return res.status(404).json({ message: 'Site visit not found' });
    res.json(visit);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

export default router;
