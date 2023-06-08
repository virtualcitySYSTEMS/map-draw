import { watch, shallowRef, ref, computed } from 'vue';
import {
  GeometryType,
  SelectionMode,
  startCreateFeatureSession,
  startEditFeaturesSession,
  startEditGeometrySession,
  startSelectFeaturesSession,
  SessionType,
  VectorLayer,
  mercatorProjection,
  markVolatile,
  maxZIndex,
  vcsLayerName,
} from '@vcmap/core';
import { ToolboxType, WindowSlot } from '@vcmap/ui';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import { unByKey } from 'ol/Observable.js';
import { name } from '../package.json';
import FeaturePropertyWindow, {
  TransformationIcons,
  getAllowedTransformationModes,
} from './featureProperty/featuresPropertyWindow.vue';
import addKeyListeners from './util/keyListeners.js';
import {
  createDeleteAction,
  createExportSelectedAction,
} from './util/actionHelper.js';

/**
 * @typedef {Object} EditorManager
 * @property {import("vue").ShallowRef<null|import("@vcmap/core").EditorSession>} currentSession
 * @property {import("vue").ShallowRef<null|import("@vcmap/core").EditorSession>} currentEditSession
 * @property {import("vue").ShallowRef<Array<import("ol").Feature>>} currentFeatures
 * @property {import("vue").ShallowRef<import("@vcmap/core").VectorLayer>} currentLayer
 * @property {function(import("@vcmap/core").GeometryType):void} startCreateSession
 * @property {function(import("ol").Feature[]=):void} startSelectSession - optional features to select
 * @property {function(import("ol").Feature=):void} startEditSession - optional feature to select
 * @property {function(import("@vcmap/core").TransformationMode):void} startTransformSession
 * @property {function():import("@vcmap/core").VectorLayer} getDefaultLayer
 * @property {function():void} stop
 * @property {function():void} stopEditing
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

export const selectInteractionId = 'select_interaction_id';

export const featurePropertyWindowId = 'DrawingFeaturePropertyWindow';

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
 * @param {import("ol").Feature} templateFeature
 * @returns {function():void}
 */
function setupSessionListener(session, currentFeatures, templateFeature) {
  const listeners = [];
  if (session.type === SessionType.SELECT) {
    listeners.push(
      session.featuresChanged.addEventListener((newFeatures) => {
        currentFeatures.value = newFeatures;
      }),
    );
  }

  if (session.type === SessionType.CREATE) {
    listeners.push(
      session.featureCreated.addEventListener((newFeature) => {
        currentFeatures.value = [newFeature];
        const style = templateFeature.getStyle()?.clone();
        const properties = templateFeature.getProperties();
        delete properties.geometry; // delete geomertry from template properties
        if (style) {
          currentFeatures.value[0].setStyle(style);
        }
        if (Object.keys(properties).length) {
          currentFeatures.value[0].setProperties(properties);
        }
      }),
    );

    listeners.push(
      session.creationFinished.addEventListener(() => {
        currentFeatures.value = [templateFeature];
      }),
    );
  }

  return () => {
    listeners.forEach((l) => l());
  };
}

/**
 * Creates listeners that listen to select session changes and apply these to the edit sessions.
 * @param {import("@vcmap/core").SelectFeaturesSession} selectSession
 * @param {import("@vcmap/core").EditFeaturesSession | import("@vcmap/core").EditGeometrySession} editSession
 * @returns {function():void} Remove listeners
 */
function setupEditSessionListeners(selectSession, editSession) {
  let updateFeatures;
  if (editSession.type === SessionType.EDIT_FEATURES) {
    updateFeatures = (newFeatures) => {
      editSession.setFeatures(newFeatures);
    };
  } else if (editSession.type === SessionType.EDIT_GEOMETRY) {
    updateFeatures = (newFeatures) => {
      editSession.setFeature(newFeatures[0]);
    };
  }
  const featuresChangesListener =
    selectSession.featuresChanged.addEventListener(updateFeatures);
  const stopListener = selectSession.stopped.addEventListener(editSession.stop);

  return () => {
    featuresChangesListener();
    stopListener();
  };
}

/**
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {EditorManager}
 */
