import type { VectorLayer } from '@vcmap/core';
import { writeGeoJSON } from '@vcmap/core';
import { downloadText } from '@vcmap/ui';
import type Feature from 'ol/Feature';

/**
 * Exports features to a GeoJSON file and initiates the download.
 * @param features - The features to export.
 * @param layer - The layer containing the features.
 */

export function exportFeatures(
  features: Array<Feature>,
  layer: VectorLayer,
): void {
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
