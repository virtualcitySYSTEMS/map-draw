import { SessionType, vcsLayerName } from '@vcmap/core';
import {
  TransformationIcons,
  getAllowedTransformationModes,
  getGeometryTypes,
} from '../window/drawWindow.vue';
import { drawPluginWindowId } from '../window/setup.js';
import {
  createDeleteSelectedAction,
  createExportSelectedAction,
} from './actionHelper.js';

/**
 * Adds edit actions to the context menu.
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp instance
 * @param {EditorManager} manager The editor manager
 * @param {string | symbol} owner The owner of the context menu entries.
 * @param {function(import("ol").Feature[]):void} toggleWindow Function to toggle the draw window.
 */
export default function addContextMenu(app, manager, owner, toggleWindow) {
  app.contextMenuManager.addEventHandler((event) => {
    const contextEntries = [];
    if (
      event.feature &&
      event.feature[vcsLayerName] === manager.currentLayer.value.name
    ) {
      let editFeatures = manager.currentFeatures.value;
      if (manager.currentSession.value?.type !== SessionType.SELECT) {
        manager.startSelectSession([event.feature]);
        editFeatures = [event.feature];
      } else if (
        !editFeatures.some(
          (feature) => feature.getId() === event.feature.getId(),
        )
      ) {
        manager.currentSession.value.setCurrentFeatures([event.feature]);
        editFeatures = [event.feature];
      }
      contextEntries.push({
        id: 'draw-edit_properties',
        name: 'drawing.contextMenu.editProperties',
        icon: '$vcsEdit',
        callback() {
          toggleWindow();
        },
      });
      if (editFeatures.length === 1) {
        contextEntries.push({
          id: 'draw-edit_geometry',
          name: 'drawing.geometry.edit',
          icon: '$vcsEditVertices',
          callback() {
            manager.startEditSession();
          },
        });
      }
      const geometryTypes = getGeometryTypes(editFeatures);
      const allowedModes = getAllowedTransformationModes(
        geometryTypes,
        editFeatures.length,
      );
      allowedModes.forEach((mode) => {
        contextEntries.push({
          id: `draw-${mode}`,
          name: `drawing.transform.${mode}`,
          icon: TransformationIcons[mode],
          callback() {
            if (!app.windowManager.has(drawPluginWindowId)) {
              toggleWindow();
            }
            manager.startTransformSession(mode);
          },
        });
      });
      contextEntries.push(
        createExportSelectedAction(manager, 'draw-context-exportSelected')
          .action,
      );
      contextEntries.push(
        createDeleteSelectedAction(manager, 'draw-context-delete'),
      );
    } else {
      manager.currentSession.value?.clearSelection?.();
    }
    return contextEntries;
  }, owner);
}
