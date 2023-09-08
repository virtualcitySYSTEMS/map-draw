import { watch } from 'vue';
import { SessionType } from '@vcmap/core';

/**
 * @param {import("../editorManager").EditorManager} manager
 * @returns {function():void}
 */
export default function addKeyListeners(manager) {
  const { currentSession, currentEditSession, currentLayer, currentFeatures } =
    manager;
  const layer = manager.getDefaultLayer();

  function handleSelectKeys(event) {
    if (event.target.tagName === 'INPUT') {
      return;
    }
    switch (event.code) {
      case 'Escape':
        if (currentEditSession.value) {
          currentEditSession.value.stop();
        } else if (currentSession.value.currentFeatures.length) {
          currentSession.value.clearSelection();
        }
        break;
      case 'Delete':
        // XXX Copy paste from simple category (second time)
        if (
          currentLayer.value === layer &&
          currentSession.value?.currentFeatures?.length
        ) {
          const ids = currentSession.value.currentFeatures.map((f) =>
            f.getId(),
          );
          currentSession.value.clearSelection();
          currentLayer.value.removeFeaturesById(ids);
        }
        break;
      default:
        break;
    }
  }

  function handleCreateKeys(event) {
    if (event.target.tagName === 'INPUT') {
      return;
    }
    switch (event.code) {
      case 'Escape':
        currentLayer.value.removeFeaturesById([
          currentFeatures.value[0].getId(),
        ]);
        currentSession.value.finish();
        break;
      case 'Enter':
        currentSession.value.finish();
        break;
      default:
        break;
    }
  }

  if (currentSession.value.type === SessionType.CREATE) {
    window.addEventListener('keydown', handleCreateKeys);
    return () => {
      window.removeEventListener('keydown', handleCreateKeys);
    };
  } else if (currentSession.value.type === SessionType.SELECT) {
    window.addEventListener('keydown', handleSelectKeys);
    return () => {
      window.removeEventListener('keydown', handleSelectKeys);
    };
  }
  return () => {};
}

/**
 * @param {EditorManager} manager
 * @returns {function():void}
 */
export function setupKeyListeners(manager) {
  let listeners = () => {};
  const watcher = watch(manager.currentSession, (session) => {
    listeners();
    if (session) {
      listeners = addKeyListeners(manager);
    } else {
      listeners = () => {};
    }
  });

  return () => {
    listeners();
    watcher();
  };
}
