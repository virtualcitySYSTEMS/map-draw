import { SessionType, vcsLayerName } from '@vcmap/core';
import {
  createListItemBulkAction,
  EditorTransformationIcons,
  getAllowedEditorTransformationModes,
} from '@vcmap/ui';
import { drawPluginWindowId } from './windowHelper.js';
import { createDeleteSelectedAction, exportFeatures } from './actionHelper.js';

/**
 * Adds edit actions to the context menu.
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp instance
 * @param {EditorManager} manager The editor manager
 * @param {string | symbol} owner The owner of the context menu entries.
 * @param {function(import("ol").Feature[]):void} editSelection Function to open collection component editor for selected features.
 * @returns {function():void} Function to destroy the context menu entries.
 */
export default function addContextMenu(app, manager, owner, editSelection) {
  const { action: exportAction, destroy: destroyExportAction } =
    createListItemBulkAction(manager.currentFeatures, {
      callback: () => {
        exportFeatures(
          manager.currentFeatures.value,
          manager.currentLayer.value,
        );
      },
      name: 'list.export',
      icon: '$vcsExport',
    });
  exportAction.disabled = false;
  app.contextMenuManager.addEventHandler((event) => {
    const contextEntries = [];
    if (
      event.feature &&
      event.feature[vcsLayerName] === manager.currentLayer.value.name
    ) {
      let editFeatures = manager.currentFeatures.value;
      const disabled =
        manager.currentSession.value?.type === SessionType.CREATE &&
        event.feature === editFeatures[0];

      if (
        !disabled &&
        manager.currentSession.value?.type !== SessionType.SELECT
      ) {
        setTimeout(() => {
          // timeout prevents right click on opened editor window
          manager.startSelectSession([event.feature]);
        }, 0);
        editFeatures = [event.feature];
      } else if (
        manager.currentSession.value?.type === SessionType.SELECT &&
        !editFeatures.some(
          (feature) => feature.getId() === event.feature.getId(),
        )
      ) {
        setTimeout(() => {
          // timeout prevents right click on opened editor window
          manager.currentSession.value.setCurrentFeatures([event.feature]);
        }, 0);
        editFeatures = [event.feature];
      }
      contextEntries.push({
        id: 'draw-edit_properties',
        name: 'drawing.contextMenu.editProperties',
        disabled,
        icon: '$vcsEdit',
        callback() {
          editSelection();
        },
      });
      if (editFeatures.length === 1) {
        contextEntries.push({
          id: 'draw-edit_geometry',
          name: 'drawing.geometry.edit',
          disabled,
          icon: '$vcsEditVertices',
          callback() {
            manager.startEditSession();
          },
        });
      }
      const geometryTypes = new Set(
        editFeatures.map(
          (f) =>
            f.getGeometry().get('_vcsGeomType') ?? f.getGeometry().getType(),
        ),
      );
      const allowedModes = getAllowedEditorTransformationModes(
        geometryTypes,
        editFeatures.length,
      );
      allowedModes.forEach((mode) => {
        contextEntries.push({
          id: `draw-${mode}`,
          disabled,
          name: `drawing.transform.${mode}`,
          icon: EditorTransformationIcons[mode],
          callback() {
            if (!app.windowManager.has(drawPluginWindowId)) {
              editSelection();
            }
            manager.startTransformSession(mode);
          },
        });
      });
      exportAction.disabled = disabled;
      contextEntries.push(exportAction);
      const deleteAction = createDeleteSelectedAction(
        manager,
        'draw-context-delete',
      );
      deleteAction.disabled = disabled;
      contextEntries.push(deleteAction);
    } else {
      manager.currentSession.value?.clearSelection?.();
    }
    return contextEntries;
  }, owner);

  return () => {
    destroyExportAction();
  };
}
