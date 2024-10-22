/**
 * @typedef {Object} DrawConfig
 * @property {import("@vcmap/core").VectorPropertiesOptions["altitudeMode"][]} [altitudeModes]
 */

/**
 * @returns {DrawConfig}
 */
export default function getDefaultOptions() {
  return {
    altitudeModes: [
      'clampToGround',
      'clampToTerrain',
      'clampTo3DTiles',
      'absolute',
    ],
  };
}
