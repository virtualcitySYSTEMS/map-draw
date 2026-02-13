import { watch, ref } from 'vue';
import type { CreateFeatureSession, GeometryType } from '@vcmap/core';
import { SessionType } from '@vcmap/core';
import type { VcsUiApp, WindowComponentOptions } from '@vcmap/ui';
import { WindowSlot, VcsFeatureEditingWindow } from '@vcmap/ui';
import { unByKey } from 'ol/Observable.js';
import { name } from '../../package.json';
import type { EditorManager } from '../editorManager.js';
import type { DrawPlugin } from '../index.js';

export const drawPluginWindowId = 'DrawPluginMainWindow';

const headerTitle = ref();

export function getDrawEditor(
  manager: EditorManager,
  app: VcsUiApp,
): WindowComponentOptions {
  const plugin = app.plugins.getByKey(name) as DrawPlugin;
  const altitudeModes = plugin?.config?.altitudeModes;

  return {
    component: VcsFeatureEditingWindow,
    provides: { manager },
    state: {
      headerTitle,
      styles: { width: '280px', height: 'auto' },
      infoUrlCallback: app.getHelpUrlCallback('tools/drawingTool.html'),
    },
    props: { altitudeModes },
  };
}

export function setupDrawWindow(
  manager: EditorManager,
  app: VcsUiApp,
): () => void {
  let renameListener: () => void = () => {};

  function setHeaderTitle(): void {
    renameListener();
    const features = manager.currentFeatures.value;
    if (features.length > 1) {
      headerTitle.value = `(${features.length}) Features`;
    } else if (manager.currentSession.value?.type === SessionType.CREATE) {
      const { geometryType } = manager.currentSession
        .value as CreateFeatureSession<GeometryType>;
      headerTitle.value = `draw.create.${geometryType}`;
    } else if (features.length) {
      const propertyChangeListener = features[0].on(
        'propertychange',
        ({ key }) => {
          if (key === 'title') {
            headerTitle.value = features[0].get(key);
          }
        },
      );
      renameListener = (): void => {
        unByKey(propertyChangeListener);
      };
      headerTitle.value = features[0].get('title');
    }
  }

  const featuresChangedListener = watch(manager.currentFeatures, (curr) => {
    const featureId = curr[0]?.getId();
    if (featureId && !manager.currentLayer.value?.getFeatureById(featureId)) {
      if (!app.windowManager.has(drawPluginWindowId)) {
        app.windowManager.add(
          {
            ...getDrawEditor(manager, app),
            id: drawPluginWindowId,
            parentId: 'category-manager',
            slot: WindowSlot.DYNAMIC_CHILD,
          },
          name,
        );
      } else {
        app.windowManager.bringWindowToTop(drawPluginWindowId);
      }
    } else {
      app.windowManager.remove(drawPluginWindowId);
    }
    setHeaderTitle();
  });

  const windowClosedListener = app.windowManager.removed.addEventListener(
    async (component) => {
      const featureId = manager.currentFeatures.value[0]?.getId();
      if (
        component.id === drawPluginWindowId &&
        manager.currentSession.value?.type === SessionType.CREATE &&
        (manager.currentFeatures.value.length === 0 ||
          !featureId ||
          !manager.currentLayer.value?.getFeatureById(featureId))
      ) {
        await manager.stop();
      }
    },
  );

  return () => {
    featuresChangedListener();
    renameListener();
    windowClosedListener();
  };
}
