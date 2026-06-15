import express from 'express';
import Plot from '../models/Plot.js';
import Lead from '../models/Lead.js';
import Employee from '../models/Employee.js';
import { protect } from '../middleware/auth.js';
import { getAllPublishedLayoutPlotIds } from '../utils/publishedLayoutPlots.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const employeeFilter = req.user.role === 'super_admin'
      ? {}
      : await (async () => {
          const emp = await Employee.findOne({ user: req.user._id });
          return emp ? { assignedEmployee: emp._id } : { assignedEmployee: null };
        })();

    const publishedPlotIds = await getAllPublishedLayoutPlotIds();
    const plotFilter = {
      ...employeeFilter,
      active: true,
      ...(publishedPlotIds.length ? { _id: { $in: publishedPlotIds } } : { _id: null }),
    };

    const [pendingPlots, recentReserved, recentLeads] = await Promise.all([
      Plot.find({ status: 'pending', ...plotFilter })
        .populate('project', 'name')
        .populate('customer', 'name')
        .sort({ updatedAt: -1 })
        .limit(8),
      Plot.find({ status: { $in: ['reserved', 'sold'] }, ...plotFilter })
        .populate('project', 'name')
        .populate('customer', 'name')
        .sort({ updatedAt: -1 })
        .limit(5),
      req.user.role === 'super_admin'
        ? Lead.find({ status: 'new' }).sort({ createdAt: -1 }).limit(5)
        : [],
    ]);

    const items = [
      ...pendingPlots.map((p) => ({
        id: `pending-${p._id}`,
        type: 'booking_pending',
        title: `Pending booking — Plot ${p.plotNumber}`,
        message: `${p.customer?.name || 'Customer'} · ${p.project?.name || 'Project'}`,
        createdAt: p.updatedAt,
        link: `/bookings?plotId=${p._id}`,
        unread: true,
      })),
      ...recentReserved.map((p) => ({
        id: `reserved-${p._id}`,
        type: p.status === 'sold' ? 'plot_sold' : 'plot_reserved',
        title: `${p.status === 'sold' ? 'Sold' : 'Reserved'} — Plot ${p.plotNumber}`,
        message: `${p.customer?.name || '—'} · ${p.project?.name || '—'}`,
        createdAt: p.updatedAt,
        link: `/bookings?plotId=${p._id}`,
        unread: false,
      })),
      ...recentLeads.map((l) => ({
        id: `lead-${l._id}`,
        type: 'lead',
        title: `New lead — ${l.name}`,
        message: l.mobile || l.email || 'Follow up required',
        createdAt: l.createdAt,
        link: '/leads',
        unread: true,
      })),
    ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 12);

    const unreadCount = items.filter((i) => i.unread).length;

    res.json({ items, unreadCount });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
