import express from 'express';
import Plot from '../models/Plot.js';
import Project from '../models/Project.js';
import Customer from '../models/Customer.js';
import Employee from '../models/Employee.js';
import { protect } from '../middleware/auth.js';
import { getAllPublishedLayoutPlotIds } from '../utils/publishedLayoutPlots.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const q = (req.query.q || '').trim();
    if (!q || q.length < 2) {
      return res.json({ results: [] });
    }

    const regex = { $regex: q, $options: 'i' };
    const isAdmin = req.user.role === 'super_admin';

    let employeeFilter = {};
    if (!isAdmin) {
      const emp = await Employee.findOne({ user: req.user._id });
      employeeFilter = emp ? { assignedEmployee: emp._id } : { assignedEmployee: null };
    }

    const publishedPlotIds = await getAllPublishedLayoutPlotIds();

    const [plots, projects, customers, employees] = await Promise.all([
      publishedPlotIds.length
        ? Plot.find({
            ...employeeFilter,
            active: true,
            _id: { $in: publishedPlotIds },
            $or: [{ plotNumber: regex }, { plotName: regex }],
          })
            .populate('project', 'name')
            .limit(6)
        : [],
      isAdmin
        ? Project.find({ $or: [{ name: regex }, { location: regex }] }).limit(5)
        : [],
      Customer.find({
        ...(isAdmin ? {} : employeeFilter),
        $or: [{ name: regex }, { mobile: regex }, { email: regex }],
      }).limit(6),
      isAdmin
        ? Employee.find({ $or: [{ name: regex }, { employeeCode: regex }] }).limit(5)
        : [],
    ]);

    const results = [
      ...projects.map((p) => ({
        id: p._id,
        type: 'project',
        label: p.name,
        sublabel: p.location || 'Project',
        path: '/projects',
      })),
      ...plots.map((p) => ({
        id: p._id,
        type: 'plot',
        label: `Plot ${p.plotNumber}`,
        sublabel: `${p.project?.name || ''} · ${p.status}`,
        path: isAdmin ? '/plots' : '/employee/plots',
      })),
      ...customers.map((c) => ({
        id: c._id,
        type: 'customer',
        label: c.name,
        sublabel: c.mobile || 'Customer',
        path: isAdmin ? '/customers' : '/employee/customers',
      })),
      ...employees.map((e) => ({
        id: e._id,
        type: 'employee',
        label: e.name,
        sublabel: e.employeeCode || 'Employee',
        path: '/employees',
      })),
    ];

    const bookingPlots = plots.filter((p) => ['pending', 'reserved', 'sold'].includes(p.status));
    bookingPlots.forEach((p) => {
      results.push({
        id: `booking-${p._id}`,
        type: 'booking',
        label: `Booking — ${p.plotNumber}`,
        sublabel: `${p.status} · ${p.project?.name || ''}`,
        path: `/bookings?plotId=${p._id}`,
      });
    });

    res.json({ results: results.slice(0, 15) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
