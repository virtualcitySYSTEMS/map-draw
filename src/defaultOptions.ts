import type { VectorPropertiesOptions } from '@vcmap/core';

export type DrawConfig = {
  altitudeModes?: VectorPropertiesOptions['altitudeMode'][];
};

export default function getDefaultOptions(): Required<DrawConfig> {
  return {
    altitudeModes: [
      'clampToGround',
      'clampToTerrain',
      'clampTo3DTiles',
      'absolute',
    ],
  };
}