export function createSimpleEditorManager(app) {
  /** @type {import('vue').ShallowRef<import('@vcmap/core').EditorSession | null>} */
  const currentSession = shallowRef(null);
  /** @type {import('vue').ShallowRef<import('@vcmap/core').EditorSession | null>} */
  const currentEditSession = shallowRef(null);
  const currentFeatures = shallowRef();
  let templateFeature;
  const layer = createSimpleEditorLayer(app);
  const currentLayer = shallowRef(layer);
  let sessionListener = () => {};
  let editSessionListener = () => {};
  let sessionStoppedListener = () => {};
  let editSessionStoppedListener = () => {};

  /**
   * Stops running sessions and starts a new one.
   * @param {import('@vcmap/core').EditorSession | null} newSession The new editor session to be started.
   */
  function setCurrentSession(newSession) {
    sessionStoppedListener();
    sessionListener();
    currentFeatures.value = [];
    currentSession.value?.stop?.();

    currentSession.value = newSession;
    if (currentSession.value) {
      sessionStoppedListener =
        currentSession.value.stopped.addEventListener(setCurrentSession);

      sessionListener = setupSessionListener(
        currentSession.value,
        currentFeatures,
        templateFeature,
      );
    } else {
      sessionStoppedListener = () => {};
      sessionListener = () => {};
    }
  }

  /**
   * Sets a new edit sesstion (either features or geometry) and makes sure that the current edit session is stopped and there is a selection session running.
   * @param {import("@vcmap/core").EditFeaturesSession | import("@vcmap/core").EditGeometrySession | null} newSession
   */
  function setCurrentEditSession(newSession) {
    editSessionStoppedListener();
    editSessionListener();
    currentEditSession.value?.stop?.();
    currentEditSession.value = newSession;
    if (newSession) {
      const selectionMode =
        newSession.type === SessionType.EDIT_GEOMETRY
          ? SelectionMode.SINGLE
          : SelectionMode.MULTI;
      if (!(currentSession.value?.type === SessionType.SELECT)) {
        setCurrentSession(
          startSelectFeaturesSession(
            app,
            currentLayer.value,
            selectInteractionId,
            selectionMode,
          ),
        );
      } else {
        currentSession.value.setMode(selectionMode);
      }
      editSessionStoppedListener =
        currentEditSession.value.stopped.addEventListener(
          setCurrentEditSession,
        );
      editSessionListener = setupEditSessionListeners(
        currentSession.value,
        currentEditSession.value,
      );
    } else {
      editSessionStoppedListener = () => {};
      editSessionListener = () => {};
    }
  }

  const layerWatcher = watch(currentLayer, () => {
    setCurrentSession(null);
    if (!currentLayer.value) {
      currentLayer.value = layer;
    }
  });

  return {
    currentSession,
    currentEditSession,
    currentFeatures,
    currentLayer,
    startCreateSession(geometryType) {
      if (
        !templateFeature?.getGeometry() ||
        geometryType !== templateFeature.getGeometry()?.getType()
      ) {
        let geometry;
        let id;
        // create dummy geomtery. Template feature must have geometry, otherwise property components can not recognize what type of feature will be drawn next.
        // alternative would be to pass through the geometry type (in e.g. styleComponent), but might be more errorprone and complex
        switch (geometryType) {
          case GeometryType.Point:
            geometry = new Point([]);
            id = `drawing.create.${geometryType}`;
            break;
          case GeometryType.LineString:
            geometry = new LineString([]);
            id = `drawing.create.${geometryType}`;
            break;
          default:
            geometry = new Polygon([]);
            id = `drawing.create.${geometryType}`;
            break;
        }
        templateFeature = new Feature({ geometry });
        templateFeature.setId(id);
      }
      setCurrentSession(
        startCreateFeatureSession(app, currentLayer.value, geometryType),
      );
      currentFeatures.value = [templateFeature];
    },
    startSelectSession(features) {
      setCurrentSession(
        startSelectFeaturesSession(
          app,
          currentLayer.value,
          selectInteractionId,
        ),
      );
      if (features) {
        currentSession.value?.setCurrentFeatures(features);
      }
    },
    startEditSession(feature) {
      setCurrentEditSession(
        startEditGeometrySession(app, currentLayer.value, selectInteractionId),
      );
      if (feature) {
        // set the feature at the selectFeatureSession
        currentSession.value?.setCurrentFeatures(feature);
      } else {
        currentEditSession.value?.setFeature(
          currentSession.value?.firstFeature,
        );
      }
    },
    startTransformSession(mode, features) {
      if (currentEditSession.value?.type === SessionType.EDIT_FEATURES) {
        currentEditSession.value.setMode(mode);
      } else {
        setCurrentEditSession(
          startEditFeaturesSession(
            app,
            currentLayer.value,
            selectInteractionId,
            mode,
          ),
        );
      }
      if (features) {
        // set the feature at the selectFeatureSession
        currentSession.value?.setCurrentFeatures(features);
      } else {
        currentEditSession.value?.setFeatures(
          currentSession.value?.currentFeatures,
        );
      }
    },
    stop() {
      setCurrentSession(null);
      setCurrentEditSession(null);
    },
    stopEditing() {
      setCurrentEditSession(null);
      if (currentSession?.value.type === SessionType.SELECT) {
        currentSession.value.setMode(SelectionMode.MULTI);
      }
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
    action: {
      name: 'creation',
      currentIndex: 1,
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
        createCreateButton(GeometryType.Polygon),
        createCreateButton(GeometryType.Point),
        createCreateButton(GeometryType.LineString),
        createCreateButton(GeometryType.Circle),
        createCreateButton(GeometryType.BBox),
      ],
    },
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

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export function addToolButtons(manager, app) {
  const { toolbox: createToolbox, destroy: destroyCreateToolbox } =
    createCreateToolbox(manager);
  const createId = app.toolboxManager.add(createToolbox, name).id;

  return () => {
    app.toolboxManager.remove(createId);
    destroyCreateToolbox();
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
// XXX: Maybe move this to editor manager? So it hast api toggleWindow?
export function setupFeaturePropertyWindow(manager, app) {
  let renameListener = () => {};
  const headerTitle = ref();

  watch(manager.currentFeatures, (cur) => {
    renameListener();
    if (cur.length > 1) {
      headerTitle.value = `(${cur.length}) Features`;
    } else if (manager.currentSession.value?.type === SessionType.CREATE) {
      headerTitle.value = `drawing.create.${manager.currentSession.value.geometryType}`;
    } else if (cur.length) {
      const propertyChangeLister = cur[0].on('propertychange', ({ key }) => {
        if (key === 'title') {
          headerTitle.value = cur[0].get(key);
        }
      });
      renameListener = () => {
        unByKey(propertyChangeLister);
      };
      headerTitle.value = manager.currentFeatures.value[0].get('title');
    }
  });
  const headerActions = computed(() => [
    ...(manager.currentSession.value?.type === SessionType.SELECT
      ? [createDeleteAction(manager, 'draw-header-delete')]
      : []),
  ]);

  const toggleWindow = () => {
    if (manager.currentFeatures.value.length > 0) {
      if (!app.windowManager.has(featurePropertyWindowId)) {
        app.windowManager.add(
          {
            id: featurePropertyWindowId,
            component: FeaturePropertyWindow,
            slot: WindowSlot.DYNAMIC_RIGHT,
            provides: {
              manager,
            },
            state: {
              headerTitle,
              styles: { width: '280px', height: 'auto' },
              headerActions,
            },
          },
          name,
        );
      }
    } else {
      app.windowManager.remove(featurePropertyWindowId);
    }
  };
  const featuresChangedListener = watch(manager.currentFeatures, toggleWindow);

  return {
    destroy: () => {
      app.windowManager.remove(featurePropertyWindowId);
      featuresChangedListener();
      renameListener();
    },
    toggleWindow,
  };
}

// eslint-disable-next-line no-unused-vars
/**
 * Adds edit actions to the context menu.
 * @param {import("@vcmap/ui").VcsUiApp} app The VcsUiApp instance
 * @param {EditorManager} manager The editor manager
 * @param {string | symbol} owner The owner of the context menu entries.
 */
export function addContextMenu(app, manager, owner) {
  const { toggleWindow } = app.plugins.getByKey('@vcmap/draw');
  app.contextMenuManager.addEventHandler((event) => {
    const contextEntries = [];
    if (
      event.feature &&
      event.feature[vcsLayerName] === manager.currentLayer.value.name
    ) {
      let editFeatures = manager.currentFeatures.value; // TODO: can be replaced when setCurrentFeatures of SelectFeaturesSession returns a promise.
      if (manager.currentSession.value.type !== SessionType.SELECT) {
        manager.startSelectSession([event.feature]);
        editFeatures = [event.feature];
      } else if (
        !manager.currentFeatures.value.some(
          (feature) => feature.getId() === event.feature.getId(),
        )
      ) {
        manager.currentSession.value.setCurrentFeatures([event.feature]);
        editFeatures = [event.feature];
      }
      // if (!app.windowManager.has(featurePropertyWindowId)) {
      contextEntries.push({
        id: 'draw-edit_properties',
        name: 'drawing.contextMenu.editProperties',
        icon: '$vcsEdit',
        callback() {
          toggleWindow();
        },
      });
      // }
      if (editFeatures.length === 1) {
        contextEntries.push({
          id: 'draw-edit_geometry',
          name: 'drawing.geometry.edit',
          icon: '$vcsPen',
          callback() {
            manager.startEditSession();
          },
        });
      }
      const allowedModes = getAllowedTransformationModes(editFeatures);
      allowedModes.forEach((mode) => {
        contextEntries.push({
          id: `draw-${mode}`,
          name: `drawing.transform.${mode}`,
          icon: TransformationIcons[mode],
          callback() {
            if (!app.windowManager.has(featurePropertyWindowId)) {
              toggleWindow();
            }
            manager.startTransformSession(mode);
          },
        });
      });
      contextEntries.push(
        createExportSelectedAction(manager, 'draw-context-exportSelected'),
      );
      contextEntries.push(createDeleteAction(manager, 'draw-context-delete'));
    } else {
      manager.currentSession.value?.clearSelection?.();
    }
    return contextEntries;
  }, owner);
}
