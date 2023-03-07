import {
  CesiumMap,
  GeometryType,
  startCreateFeatureSession,
  startEditFeaturesSession,
  startEditGeometrySession,
  TransformationMode,
  SessionType,
  VectorLayer,
  mercatorProjection,
  markVolatile,
  maxZIndex,
} from '@vcmap/core';
import { ToolboxType, WindowSlot } from '@vcmap/ui';
import { watch, shallowRef } from 'vue';
import { name } from '../package.json';
import FeaturePropertyWindow from './featureProperty/featuresPropertyWindow.vue';

/**
 * @typedef {Object} EditorManager
 * @property {import("vue").ShallowRef<null|import("@vcmap/core").EditorSession>} currentSession
 * @property {import("vue").ShallowRef<Array<import("ol").Feature>>} currentFeatures
 * @property {import("vue").ShallowRef<import("@vcmap/core").VectorLayer>} currentLayer
 * @property {function(import("@vcmap/core").GeometryType):import("@vcmap/core").EditorSession} startCreateSession
 * @property {function(import("ol").Feature=):import("@vcmap/core").EditorSession} startEditSession - optional feature to select
 * @property {function(import("@vcmap/core").TransformationMode):import("@vcmap/core").EditorSession} startTransformSession
 * @property {function():import("@vcmap/core").VectorLayer} getDefaultLayer
 * @property {function():void} stop
 * @property {function():void} destroy
 */

/**
 * @typedef {Object} EditorToolbox
 * @property {import("@vcmap/ui/src/manager/toolbox/toolboxManager").SingleToolboxComponentOptions|import("@vcmap/ui/src/manager/toolbox/toolboxManager").SelectToolboxComponentOptions} toolbox
 * @property {function():void} destroy
 */

export const GeometryTypeIcon = {
  [GeometryType.Point]: '$vcsPoi',
  [GeometryType.Polygon]: '$vcsTriangle',
  [GeometryType.LineString]: '$vcsLine',
  [GeometryType.BBox]: '$vcsBoundingBox',
  [GeometryType.Circle]: '$vcsCircle',
};

/**
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {import("@vcmap/core").VectorLayer}
 */
function createSimpleEditorLayer(app) {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    zIndex: maxZIndex - 1,
  });
  markVolatile(layer);
  layer.activate();
  app.layers.add(layer);

  return layer;
}

/**
 * @param {import("@vcmap/core").EditorSession} session
 * @param {import("vue").ShallowRef<Array<import("ol").Feature>>} currentFeatures
 * @param {boolean} setTitle
 * @returns {function():void}
 */
function setupFeaturesChangedListener(session, currentFeatures) {
  if (session.type === SessionType.EDIT_FEATURES) {
    return session.featureSelection.featuresChanged.addEventListener((newFeatures) => {
      currentFeatures.value = newFeatures;
    });
  }

  if (session.type === SessionType.EDIT_GEOMETRY) {
    return session.featureSelection.featureChanged.addEventListener((newFeature) => {
      if (newFeature) {
        currentFeatures.value = [newFeature];
      } else {
        currentFeatures.value = [];
      }
    });
  }

  if (session.type === SessionType.CREATE) {
    const createdListener = session.featureCreated.addEventListener((newFeature) => {
      currentFeatures.value = [newFeature];
    });

    const finishedListener = session.creationFinished.addEventListener(() => {
      currentFeatures.value = [];
    });

    return () => {
      createdListener();
      finishedListener();
    };
  }

  return () => {};
}

/**
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {EditorManager}
 */
