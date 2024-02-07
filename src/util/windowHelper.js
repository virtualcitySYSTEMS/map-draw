import { watch, ref } from 'vue';
import { SessionType } from '@vcmap/core';
import { WindowSlot, VcsFeatureEditingWindow } from '@vcmap/ui';
import { unByKey } from 'ol/Observable.js';
import { name } from '../../package.json';

export const drawPluginWindowId = 'DrawPluginMainWindow';

const headerTitle = ref();

export function getDrawEditor(manager, app) {
  return {
    component: VcsFeatureEditingWindow,
    provides: {
      manager,
    },
    state: {
      headerTitle,
      styles: { width: '280px', height: 'auto' },
      infoUrlCallback: app.getHelpUrlCallback('tools/drawingTool.html'),
    },
  };
}

/**
 * @param {import("../editorManager.js").EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export function setupDrawWindow(manager, app) {
  let renameListener = () => {};

  function setHeaderTitle() {
    renameListener();
    const features = manager.currentFeatures.value;
    if (features.length > 1) {
      headerTitle.value = `(${features.length}) Features`;
    } else if (manager.currentSession.value?.type === SessionType.CREATE) {
      headerTitle.value = `drawing.create.${manager.currentSession.value.geometryType}`;
    } else if (features.length) {
      const propertyChangeListener = features[0].on(
        'propertychange',
        ({ key }) => {
          if (key === 'title') {
            headerTitle.value = features[0].get(key);
          }
        },
      );
      renameListener = () => {
        unByKey(propertyChangeListener);
      };
      headerTitle.value = features[0].get('title');
    }
  }

  const featuresChangedListener = watch(manager.currentFeatures, (curr) => {
    if (
      curr[0] &&
      !manager.currentLayer.value?.getFeatureById(curr[0]?.getId())
    ) {
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
      }
    } else {
      app.windowManager.remove(drawPluginWindowId);
    }
    setHeaderTitle();
  });

  const windowClosedListener = app.windowManager.removed.addEventListener(
    (component) => {
      if (
        component.id === drawPluginWindowId &&
        manager.currentSession.value?.type === SessionType.CREATE &&
        (manager.currentFeatures.value.length === 0 ||
          !manager.currentLayer.value?.getFeatureById(
            manager.currentFeatures.value[0]?.getId(),
          ))
      ) {
        manager.stop();
      }
    },
  );

  return () => {
    featuresChangedListener();
    renameListener();
    windowClosedListener();
  };
}
