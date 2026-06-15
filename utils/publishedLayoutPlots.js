import Layout from '../models/Layout.js';
import Plot from '../models/Plot.js';

export function extractPlotIdsFromElements(elements = []) {
  const ids = new Set();
  for (const el of elements) {
    if (el.type !== 'plot') continue;
    const plotId = el.metadata?.plotId;
    if (plotId) ids.add(String(plotId));
  }
  return ids;
}

export async function getPublishedLayoutForPhase(phaseId) {
  return Layout.findOne({ phaseId, publishStatus: 'published' })
    .sort({ version: -1, publishedAt: -1, updatedAt: -1 });
}

export async function getPublishedLayoutPlotIds(phaseId) {
  const layout = await getPublishedLayoutForPhase(phaseId);
  if (!layout) return [];
  return [...extractPlotIdsFromElements(layout.elements)];
}

export async function getAllPublishedLayoutPlotIds({ projectId, phaseId } = {}) {
  const layoutQuery = { publishStatus: 'published' };
  if (phaseId) layoutQuery.phaseId = phaseId;
  if (projectId) layoutQuery.projectId = projectId;

  const layouts = await Layout.find(layoutQuery)
    .select('elements phaseId projectId')
    .sort({ version: -1, publishedAt: -1 });

  const seenPhases = new Set();
  const plotIds = new Set();

  for (const layout of layouts) {
    const key = String(layout.phaseId);
    if (seenPhases.has(key)) continue;
    seenPhases.add(key);
    extractPlotIdsFromElements(layout.elements).forEach((id) => plotIds.add(id));
  }

  return [...plotIds];
}

/**
 * On publish: activate plots in layout, deactivate others in the same phase.
 * Booked plot records are never deleted — only hidden via active: false.
 */
export async function syncPublishedLayoutPlotVisibility(projectId, phaseId, layoutId, elements) {
  const linkedIds = extractPlotIdsFromElements(elements);

  if (linkedIds.size > 0) {
    await Plot.updateMany(
      { _id: { $in: [...linkedIds] } },
      { $set: { active: true, sourceLayoutId: layoutId } }
    );
  }

  await Plot.updateMany(
    {
      project: projectId,
      phase: phaseId,
      _id: { $nin: [...linkedIds] },
    },
    { $set: { active: false } }
  );
}

export async function migratePlotActiveFromPublishedLayouts() {
  try {
    const layouts = await Layout.find({ publishStatus: 'published' })
      .select('projectId phaseId elements')
      .sort({ version: -1, publishedAt: -1 });

    const handledPhases = new Set();
    for (const layout of layouts) {
      const phaseKey = String(layout.phaseId);
      if (handledPhases.has(phaseKey)) continue;
      handledPhases.add(phaseKey);
      await syncPublishedLayoutPlotVisibility(
        layout.projectId,
        layout.phaseId,
        layout._id,
        layout.elements || []
      );
    }
    console.log(`Synced active flags for ${handledPhases.size} published layout phase(s).`);
  } catch (error) {
    console.warn('Plot active migration warning:', error.message);
  }
}

export async function isPlotInPublishedLayout(plotId, phaseId) {
  const publishedIds = await getPublishedLayoutPlotIds(phaseId);
  return publishedIds.includes(String(plotId));
}
