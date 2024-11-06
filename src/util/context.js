import {
  GeometryType,
  getDefaultHighlightStyle,
  SessionType,
  vcsLayerName,
  writeGeoJSON,
} from '@vcmap/core';
import {
  downloadText,
  EditorTransformationIcons,
  getAllowedEditorTransformationModes,
} from '@vcmap/ui';
import { drawPluginWindowId } from './windowHelper.js';

/**
 * Adds edit actions to the context menu.
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp instance
 * @param {import("../editorManager.js").EditorManager} manager The editor manager
 * @param {string | symbol} owner The owner of the context menu entries.
 * @param {function():void} editSelection Function to open collection component editor for selected features.
 * @returns {function():void} Function to destroy the context menu entries.
 */
export default function addContextMenu(app, manager, owner, editSelection) {
  const highlightStyle = getDefaultHighlightStyle();
  let closeListener = () => {};

  const eventHandler = (event) => {
    const contextEntries = [];
    if (
      event.feature &&
      event.feature[vcsLayerName] === manager.currentLayer.value.name
    ) {
      const isSelected = manager.currentFeatures.value.includes(event.feature);

      const disabled =
        isSelected && manager.currentSession.value?.type === SessionType.CREATE;

      contextEntries.push({
        id: 'draw-edit_properties',
        name: 'drawing.contextMenu.editProperties',
        disabled,
        icon: '$vcsEdit',
        callback() {
          if (!isSelected) {
            manager.startSelectSession([event.feature]);
          }
          editSelection();
        },
      });

      contextEntries.push({
        id: 'draw-edit_geometry',
        name: 'drawing.geometry.edit',
        disabled,
        icon: '$vcsEditVertices',
        callback() {
          manager.startEditSession(event.feature);
        },
      });

      const featuresToBeEdited = isSelected
        ? manager.currentFeatures.value
        : [event.feature];

      const geometryTypes = new Set(
        featuresToBeEdited.map(
          (f) =>
            f.getGeometry()?.get('_vcsGeomType') ??
            f.getGeometry()?.getType() ??
            GeometryType.Point,
        ),
      );

      const allowedModes = getAllowedEditorTransformationModes(
        geometryTypes,
        featuresToBeEdited,
        manager.currentLayer.value,
        app.maps.activeMap?.className === 'CesiumMap',
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
            manager.startTransformSession(mode, featuresToBeEdited);
          },
        });
      });

      contextEntries.push({
        disabled,
        name: `drawing.contextMenu.exportSelection`,
        icon: '$vcsExport',
        callback() {
          const writeOptions = {
            writeStyle: true,
            embedIcons: true,
            prettyPrint: true,
            writeId: true,
          };
          const text = writeGeoJSON(
            {
              features: featuresToBeEdited,
              vcsMeta: manager.currentLayer.value.getVcsMeta(writeOptions),
            },
            writeOptions,
          );
          downloadText(text, 'drawings.json');
        },
      });

      contextEntries.push({
        name: 'drawing.contextMenu.removeSelection',
        icon: '$vcsTrashCan',
        disabled,
        callback() {
          manager.currentLayer.value.removeFeaturesById(
            featuresToBeEdited.map((f) => f.getId()),
          );
        },
      });

      if (!isSelected) {
        const featureId = event.feature.getId();
        closeListener = app.contextMenuManager.closed.addEventListener(() => {
          closeListener();
          const selectedNow = manager.currentFeatures.value.includes(
            event.feature,
          );
          if (!selectedNow) {
            manager.currentLayer.value.featureVisibility.unHighlight([
              featureId,
            ]);
          }
        });

        manager.currentLayer.value.featureVisibility.highlight({
          [featureId]: highlightStyle,
        });
      }
    }
    return contextEntries;
  };
  app.contextMenuManager.addEventHandler(eventHandler, owner);

  return () => {
    app.contextMenuManager.removeHandler(eventHandler);
    closeListener();
  };
}
