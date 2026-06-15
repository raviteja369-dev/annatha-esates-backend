import express from 'express';
import Layout from '../models/Layout.js';
import Plot from '../models/Plot.js';
import Phase from '../models/Phase.js';
import Employee from '../models/Employee.js';
import { protect, authorize } from '../middleware/auth.js';
import {
  extractPlotIdsFromElements,
  syncPublishedLayoutPlotVisibility,
} from '../utils/publishedLayoutPlots.js';

const router = express.Router();

const STATUS_COLORS = {
  available: { fill: '#22C55E', stroke: '#15803D' },
  pending: { fill: '#3B82F6', stroke: '#2563EB' },
  reserved: { fill: '#F59E0B', stroke: '#D97706' },
  sold: { fill: '#EF4444', stroke: '#DC2626' },
  under_processing: { fill: '#3B82F6', stroke: '#2563EB' },
};

router.use(protect);

const getEmployeeFilter = async (user) => {
  if (user.role === 'super_admin') return {};
  const employee = await Employee.findOne({ user: user._id });
  return employee ? { assignedEmployee: employee._id } : { assignedEmployee: null };
};

function applyPlotToElement(el, plot) {
  if (!plot || el.type !== 'plot') return el;
  const colors = STATUS_COLORS[plot.status] || STATUS_COLORS.available;
  return {
    ...el,
    fillColor: colors.fill,
    strokeColor: colors.stroke,
    metadata: {
      ...el.metadata,
      plotId: plot._id,
      plotNumber: plot.plotNumber,
      plotName: plot.plotName || '',
      size: String(plot.size),
      facing: plot.facing,
      price: plot.cost,
      status: plot.status,
      project: plot.project?._id || plot.project,
      phase: plot.phase?._id || plot.phase,
      employee: plot.assignedEmployee?._id || plot.assignedEmployee,
      customer: plot.customer?._id || plot.customer,
      notes: plot.notes || '',
      active: plot.active,
    },
    x: el.x ?? plot.position?.x ?? 0,
    y: el.y ?? plot.position?.y ?? 0,
  };
}

async function syncPlotsFromLayout(projectId, phaseId, layoutId, elements) {
  const plotElements = elements.filter((el) => el.type === 'plot');
  const results = [];

  for (const el of plotElements) {
    const meta = el.metadata || {};
    const resolvedPhase = meta.phase || phaseId;
    if (!resolvedPhase) continue;

    const layoutFields = {
      plotNumber: meta.plotNumber || `P-${el.id.slice(0, 6)}`,
      plotName: meta.plotName || '',
      size: Number(meta.size) || Number(meta.area) || 1200,
      facing: meta.facing || 'East',
      cost: Number(meta.price) || 0,
      project: projectId,
      phase: resolvedPhase,
      position: { x: el.x || 0, y: el.y || 0 },
      sourceLayoutId: layoutId,
    };

    if (meta.plotId) {
      const updated = await Plot.findByIdAndUpdate(meta.plotId, layoutFields, { new: true });
      if (updated) {
        results.push(updated);
        el.metadata = { ...meta, plotId: updated._id };
        continue;
      }
    }

    if (meta.plotNumber) {
      const existing = await Plot.findOne({
        project: projectId,
        phase: resolvedPhase,
        plotNumber: meta.plotNumber,
      });
      if (existing) {
        const updated = await Plot.findByIdAndUpdate(existing._id, layoutFields, { new: true });
        results.push(updated);
        el.metadata = { ...meta, plotId: existing._id };
      } else {
        const created = await Plot.create({
          ...layoutFields,
          status: 'available',
          active: false,
        });
        results.push(created);
        el.metadata = { ...meta, plotId: created._id };
      }
    }
  }

  return { elements, plots: results };
}

async function loadPlotsForLayoutElements(elements, phaseId) {
  const plotIds = [...extractPlotIdsFromElements(elements)];
  const plotNumbers = elements
    .filter((el) => el.type === 'plot' && el.metadata?.plotNumber)
    .map((el) => el.metadata.plotNumber);

  const orConditions = [];
  if (plotIds.length) orConditions.push({ _id: { $in: plotIds } });
  if (plotNumbers.length) {
    orConditions.push({ plotNumber: { $in: plotNumbers }, phase: phaseId });
  }

  if (!orConditions.length) return [];

  return Plot.find({ $or: orConditions })
    .populate('assignedEmployee', 'name employeeCode')
    .populate('customer', 'name mobile')
    .populate('phase', 'name');
}

