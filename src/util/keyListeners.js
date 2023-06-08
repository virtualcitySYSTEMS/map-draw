import { SessionType } from '@vcmap/core';

/**
 * @param {import("../editorManager").EditorManager} manager
 * @returns {function():void}
 */
export default function addKeyListeners(manager) {
  const { currentSession, currentEditSession, currentLayer } = manager;
  const layer = manager.getDefaultLayer();

  function handleSelectKeys(event) {
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
    switch (event.code) {
      case 'Escape':
        // some code here…
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
