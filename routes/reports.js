import express from 'express';
import Plot from '../models/Plot.js';
import Project from '../models/Project.js';
import Employee from '../models/Employee.js';
import Customer from '../models/Customer.js';
import Payment from '../models/Payment.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/dashboard', async (req, res) => {
  try {
    const [totalProjects, plots, employees, customers] = await Promise.all([
      Project.countDocuments(),
      Plot.find(),
      Employee.countDocuments({ isActive: true }),
      Customer.countDocuments(),
    ]);

    const statusCounts = plots.reduce(
      (acc, p) => {
        acc[p.status] = (acc[p.status] || 0) + 1;
        return acc;
      },
      { available: 0, reserved: 0, sold: 0, under_processing: 0 }
    );

    const totalRevenue = plots.filter((p) => p.status === 'sold').reduce((s, p) => s + p.cost, 0);

    res.json({
      totalProjects,
      totalPlots: plots.length,
      availablePlots: statusCounts.available,
      reservedPlots: statusCounts.reserved,
      soldPlots: statusCounts.sold,
      underProcessingPlots: statusCounts.under_processing,
      totalRevenue,
      employees,
      customers,
      plotStatusDistribution: statusCounts,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/revenue', async (req, res) => {
  try {
    const soldPlots = await Plot.find({ status: 'sold' }).sort({ updatedAt: 1 });
    const monthly = {};
    soldPlots.forEach((plot) => {
      const key = `${plot.updatedAt.getFullYear()}-${String(plot.updatedAt.getMonth() + 1).padStart(2, '0')}`;
      monthly[key] = (monthly[key] || 0) + plot.cost;
    });
    const data = Object.entries(monthly).map(([month, revenue]) => ({ month, revenue }));
    res.json(data);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/employee-performance', async (req, res) => {
  try {
    const employees = await Employee.find({ isActive: true });
    const performance = await Promise.all(
      employees.map(async (emp) => {
        const plots = await Plot.find({ assignedEmployee: emp._id });
        const sold = plots.filter((p) => p.status === 'sold');
        const revenue = sold.reduce((s, p) => s + p.cost, 0);
        return {
          name: emp.name,
          employeeCode: emp.employeeCode,
          totalPlots: plots.length,
          soldPlots: sold.length,
          revenue,
          target: emp.salesTarget,
          achievement: emp.salesTarget ? Math.round((revenue / emp.salesTarget) * 100) : 0,
        };
      })
    );
    res.json(performance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/employee-dashboard', async (req, res) => {
  try {
    const employee = await Employee.findOne({ user: req.user._id });
    if (!employee) return res.status(404).json({ message: 'Employee profile not found' });

    const plots = await Plot.find({ assignedEmployee: employee._id });
    const customers = await Customer.find({ assignedEmployee: employee._id });
    const sold = plots.filter((p) => p.status === 'sold');
    const revenue = sold.reduce((s, p) => s + p.cost, 0);

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthlySold = sold.filter((p) => p.updatedAt >= monthStart);
    const monthlyRevenue = monthlySold.reduce((s, p) => s + p.cost, 0);

    res.json({
      assignedPlots: plots.length,
      availablePlots: plots.filter((p) => p.status === 'available').length,
      reservedPlots: plots.filter((p) => p.status === 'reserved').length,
      soldPlots: sold.length,
      customers: customers.length,
      monthlyTarget: employee.salesTarget,
      achievedRevenue: monthlyRevenue,
      totalRevenue: revenue,
      plotStatusDistribution: {
        available: plots.filter((p) => p.status === 'available').length,
        reserved: plots.filter((p) => p.status === 'reserved').length,
        sold: sold.length,
        under_processing: plots.filter((p) => p.status === 'under_processing').length,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