async function buildLayoutResponse(layout, user) {
  const layoutObj = layout.toObject ? layout.toObject() : { ...layout };
  const projectId = layoutObj.projectId;
  const phaseId = layoutObj.phaseId;
  const isPublished = layoutObj.publishStatus === 'published';

  const plots = await loadPlotsForLayoutElements(
    layoutObj.elements || [],
    phaseId
  );

  const plotMap = new Map(plots.map((p) => [String(p._id), p]));
  const plotByNumber = new Map(
    plots.map((p) => [`${String(p.phase?._id || p.phase)}:${p.plotNumber}`, p])
  );

  layoutObj.elements = (layoutObj.elements || []).map((el) => {
    if (el.type !== 'plot') return el;
    const meta = el.metadata || {};
    const plotId = meta.plotId;
    if (plotId && plotMap.has(String(plotId))) {
      return applyPlotToElement(el, plotMap.get(String(plotId)));
    }
    const resolvedPhase = meta.phase || phaseId;
    if (meta.plotNumber && resolvedPhase) {
      const byNumber = plotByNumber.get(`${String(resolvedPhase)}:${meta.plotNumber}`);
      if (byNumber) return applyPlotToElement(el, byNumber);
    }
    return el;
  });

  const visiblePlots = isPublished
    ? plots.filter((p) => p.active)
    : plots;

  const phase = await Phase.findById(phaseId).populate('project', 'name location');
  return {
    ...layoutObj,
    plots: visiblePlots,
    phase,
    projectId: layoutObj.projectId,
    phaseId: layoutObj.phaseId,
  };
}

