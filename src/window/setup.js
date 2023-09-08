import { watch, ref } from 'vue';
import { SessionType } from '@vcmap/core';
import { WindowSlot } from '@vcmap/ui';
import { unByKey } from 'ol/Observable.js';
import { name } from '../../package.json';
import DrawWindow from './drawWindow.vue';

export const drawPluginWindowId = 'DrawPluginMainWindow';

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export function setupDrawWindow(manager, app) {
  let renameListener = () => {};
  const headerTitle = ref();

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

  function toggleWindow() {
    if (manager.currentFeatures.value.length > 0) {
      if (!app.windowManager.has(drawPluginWindowId)) {
        app.windowManager.add(
          {
            id: drawPluginWindowId,
            component: DrawWindow,
            slot: WindowSlot.DYNAMIC_RIGHT,
            provides: {
              manager,
            },
            state: {
              headerTitle,
              styles: { width: '280px', height: 'auto' },
              infoUrlCallback: app.getHelpUrlCallback('tools/drawingTool.html'),
            },
          },
          name,
        );
      }
    } else {
      app.windowManager.remove(drawPluginWindowId);
    }
  }
  const featuresChangedListener = watch(manager.currentFeatures, () => {
    setHeaderTitle();
    toggleWindow();
  });

  return {
    destroy: () => {
      app.windowManager.remove(drawPluginWindowId);
      featuresChangedListener();
      renameListener();
    },
    toggleWindow,
  };
}
