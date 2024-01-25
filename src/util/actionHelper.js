import { parseGeoJSON, writeGeoJSON } from '@vcmap/core';
import { downloadText } from '@vcmap/ui';

/**
 *
 * @param {import('../editorManager.js').EditorManager} manager The editor manager
 * @param {string | number} id The action id
 * @returns {import("@vcmap/ui").VcsAction} A VcsAction for deleting the current features.
 */
export function createDeleteSelectedAction(manager, id) {
  return {
    id,
    name: 'drawing.category.removeSelected',
    icon: '$vcsTrashCan',
    callback() {
      const layer = manager.getDefaultLayer();
      if (
        manager.currentLayer.value === layer &&
        manager.currentFeatures.value?.length > 0 &&
        manager.currentSession.value?.currentFeatures?.length
      ) {
        const ids = manager.currentFeatures.value.map((f) => f.getId());
        manager.currentSession.value.clearSelection();
        manager.currentLayer.value.removeFeaturesById(ids);
      }
    },
  };
}

/**
 * Exports features to a GeoJSON file and initiates the download.
 * @param {Array} features - The features to export.
 * @param {Object} layer - The layer containing the features.
 */
export function exportFeatures(features, layer) {
  const writeOptions = {
    writeStyle: true,
    embedIcons: true,
    prettyPrint: true,
    writeId: true,
  };
  const text = writeGeoJSON(
    {
      features,
      vcsMeta: layer.getVcsMeta(writeOptions),
    },
    writeOptions,
  );
  downloadText(text, 'drawings.json');
}

/**
 * Imports features from files and adds them to the manager's current layer.
 * @param {import("../editorManager.js").EditorManager} manager - The manager object.
 * @param {File[]} files - An array of files to import.
 * @returns {Promise<void>} - A promise that resolves when all features are imported.
 */
export async function importFeatures(manager, files) {
  await Promise.all(
    files.map(async (file) => {
      const text = await file.text();
      const { features, style, vcsMeta } = parseGeoJSON(text, {
        dynamicStyle: true,
      });
      manager.currentLayer.value.addFeatures(features);
      if (style) {
        manager.currentLayer.value.setStyle(style);
      }
      manager.currentLayer.value.setVcsMeta(vcsMeta);
    }),
  );
}
