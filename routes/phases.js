import express from 'express';
import Phase from '../models/Phase.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', async (req, res) => {
  try {
    const { plotId, status } = req.query;
    const query = {};

    if (plotId) query.project = plotId;
    if (status === 'published') query.publishStatus = 'published';

    const phases = await Phase.find(query).sort({ order: 1 });
    res.json(phases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/project/:projectId', async (req, res) => {
  try {
    const phases = await Phase.find({ project: req.params.projectId }).sort({ order: 1 });
    res.json(phases);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const { name, project, description } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Phase name is required' });
    if (!project) return res.status(400).json({ message: 'Project is required' });

    const order = await Phase.countDocuments({ project });
    const phase = await Phase.create({
      name: name.trim(),
      project,
      description: description || '',
      order,
    });
    res.status(201).json(phase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const phase = await Phase.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    res.json(phase);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:id', authorize('super_admin'), async (req, res) => {
  try {
    const phase = await Phase.findById(req.params.id);
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    await phase.deleteOne();
    res.json({ message: 'Phase deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
