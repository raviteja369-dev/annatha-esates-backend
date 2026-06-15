import express from 'express';
import Plot from '../models/Plot.js';
import Project from '../models/Project.js';
import Employee from '../models/Employee.js';
import { protect, authorize } from '../middleware/auth.js';
import { getAllPublishedLayoutPlotIds } from '../utils/publishedLayoutPlots.js';

const router = express.Router();

router.use(protect);

const getEmployeeFilter = async (user) => {
  if (user.role === 'super_admin') return {};
  const employee = await Employee.findOne({ user: user._id });
  return employee ? { assignedEmployee: employee._id } : { assignedEmployee: null };
};

const populatePlot = (query) => query
  .populate('project', 'name')
  .populate('phase', 'name')
  .populate('assignedEmployee', 'name employeeCode profilePhoto')
  .populate('customer', 'name mobile email');

router.get('/', async (req, res) => {
  try {
    const { project, phase, status, employee, search, plotId, scope } = req.query;

    // Published projects for plot-layout sidebar navigation
    if (status === 'published' && !project && !phase && !search && !scope) {
      const projects = await Project.find({ publishStatus: 'published' }).sort({ name: 1 });
      return res.json(projects);
    }

    const employeeFilter = await getEmployeeFilter(req.user);
    const query = {};

    if (project || plotId) query.project = project || plotId;
    if (phase) query.phase = phase;
    if (status && status !== 'published') query.status = status;
    if (employee && req.user.role === 'super_admin') query.assignedEmployee = employee;
    if (search) {
      query.$or = [
        { plotNumber: { $regex: search, $options: 'i' } },
        { plotName: { $regex: search, $options: 'i' } },
      ];
    }

    // scope=designer — plots linked to a layout being edited (includes inactive/draft)
    if (scope === 'designer') {
      if (!project && !plotId) {
        return res.status(400).json({ message: 'project is required for designer scope' });
      }
      const plots = await populatePlot(Plot.find(query)).sort({ order: 1, plotNumber: 1 });
      return res.json(plots);
    }

    // scope=assigned — employee's assigned plots only (e.g. My Plots filters)
    if (scope === 'assigned') {
      Object.assign(query, employeeFilter);
    }

    // Default: published layout plots — same inventory for admin and employee
    const publishedPlotIds = await getAllPublishedLayoutPlotIds({ projectId: query.project, phaseId: phase });
    if (!publishedPlotIds.length) {
      return res.json([]);
    }
    query._id = { $in: publishedPlotIds };
    query.active = true;

    const plots = await populatePlot(Plot.find(query)).sort({ order: 1, plotNumber: 1 });
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
  return res.status(403).json({
    message: 'Plots are managed through the Layout Designer. Create plots on the canvas, save, and publish the layout.',
  });
});

router.patch('/:id/book', async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id);
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    if (!plot.active) {
      return res.status(400).json({ message: 'This plot is not in the published layout and cannot be booked' });
    }
    if (plot.status !== 'available') {
      return res.status(400).json({ message: 'Only available plots can be booked' });
    }

    const { customer, assignedEmployee, notes } = req.body;
    if (!customer || !assignedEmployee) {
      return res.status(400).json({ message: 'Customer and employee are required' });
    }

    const updated = await Plot.findByIdAndUpdate(
      req.params.id,
      { status: 'pending', customer, assignedEmployee, notes: notes || '' },
      { new: true }
    )
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile email');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.patch('/:id/booking-status', async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['pending', 'reserved', 'sold', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid booking status' });
    }

    const plot = await Plot.findById(req.params.id);
    if (!plot) return res.status(404).json({ message: 'Plot not found' });
    if (plot.status === 'available') {
      return res.status(400).json({ message: 'No active booking for this plot' });
    }

    if (req.user.role !== 'super_admin') {
      const employee = await Employee.findOne({ user: req.user._id });
      if (!employee || String(plot.assignedEmployee) !== String(employee._id)) {
        return res.status(403).json({ message: 'Not authorized to update this booking' });
      }
    }

    const update = { status };
    if (status === 'cancelled') {
      update.status = 'available';
      update.customer = null;
    }

    const updated = await Plot.findByIdAndUpdate(req.params.id, update, { new: true })
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile email');

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const { plotNumber, size, facing, cost, project, phase, position, status, ...rest } = req.body;
    const plot = await Plot.findById(req.params.id);
    if (!plot) return res.status(404).json({ message: 'Plot not found' });

    const allowed = { assignedEmployee: rest.assignedEmployee, notes: rest.notes };
    if (status && ['pending', 'reserved', 'sold', 'cancelled', 'available'].includes(status)) {
      allowed.status = status;
    }

    const updated = await Plot.findByIdAndUpdate(req.params.id, allowed, { new: true })
      .populate('project', 'name')
      .populate('phase', 'name')
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile');
    res.json(updated);
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
  return res.status(403).json({
    message: 'Plots cannot be deleted directly. Remove the plot from the layout and publish to deactivate it.',
  });
});

export default router;
