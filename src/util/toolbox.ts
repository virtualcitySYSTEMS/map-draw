import { reactive, watch } from 'vue';
import type { CreateFeatureSession, PanoramaImage, VcsMap } from '@vcmap/core';
import {
  CesiumMap,
  GeometryType,
  ObliqueMap,
  OpenlayersMap,
  PanoramaMap,
  SessionType,
} from '@vcmap/core';
import type {
  SelectToolboxComponentOptions,
  SingleToolboxComponentOptions,
  ToolboxSelectItem,
  VcsUiApp,
} from '@vcmap/ui';
import { ToolboxType } from '@vcmap/ui';
import { getLogger } from '@vcsuite/logger';
import { name } from '../../package.json';
import type { EditorManager } from '../editorManager.js';

type EditorToolbox = {
  toolbox: SingleToolboxComponentOptions | SelectToolboxComponentOptions;
  destroy: () => void;
};

const geometryTypeIcon: Record<GeometryType, string> = {
  [GeometryType.Point]: '$vcsPoint',
  [GeometryType.Polygon]: '$vcsTriangle',
  [GeometryType.LineString]: '$vcsLine',
  [GeometryType.BBox]: '$vcsBoundingBox',
  [GeometryType.Circle]: '$vcsCircle',
};

function createCreateToolbox(manager: EditorManager): EditorToolbox {
  const createCreateButton = (
    geometryType: GeometryType,
  ): ToolboxSelectItem => ({
    name: geometryType,
    title: `draw.create.${geometryType}`,
    icon: geometryTypeIcon[geometryType],
  });

  const toolbox = {
    type: ToolboxType.SELECT,
    action: reactive({
      name: 'creation',
      currentIndex: 3,
      active: false,
      async callback() {
        if (this.active) {
          await manager.stop();
        } else {
          const toolName = this.tools[this.currentIndex].name;
          if (toolName === SessionType.SELECT) {
            manager.startSelectSession();
          } else {
            manager.startCreateSession(toolName);
          }
        }
      },
      selected(newIndex: number) {
        if (newIndex !== this.currentIndex) {
          this.currentIndex = newIndex;
          const toolName = this.tools[this.currentIndex].name;
          if (toolName === SessionType.SELECT) {
            manager.startSelectSession();
          } else {
            manager.startCreateSession(toolName);
          }
        }
      },
      tools: [
        {
          name: SessionType.SELECT,
          icon: '$vcsPointSelect',
          title: 'draw.select',
        },
        createCreateButton(GeometryType.Point),
        createCreateButton(GeometryType.LineString),
        createCreateButton(GeometryType.Polygon),
        createCreateButton(GeometryType.Circle),
        createCreateButton(GeometryType.BBox),
      ],
    }),
  };

  const destroy = watch(manager.currentSession, () => {
    const currentSession = manager.currentSession.value;

    toolbox.action.active = !!currentSession;
    if (toolbox.action.active) {
      const toolName =
        currentSession?.type === SessionType.CREATE
          ? (currentSession as CreateFeatureSession<GeometryType>).geometryType
          : SessionType.SELECT;
      const index = toolbox.action.tools.findIndex(
        (t) => (t.name as GeometryType | SessionType) === toolName,
      );
      if (toolbox.action.currentIndex !== index) {
        toolbox.action.currentIndex = index;
      }
    }
  });

  return {
    toolbox,
    destroy,
  };
}

export function addToolButtons(
  manager: EditorManager,
  app: VcsUiApp,
): () => void {
  const { toolbox: createToolbox, destroy: destroyCreateToolbox } =
    createCreateToolbox(manager);
  const createId = app.toolboxManager.add(createToolbox, name).id;
  let currentImageListener = (): void => {};
  const disable = (): void => {
    manager.stop().catch((e: unknown) => {
      getLogger(name).error('Error stopping current editor session', e);
    });
    createToolbox.action.disabled = true;
  };

  const panoramaImageChanged = (image?: PanoramaImage): void => {
    if (image?.hasDepth) {
      createToolbox.action.disabled = false;
    } else {
      disable();
    }
  };
  const mapChanged = (map: VcsMap | null): void => {
    currentImageListener();
    if (
      map instanceof OpenlayersMap ||
      map instanceof CesiumMap ||
      map instanceof ObliqueMap
    ) {
      createToolbox.action.disabled = false;
    } else if (map instanceof PanoramaMap) {
      currentImageListener =
        map.currentImageChanged.addEventListener(panoramaImageChanged);
      panoramaImageChanged(map.currentPanoramaImage);
    } else {
      disable();
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap);

  return () => {
    app.toolboxManager.remove(createId);
    destroyCreateToolbox();
    mapChangedListener();
    currentImageListener();
  };
}
