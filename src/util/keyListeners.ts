import { watch } from 'vue';
import type { CreateFeatureSession, GeometryType } from '@vcmap/core';
import {
  isCreateSession,
  isSelectSession,
  type EditorManager,
} from '../editorManager';

export default function addKeyListeners(manager: EditorManager): () => void {
  const { currentSession, currentEditSession, currentLayer, currentFeatures } =
    manager;
  const layer = manager.getDefaultLayer();

  function handleSelectKeys(event: KeyboardEvent): void {
    if ((event.target as HTMLElement)?.tagName === 'INPUT') {
      return;
    }
    switch (event.code) {
      case 'Escape':
        if (currentEditSession.value) {
          currentEditSession.value.stop();
        } else if (
          isSelectSession(currentSession.value) &&
          currentSession.value.currentFeatures.length
        ) {
          currentSession.value.clearSelection();
        }
        break;
      case 'Delete':
        if (
          currentLayer.value === layer &&
          isSelectSession(currentSession.value) &&
          currentSession.value.currentFeatures.length
        ) {
          const ids = currentSession.value.currentFeatures.map(
            (f) => f.getId()!,
          );
          currentSession.value.clearSelection();
          currentLayer.value.removeFeaturesById(ids);
        }
        break;
      default:
        break;
    }
  }

  function handleCreateKeys(event: KeyboardEvent): void {
    if ((event.target as HTMLElement)?.tagName === 'INPUT') {
      return;
    }
    switch (event.code) {
      case 'Escape':
        currentLayer.value.removeFeaturesById([
          currentFeatures.value[0].getId()!,
        ]);
        (currentSession.value as CreateFeatureSession<GeometryType>)?.finish();
        break;
      case 'Enter':
        (currentSession.value as CreateFeatureSession<GeometryType>)?.finish();
        break;
      default:
        break;
    }
  }

  if (isCreateSession(currentSession.value)) {
    window.addEventListener('keydown', handleCreateKeys);
    return () => {
      window.removeEventListener('keydown', handleCreateKeys);
    };
  } else if (isSelectSession(currentSession.value)) {
    window.addEventListener('keydown', handleSelectKeys);
    return () => {
      window.removeEventListener('keydown', handleSelectKeys);
    };
  }
  return () => {};
}

export function setupKeyListeners(manager: EditorManager): () => void {
  let listeners = (): void => {};
  const watcher = watch(manager.currentSession, (session) => {
    listeners();
    if (session) {
      listeners = addKeyListeners(manager);
    } else {
      listeners = (): void => {};
    }
  });

  return () => {
    listeners();
    watcher();
  };
}
