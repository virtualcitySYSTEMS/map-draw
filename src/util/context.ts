import type { InteractionEvent } from '@vcmap/core';
import {
  CesiumMap,
  GeometryType,
  getDefaultHighlightStyle,
  PanoramaMap,
  SessionType,
  vcsLayerName,
  writeGeoJSON,
} from '@vcmap/core';
import type { VcsAction, VcsUiApp } from '@vcmap/ui';
import {
  downloadText,
  EditorTransformationIcons,
  getAllowedEditorTransformationModes,
} from '@vcmap/ui';
import { getLogger } from '@vcsuite/logger';
import type Feature from 'ol/Feature.js';
import { name } from '../../package.json';
import type { EditorManager } from '../editorManager.js';
import { drawPluginWindowId } from './windowHelper.js';

/**
 * Adds edit actions to the context menu.
 * @param app The VcsUiApp instance
 * @param manager The editor manager
 * @param owner The owner of the context menu entries.
 * @param editSelection Function to open collection component editor for selected features.
 * @returns Function to destroy the context menu entries.
 */
export default function addContextMenu(
  app: VcsUiApp,
  manager: EditorManager,
  owner: string | symbol,
  editSelection: () => void,
): () => void {
  const highlightStyle = getDefaultHighlightStyle();
  let closeListener = (): void => {};

  const eventHandler = (event: InteractionEvent): VcsAction[] => {
    const contextEntries = [];
    if (
      event.feature &&
      event.feature[vcsLayerName] === manager.currentLayer.value.name
    ) {
      const isSelected = manager.currentFeatures.value.includes(
        event.feature as Feature,
      );

      const activeMapClassName = app.maps.activeMap?.className;

      const disabled =
        (isSelected &&
          manager.currentSession.value?.type === SessionType.CREATE) ||
        (activeMapClassName === PanoramaMap.className &&
          (app.maps.activeMap as PanoramaMap).currentPanoramaImage?.hasDepth !==
            true);

      contextEntries.push({
        id: 'draw-edit_properties',
        name: 'draw.contextMenu.editProperties',
        disabled,
        icon: '$vcsEdit',
        callback() {
          if (!isSelected) {
            manager.startSelectSession([event.feature as Feature]);
          }
          editSelection();
        },
      });

      contextEntries.push({
        id: 'draw-edit_geometry',
        name: 'draw.geometry.edit',
        disabled,
        icon: '$vcsEditVertices',
        callback() {
          manager
            .startEditSession(event.feature as Feature)
            .catch((e: unknown) => {
              getLogger(name).error('Error starting edit session', e);
            });
        },
      });

      const featuresToBeEdited = isSelected
        ? manager.currentFeatures.value
        : [event.feature];

      const geometryTypes = new Set(
        featuresToBeEdited.map(
          (f) =>
            (f as Feature).getGeometry()?.get('_vcsGeomType') ??
            (f as Feature).getGeometry()?.getType() ??
            GeometryType.Point,
        ),
      );

      const allowedModes = getAllowedEditorTransformationModes(
        geometryTypes,
        featuresToBeEdited as Feature[],
        manager.currentLayer.value,
        activeMapClassName === CesiumMap.className ||
          activeMapClassName === PanoramaMap.className,
      );

      allowedModes.forEach((mode) => {
        contextEntries.push({
          id: `draw-${mode}`,
          disabled,
          name: `draw.transform.${mode}`,
          icon: EditorTransformationIcons[mode],
          callback() {
            if (!app.windowManager.has(drawPluginWindowId)) {
              editSelection();
            }
            manager
              .startTransformSession(mode, featuresToBeEdited as Feature[])
              .catch((e: unknown) => {
                getLogger(name).error('Error starting transform session', e);
              });
          },
        });
      });

      contextEntries.push({
        disabled,
        name: `draw.contextMenu.exportSelection`,
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
              features: featuresToBeEdited as Feature[],
              vcsMeta: manager.currentLayer.value.getVcsMeta(writeOptions),
            },
            writeOptions,
          );
          downloadText(text, 'drawings.json');
        },
      });

      contextEntries.push({
        name: 'draw.contextMenu.removeSelection',
        icon: '$vcsTrashCan',
        disabled,
        callback() {
          manager.currentLayer.value.removeFeaturesById(
            featuresToBeEdited.map((f) => f.getId()!),
          );
        },
      });

      if (!isSelected) {
        const featureId = event.feature.getId()!;
        closeListener = app.contextMenuManager.closed.addEventListener(() => {
          closeListener();
          const selectedNow = manager.currentFeatures.value.includes(
            event.feature as Feature,
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
