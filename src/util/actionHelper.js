import { SessionType, writeGeoJSON } from '@vcmap/core';
import { downloadText } from '@vcmap/ui';

// eslint-disable-next-line import/prefer-default-export
export function createDeleteAction(manager, id) {
  return {
    id,
    name: 'drawing.category.removeSelected',
    icon: '$vcsTrashCan',
    callback() {
      // XXX Copy paste from simple category
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

function exportFeatures(features, layer, writeOptions) {
  const text = writeGeoJSON(
    {
      features,
      vcsMeta: layer.getVcsMeta(writeOptions),
    },
    writeOptions,
  );
  downloadText(text, 'drawings.json');
}

export function createExportSelectedAction(manager, id, hasIcon = true) {
  return {
    id,
    name: 'drawing.contextMenu.exportSelected',
    icon: hasIcon ? '$vcsImport' : undefined,
    callback() {
      if (
        manager.currentFeatures.value.length &&
        manager.currentSession.value.type === SessionType.SELECT
      ) {
        exportFeatures(
          manager.currentFeatures.value,
          manager.currentLayer.value,
          {
            // TODO: make these configurable
            writeStyle: true,
            embedIcons: true,
            prettyPrint: true,
            writeId: true,
          },
        );
      }
    },
  };
}
