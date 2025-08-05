import { getLogger } from '@vcsuite/logger';
import { reactive, watch } from 'vue';
import {
  CesiumMap,
  GeometryType,
  ObliqueMap,
  OpenlayersMap,
  SessionType,
} from '@vcmap/core';
import { ToolboxType } from '@vcmap/ui';
import { name } from '../../package.json';

/**
 * @typedef {Object} EditorToolbox
 * @property {import("@vcmap/ui/src/manager/toolbox/toolboxManager").SingleToolboxComponentOptions|import("@vcmap/ui/src/manager/toolbox/toolboxManager").SelectToolboxComponentOptions} toolbox
 * @property {function():void} destroy
 */

export const GeometryTypeIcon = {
  [GeometryType.Point]: '$vcsPoint',
  [GeometryType.Polygon]: '$vcsTriangle',
  [GeometryType.LineString]: '$vcsLine',
  [GeometryType.BBox]: '$vcsBoundingBox',
  [GeometryType.Circle]: '$vcsCircle',
};

/**
 * @param {EditorManager} manager
 * @returns {EditorToolbox}
 */
function createCreateToolbox(manager) {
  const createCreateButton = (geometryType) => ({
    name: geometryType,
    title: `drawing.create.${geometryType}`,
    icon: GeometryTypeIcon[geometryType],
  });

  const toolbox = {
    type: ToolboxType.SELECT,
    action: reactive({
      name: 'creation',
      currentIndex: 3,
      active: false,
      callback() {
        if (this.active) {
          manager.stop();
        } else {
          const toolName = this.tools[this.currentIndex].name;
          if (toolName === SessionType.SELECT) {
            manager.startSelectSession();
          } else {
            manager.startCreateSession(toolName);
          }
        }
      },
      selected(newIndex) {
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
          title: 'drawing.select',
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
          ? currentSession.geometryType
          : SessionType.SELECT;
      const index = toolbox.action.tools.findIndex((t) => t.name === toolName);
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

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export function addToolButtons(manager, app) {
  const { toolbox: createToolbox, destroy: destroyCreateToolbox } =
    createCreateToolbox(manager);
  const createId = app.toolboxManager.add(createToolbox, name).id;
  const mapChanged = (map) => {
    if (
      map instanceof OpenlayersMap ||
      map instanceof CesiumMap ||
      map instanceof ObliqueMap
    ) {
      createToolbox.action.disabled = false;
    } else {
      manager.stop().catch((err) => {
        getLogger(name).error(err);
      });
      createToolbox.action.disabled = true;
    }
  };
  const mapChangedListener = app.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(app.maps.activeMap);

  return () => {
    app.toolboxManager.remove(createId);
    destroyCreateToolbox();
    mapChangedListener();
  };
}
