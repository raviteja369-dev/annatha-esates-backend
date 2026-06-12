import express from 'express';
import Plot from '../models/Plot.js';
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
    const { project, phase, status, employee, search } = req.query;
    const query = { ...filter };
    if (project) query.project = project;
    if (phase) query.phase = phase;
    if (status) query.status = status;
    if (employee && req.user.role === 'super_admin') query.assignedEmployee = employee;
    if (search) {
      query.$or = [
        { plotNumber: { $regex: search, $options: 'i' } },
        { plotName: { $regex: search, $options: 'i' } },
      ];
    }
    const plots = await Plot.find(query)
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode profilePhoto')
      .populate('customer', 'name mobile email')
      .sort({ order: 1 });
    res.json(plots);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id)
      .populate('project', 'name location')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode mobile email')
      .populate('customer', 'name mobile email address');
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    res.json(plot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const plot = await Plot.create(req.body);
    const populated = await Plot.findById(plot._id)
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const plot = await Plot.findByIdAndUpdate(req.params.id, req.body, { new: true })
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile');
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    res.json(plot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/status', authorize('super_admin'), async (req, res) => {
  try {
    const { status, customer } = req.body;
    const update = { status };
    if (customer) update.customer = customer;
    const plot = await Plot.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile');
    res.json(plot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/transfer', authorize('super_admin'), async (req, res) => {
  try {
    const { assignedEmployee, customer } = req.body;
    const plot = await Plot.findByIdAndUpdate(
      req.params.id,
      { assignedEmployee, customer },
      { new: true }
    )
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile');
    res.json(plot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/position', authorize('super_admin'), async (req, res) => {
  try {
    const { position, order } = req.body;
    const plot = await Plot.findByIdAndUpdate(
      req.params.id,
      { position, ...(order !== undefined && { order }) },
      { new: true }
    );
    res.json(plot);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/positions/bulk', authorize('super_admin'), async (req, res) => {
  try {
    const { updates } = req.body;
    await Promise.all(
      updates.map(({ id, position, order }) =>
        Plot.findByIdAndUpdate(id, { position, ...(order !== undefined && { order }) })
      )
    );
    res.json({ message: 'Positions updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id);
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    await plot.deleteOne();
    res.json({ message: 'Plot deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
