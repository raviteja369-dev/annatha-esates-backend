import Layout from '../models/Layout.js';

/**
 * Drops legacy unique index on projectId (one layout per project).
 * Layouts are now scoped per phase with multiple versions allowed.
 */
export async function syncLayoutIndexes() {
  try {
    const collection = Layout.collection;
    const indexes = await collection.indexes();

    const legacyProjectIndex = indexes.find(
      (idx) => idx.name === 'projectId_1' && idx.unique
    );
    if (legacyProjectIndex) {
      await collection.dropIndex('projectId_1');
      console.log('Dropped legacy unique index layouts.projectId_1');
    }

    const legacyPhaseUnique = indexes.find(
      (idx) => idx.name === 'phaseId_1' && idx.unique
    );
    if (legacyPhaseUnique) {
      await collection.dropIndex('phaseId_1');
      console.log('Dropped legacy unique index layouts.phaseId_1');
    }

    await Layout.syncIndexes();
  } catch (error) {
    if (error.code !== 27 && error.codeName !== 'IndexNotFound') {
      console.warn('Layout index sync warning:', error.message);
    }
  }
}
