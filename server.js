import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';

import authRoutes from './routes/auth.js';
import projectRoutes from './routes/projects.js';
import phaseRoutes from './routes/phases.js';
import plotRoutes from './routes/plots.js';
import employeeRoutes from './routes/employees.js';
import customerRoutes from './routes/customers.js';
import paymentRoutes from './routes/payments.js';
import leadRoutes from './routes/leads.js';
import siteVisitRoutes from './routes/siteVisits.js';
import reportRoutes from './routes/reports.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

connectDB();

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/phases', phaseRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/employees', employeeRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/site-visits', siteVisitRoutes);
app.use('/api/reports', reportRoutes);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
