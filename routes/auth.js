import express from 'express';
import User from '../models/User.js';
import Employee from '../models/Employee.js';
import { generateToken } from '../utils/generateToken.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const user = await User.create({ name, email, password, role: role || 'employee' });
    res.status(201).json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = req.body.email?.trim().toLowerCase();
    const { password } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    let user = await User.findOne({ email });
    if (!user) {
      const employee = await Employee.findOne({ email });
      if (employee?.user) {
        user = await User.findById(employee.user);
      }
    }

    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    if (!user.isActive) return res.status(403).json({ message: 'Account deactivated' });
    let employee = null;
    if (user.role === 'employee' && user.employeeId) {
      employee = await Employee.findById(user.employeeId);
    }
    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      avatar: user.avatar,
      employeeId: user.employeeId,
      employee,
      token: generateToken(user._id, user.role),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/me', protect, async (req, res) => {
  try {
    let employee = null;
    if (req.user.role === 'employee' && req.user.employeeId) {
      employee = await Employee.findById(req.user.employeeId);
    }
    res.json({ ...req.user.toObject(), employee });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
