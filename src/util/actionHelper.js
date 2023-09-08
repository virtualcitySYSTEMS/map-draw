import { SessionType, parseGeoJSON, writeGeoJSON } from '@vcmap/core';
import { NotificationType, downloadText } from '@vcmap/ui';
import { watch } from 'vue';

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

/**
 * Creates an action that exports all selected features. If no features are selected, all features of the editorManagers layer are exported.
 * @param {import('../editorManager.js').EditorManager} manager The editorManager
 * @param {string | number} id The action id
 * @param {boolean} [hasIcon=true] Whether the action should have an icon or not.
 * @param {boolean} [hasTitle=false] Whether the action should watch the selected features and switch title accordingly (export selected / export all).
 * @returns {{action: import("@vcmap/ui").VcsAction, destroy: import('vue').WatchStopHandle}} A VcsAction for exporting selected features and the corresponding destroy function.
 */
export function createExportSelectedAction(
  manager,
  id,
  hasIcon = true,
  hasTitle = false,
) {
  const exportSelectedTitle = 'drawing.category.exportSelected';
  const exportAllTitle = 'drawing.category.exportAll';
  const exportAction = {
    id,
    name: 'drawing.category.exportSelected',
    icon: hasIcon ? '$vcsExport' : undefined,
    callback() {
      const writeOptions = {
        writeStyle: true,
        embedIcons: true,
        prettyPrint: true,
        writeId: true,
      };
      if (
        manager.currentSession.value?.type === SessionType.SELECT &&
        manager.currentFeatures.value?.length
      ) {
        exportFeatures(
          manager.currentFeatures.value,
          manager.currentLayer.value,
          writeOptions,
        );
      } else if (manager.currentLayer.value.getFeatures().length) {
        exportFeatures(
          manager.currentLayer.value.getFeatures(),
          manager.currentLayer.value,
          writeOptions,
        );
      }
    },
  };

  let destroyWatcher = () => {};

  if (hasTitle) {
    destroyWatcher = watch(
      manager.currentFeatures,
      (currentFeatures) => {
        if (
          manager.currentSession.value?.type === SessionType.SELECT &&
          currentFeatures?.length
        ) {
          exportAction.title = exportSelectedTitle;
        } else {
          exportAction.title = exportAllTitle;
        }
      },
      { immediate: true },
    );
  }

  return {
    action: exportAction,
    destroy: destroyWatcher,
  };
}

/**
 *
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp
 * @param {import('../editorManager.js').EditorManager} manager The editor manager
 * @param {string | number} id The action id
 * @param {boolean} hasIcon Whether the action should have an icon or not.
 * @returns {import("@vcmap/ui").VcsAction} A VcsAction for importing features from a json file.
 */
export function createImportAction(app, manager, id, hasIcon = true) {
  return {
    id,
    name: 'drawing.category.import',
    title: 'drawing.category.import',
    icon: hasIcon ? '$vcsImport' : undefined,
    async callback() {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.geojson, .txt, .json';

      input.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (file) {
          const reader = new FileReader();
          reader.onload = (e) => {
            const text = e.target.result;
            try {
              const { features, style, vcsMeta } = parseGeoJSON(text, {
                dynamicStyle: true,
              });
              manager.currentLayer.value.addFeatures(features);
              if (style) {
                manager.currentLayer.value.setStyle(style);
              }
              manager.currentLayer.value.setVcsMeta(vcsMeta);
            } catch (err) {
              app.notifier.add({
                message: err.message,
                type: NotificationType.ERROR,
              });
            }
            input.remove();
          };
          reader.readAsText(file);
        }
      });
      input.click();
    },
  };
}