router.get('/phase/:phaseId', async (req, res) => {
  try {
    const { phaseId } = req.params;
    const { status } = req.query;

    const phase = await Phase.findById(phaseId).populate('project', 'name');
    if (!phase) return res.status(404).json({ message: 'Phase not found' });

    const query = { phaseId };
    if (status === 'published') query.publishStatus = 'published';

    const layouts = await Layout.find(query)
      .select('name description version publishStatus publishedAt createdAt updatedAt projectId phaseId')
      .sort({ version: -1, updatedAt: -1 });

    res.json({ phase, layouts, count: layouts.length });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/:layoutId', async (req, res) => {
  try {
    const layout = await Layout.findById(req.params.layoutId);
    if (!layout) return res.status(404).json({ message: 'Layout not found' });
    const response = await buildLayoutResponse(layout, req.user);
    res.json(response);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/', authorize('super_admin'), async (req, res) => {
  try {
    const { projectId, phaseId, name, description } = req.body;
    if (!projectId || !phaseId) {
      return res.status(400).json({ message: 'Project and phase are required' });
    }

    const phase = await Phase.findById(phaseId);
    if (!phase) return res.status(404).json({ message: 'Phase not found' });
    if (String(phase.project) !== String(projectId)) {
      return res.status(400).json({ message: 'Phase does not belong to this project' });
    }

    const latest = await Layout.findOne({ phaseId }).sort({ version: -1 });
    const version = (latest?.version || 0) + 1;

    const layout = await Layout.create({
      name: name?.trim() || `${phase.name} Layout v${version}`,
      description: description || '',
      projectId,
      phaseId,
      version,
      elements: [],
      updatedBy: req.user._id,
    });

    res.status(201).json({ layout, message: 'Layout created successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/:layoutId', authorize('super_admin'), async (req, res) => {
  try {
    const layout = await Layout.findById(req.params.layoutId);
    if (!layout) return res.status(404).json({ message: 'Layout not found' });

    const { elements, viewport, gridSize, snapToGrid, layerVisibility, layerLocks, name, description, publishStatus } = req.body;

    const { elements: syncedElements, plots } = await syncPlotsFromLayout(
      layout.projectId,
      layout.phaseId,
      layout._id,
      elements || []
    );

    const updateData = {
      elements: syncedElements,
      viewport,
      gridSize,
      snapToGrid,
      layerVisibility,
      layerLocks,
      updatedBy: req.user._id,
    };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (publishStatus !== undefined) {
      updateData.publishStatus = publishStatus;
      if (publishStatus === 'published') {
        updateData.publishedAt = new Date();
        await Layout.updateMany(
          { phaseId: layout.phaseId, _id: { $ne: layout._id } },
          { $set: { publishStatus: 'draft', publishedAt: null } }
        );
        await syncPublishedLayoutPlotVisibility(
          layout.projectId,
          layout.phaseId,
          layout._id,
          syncedElements
        );
      }
    }

    const updated = await Layout.findByIdAndUpdate(layout._id, updateData, { new: true });

    res.json({ layout: updated, plots, message: 'Layout saved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/:layoutId/duplicate', authorize('super_admin'), async (req, res) => {
  try {
    const source = await Layout.findById(req.params.layoutId);
    if (!source) return res.status(404).json({ message: 'Layout not found' });

    const latest = await Layout.findOne({ phaseId: source.phaseId }).sort({ version: -1 });
    const version = (latest?.version || 0) + 1;

    const layout = await Layout.create({
      name: `${source.name} (Copy)`,
      description: source.description,
      projectId: source.projectId,
      phaseId: source.phaseId,
      version,
      publishStatus: 'draft',
      publishedAt: null,
      elements: source.elements,
      viewport: source.viewport,
      gridSize: source.gridSize,
      snapToGrid: source.snapToGrid,
      layerVisibility: source.layerVisibility,
      layerLocks: source.layerLocks,
      updatedBy: req.user._id,
    });

    res.status(201).json({ layout, message: 'Layout duplicated successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/:layoutId', authorize('super_admin'), async (req, res) => {
  try {
    await Layout.findByIdAndDelete(req.params.layoutId);
    res.json({ message: 'Layout deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** @deprecated Use GET /phase/:phaseId or GET /:layoutId */
router.get('/project/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const layout = await Layout.findOne({ projectId });
    if (layout) {
      const response = await buildLayoutResponse(layout, req.user);
      return res.json(response);
    }

    const employeeFilter = await getEmployeeFilter(req.user);
    const plots = await Plot.find({ project: projectId, ...employeeFilter })
      .populate('assignedEmployee', 'name employeeCode')
      .populate('customer', 'name mobile')
      .populate('phase', 'name');

    const elements = plots.map((plot, i) => ({
      id: `plot-${plot._id}`,
      type: 'plot',
      layer: 'plots',
      shape: 'rectangle',
      x: plot.position?.x || (i % 8) * 140 + 100,
      y: plot.position?.y || Math.floor(i / 8) * 120 + 100,
      width: 120,
      height: 100,
      rotation: 0,
      fillColor: STATUS_COLORS[plot.status]?.fill || '#22C55E',
      strokeColor: STATUS_COLORS[plot.status]?.stroke || '#15803D',
      strokeWidth: 2,
      metadata: {
        plotId: plot._id,
        plotNumber: plot.plotNumber,
        plotName: plot.plotName,
        size: String(plot.size),
        facing: plot.facing,
        price: plot.cost,
        status: plot.status,
        project: plot.project,
        phase: plot.phase?._id || plot.phase,
      },
      zIndex: i,
    }));

    res.json({ projectId, elements, viewport: { scale: 1, x: 0, y: 0 }, plots });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

/** @deprecated Use PUT /:layoutId */
router.put('/project/:projectId', authorize('super_admin'), async (req, res) => {
  try {
    const { projectId } = req.params;
    const { elements, viewport, gridSize, snapToGrid, layerVisibility, layerLocks } = req.body;

    let layout = await Layout.findOne({ projectId });
    const phaseId = layout?.phaseId || elements?.[0]?.metadata?.phase;

    const { elements: syncedElements, plots } = await syncPlotsFromLayout(
      projectId,
      phaseId,
      layout?._id,
      elements || []
    );

    layout = await Layout.findOneAndUpdate(
      { projectId },
      {
        projectId,
        phaseId: phaseId || layout?.phaseId,
        elements: syncedElements,
        viewport,
        gridSize,
        snapToGrid,
        layerVisibility,
        layerLocks,
        updatedBy: req.user._id,
      },
      { new: true, upsert: true }
    );

    res.json({ layout, plots, message: 'Layout saved successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