export function createSimpleEditorManager(app) {
  const currentSession = shallowRef(null);
  const currentFeatures = shallowRef();
  const layer = createSimpleEditorLayer(app);
  const currentLayer = shallowRef(layer);
  let stoppedListener = () => {};
  let featuresChangedListener = () => {};

  const setCurrentSession = (newSession) => {
    stoppedListener();
    featuresChangedListener();
    currentFeatures.value = [];
    currentSession.value?.stop?.();
    currentSession.value = newSession;
    if (currentSession.value) {
      stoppedListener = currentSession.value.stopped.addEventListener(() => {
        setCurrentSession(null);
      });

      featuresChangedListener = setupFeaturesChangedListener(
        currentSession.value,
        currentFeatures,
      );
    } else {
      stoppedListener = () => {};
      featuresChangedListener = () => {};
    }
  };

  const layerWatcher = watch(currentLayer, () => {
    setCurrentSession(null);
    if (!currentLayer.value) {
      currentLayer.value = layer;
    }
  });

  return {
    currentSession,
    currentFeatures,
    currentLayer,
    startCreateSession(geometryType) {
      setCurrentSession(startCreateFeatureSession(app, currentLayer.value, geometryType));
    },
    startEditSession(feature) {
      setCurrentSession(startEditGeometrySession(app, currentLayer.value));
      if (feature) {
        currentSession.value.featureSelection.selectFeature(feature);
      }
    },
    startTransformSession(mode) {
      if (currentSession.value?.type === SessionType.EDIT_FEATURES) {
        currentSession.value.setMode(mode);
      } else {
        setCurrentSession(startEditFeaturesSession(app, currentLayer.value, mode));
      }
    },
    stop() {
      setCurrentSession(null);
    },
    getDefaultLayer() {
      return layer;
    },
    destroy() {
      layerWatcher();
      app.layers.remove(layer);
      layer.destroy();
      setCurrentSession(null);
    },
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {EditorToolbox}
 */
function createTransformationToolbox(manager, app) {
  const tools = [
    {
      name: TransformationMode.SELECT,
      icon: '$vcsPointSelect',
      title: `drawing.transform.${TransformationMode.SELECT}`,
    },
    {
      name: TransformationMode.TRANSLATE,
      icon: 'mdi-axis-arrow',
      title: `drawing.transform.${TransformationMode.TRANSLATE}`,
    },
    {
      name: TransformationMode.ROTATE,
      icon: 'mdi-rotate-3d-variant',
      title: `drawing.transform.${TransformationMode.ROTATE}`,
    },
    {
      name: TransformationMode.SCALE,
      icon: 'mdi-arrow-top-right-bottom-left',
      title: `drawing.transform.${TransformationMode.SCALE}`,
    },
  ];
  const handleMapChanged = (map) => {
    if (map instanceof CesiumMap && !tools.some(t => t.name === TransformationMode.EXTRUDE)) {
      tools.push({
        name: TransformationMode.EXTRUDE,
        icon: '$vcsWall',
        title: `drawing.transform.${TransformationMode.EXTRUDE}`,
      });
    } else {
      const index = tools.findIndex(t => t.name === TransformationMode.EXTRUDE);
      if (index > -1) {
        tools.splice(index, 1);
      }
    }
  };
  handleMapChanged(app.maps.activeMap);
  const mapActivatedListener = app.maps.mapActivated.addEventListener(handleMapChanged);

  const toolbox = {
    type: ToolboxType.SELECT,
    action: {
      name: 'transformation',
      currentIndex: 0,
      active: false,
      callback() {
        if (this.active && manager.currentSession.value) {
          manager.stop();
        } else {
          manager.startTransformSession(tools[this.currentIndex].name);
        }
      },
      selected(newIndex) {
        this.currentIndex = newIndex;
        manager.startTransformSession(tools[this.currentIndex].name);
      },
      tools,
    },
  };

  const setIndexFromMode = (mode) => {
    const index = toolbox.action.tools.findIndex(t => t.name === mode);
    if (toolbox.action.currentIndex !== index) {
      toolbox.action.currentIndex = index;
    }
  };

  let modeListener = () => {};
  const sessionWatcher = watch(manager.currentSession, () => {
    toolbox.action.active = manager.currentSession.value?.type === SessionType.EDIT_FEATURES;
    modeListener();
    if (toolbox.action.active) {
      modeListener = manager.currentSession.value.modeChanged.addEventListener(setIndexFromMode);
      setIndexFromMode(manager.currentSession.value.mode);
    }
  });

  return {
    toolbox,
    destroy() {
      mapActivatedListener();
      sessionWatcher();
      modeListener();
    },
  };
}

/**
 * @param {EditorManager} manager
 * @returns {EditorToolbox}
 */
function createCreateToolbox(manager) {
  const createCreateButton = geometryType => ({
    name: geometryType,
    title: `drawing.create.${geometryType}`,
    icon: GeometryTypeIcon[geometryType],
  });

  const toolbox = {
    type: ToolboxType.SELECT,
    action: {
      name: 'creation',
      currentIndex: 0,
      active: false,
      callback() {
        if (this.active) {
          manager.stop();
        } else {
          manager.startCreateSession(this.tools[this.currentIndex].name);
        }
      },
      selected(newIndex) {
        if (newIndex !== this.currentIndex) {
          this.currentIndex = newIndex;
          manager.startCreateSession(this.tools[this.currentIndex].name);
        }
      },
      tools: [
        createCreateButton(GeometryType.Polygon),
        createCreateButton(GeometryType.Point),
        createCreateButton(GeometryType.LineString),
        createCreateButton(GeometryType.Circle),
        createCreateButton(GeometryType.BBox),
      ],
    },
  };

  const destroy = watch(manager.currentSession, () => {
    toolbox.action.active = manager.currentSession.value?.type === SessionType.CREATE;
    if (toolbox.action.active) {
      const index = toolbox.action.tools.findIndex(t => t.name === manager.currentSession.value.geometryType);
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
 * @returns {EditorToolbox}
 */
function createEditToolbox(manager) {
  const toolbox = {
    type: ToolboxType.SINGLE,
    action: {
      name: 'edit',
      title: 'edit',
      icon: '$vcsPen',
      active: false,
      callback() {
        if (this.active && manager.currentSession.value) {
          manager.stop();
        } else {
          manager.startEditSession();
        }
      },
    },
  };

  const destroy = watch(manager.currentSession, () => {
    toolbox.action.active = manager.currentSession.value?.type === SessionType.EDIT_GEOMETRY;
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
  const { toolbox: createToolbox, destroy: destroyCreateToolbox } = createCreateToolbox(manager);
  const createId = app.toolboxManager.add(createToolbox, name).id;
  const { toolbox: editToolbox, destroy: destroyEditToolbox } = createEditToolbox(manager);
  const editId = app.toolboxManager.add(editToolbox, name).id;
  const { toolbox: transformToolbox, destroy: destroyTransformToolbox } = createTransformationToolbox(manager, app);
  const transformId = app.toolboxManager.add(transformToolbox, name).id;

  return () => {
    app.toolboxManager.remove(createId);
    app.toolboxManager.remove(editId);
    app.toolboxManager.remove(transformId);
    destroyCreateToolbox();
    destroyEditToolbox();
    destroyTransformToolbox();
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export function setupFeaturePropertyWindow(manager, app) {
  const featurePropertyWindowId = 'DrawingFeaturePropertyWindow';
  const toggleWindow = () => {
    if (manager.currentFeatures.value.length > 0) {
      if (!app.windowManager.has(featurePropertyWindowId)) {
        app.windowManager.add({
          id: featurePropertyWindowId,
          component: FeaturePropertyWindow,
          slot: WindowSlot.DYNAMIC_RIGHT,
          provides: {
            manager,
          },
        }, name);
      }
    } else {
      app.windowManager.remove(featurePropertyWindowId);
    }
  };
  const featuresChangedListener = watch(manager.currentFeatures, toggleWindow);

  return () => {
    app.windowManager.remove(featurePropertyWindowId);
    featuresChangedListener();
  };
}

export function addContextMenu(manager, app) {}
