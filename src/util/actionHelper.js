import { writeGeoJSON } from '@vcmap/core';
import { downloadText } from '@vcmap/ui';

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
