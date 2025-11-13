import { watch, shallowRef, nextTick } from 'vue';
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
  OpenlayersMap,
  CesiumMap,
  getFlatCoordinateReferences,
  TransformationMode,
  vectorStyleSymbol,
  VectorStyleItem,
  getStyleOptions,
  ObliqueMap,
  PanoramaMap,
  getHeightFromTerrainProvider,
} from '@vcmap/core';
import { Feature } from 'ol';
import { LineString, Point, Polygon } from 'ol/geom';
import { unByKey } from 'ol/Observable.js';

/**
 * @typedef {Object} EditorManager
 * @property {import("vue").ShallowRef<null|import("@vcmap/core").EditorSession>} currentSession
 * @property {import("vue").ShallowRef<null|import("@vcmap/core").EditorSession>} currentEditSession
 * @property {import("vue").ShallowRef<Array<import("ol").Feature>>} currentFeatures
 * @property {import("vue").ShallowRef<import("@vcmap/core").VectorLayer>} currentLayer
 * @property {function(import("@vcmap/core").GeometryType):void} startCreateSession
 * @property {function(import("ol").Feature[]=):void} startSelectSession - optional features to select
 * @property {function(import("ol").Feature=):Promise<void>} startEditSession - optional feature to select
 * @property {function(import("@vcmap/core").TransformationMode, import("ol").Feature[]=):void} startTransformSession
 * @property {function():import("@vcmap/core").VectorLayer} getDefaultLayer
 * @property {function():void} placeCurrentFeaturesOnTerrain - Places features on top of the terrain. When multiple features are selected, the relative position is not changed.
 * @property {function():Promise<void>} stop
 * @property {function():Promise<void>} stopEditing
 * @property {function():void} destroy
 */

export const selectInteractionId = 'select_interaction_id';

/**
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {import("@vcmap/core").VectorLayer}
 */
function createSimpleEditorLayer(app) {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    zIndex: maxZIndex - 1,
    mapTypes: [
      CesiumMap.className,
      OpenlayersMap.className,
      ObliqueMap.className,
      PanoramaMap.className,
    ],
  });
  markVolatile(layer);
  layer.activate();
  app.layers.add(layer);

  return layer;
}

/**
 * @param {import("@vcmap/core").VcsApp} app
 * @param {import("@vcmap/core").EditorSession} session
 * @param {import("vue").ShallowRef<Array<import("ol").Feature>>} currentFeatures
 * @param {import("@vcmap/core").VectorLayer} layer
 * @param {import("ol").Feature} templateFeature
 * @returns {function():void}
 */
function setupSessionListener(
  app,
  session,
  currentFeatures,
  layer,
  templateFeature,
) {
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
        const style =
          templateFeature.getStyle()?.clone() || layer.style.style.clone();
        const properties = templateFeature.getProperties();
        delete properties.geometry; // delete geomertry from template properties
        if (app.maps.activeMap instanceof OpenlayersMap) {
          properties.olcs_altitudeMode = 'clampToGround';
        }
        currentFeatures.value[0].setStyle(style);
        const styleOptions = getStyleOptions(style);
        if (styleOptions.text?.text) {
          styleOptions.label = styleOptions.text.text;
        }
        currentFeatures.value[0][vectorStyleSymbol] = new VectorStyleItem(
          styleOptions,
        );
        if (Object.keys(properties).length) {
          currentFeatures.value[0].setProperties(properties);
        }
      }),
      () => {
        app.maps.eventHandler.featureInteraction.pullPickedPosition = 0;
      },
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
  const currentFeatures = shallowRef([]);
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
        app,
        currentSession.value,
        currentFeatures,
        currentLayer.value,
        templateFeature,
      );
    } else {
      sessionStoppedListener = () => {};
      sessionListener = () => {};
    }
  }

  /**
   * Sets a new edit sesstion (either features or geometry) and makes sure that the current edit session is stopped and there is a selection session running.
   * @param {(function():import("@vcmap/core").EditFeaturesSession | import("@vcmap/core").EditGeometrySession) | null} newSessionCallback
   * @param {import("ol").Feature[] | import("ol").Feature } [features] Initially selected features
   */
  async function setCurrentEditSession(newSessionCallback, features) {
    editSessionStoppedListener();
    editSessionListener();
    currentEditSession.value?.stop?.();
    const newSession = newSessionCallback?.() || null;
    if (newSession) {
      // next tick is needed because onUnmounted the window ends the current editing session.
      await nextTick();
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

      editSessionStoppedListener = newSession.stopped.addEventListener(
        setCurrentEditSession,
      );
      editSessionListener = setupEditSessionListeners(
        currentSession.value,
        newSession,
      );

      if (features) {
        await currentSession.value?.setCurrentFeatures(features);
      } else if (newSession.type === SessionType.EDIT_GEOMETRY) {
        newSession.setFeature(currentSession.value?.currentFeatures[0]);
      } else {
        newSession.setFeatures(currentSession.value?.currentFeatures);
      }
    } else {
      editSessionStoppedListener = () => {};
      editSessionListener = () => {};
    }
    currentEditSession.value = newSession;
  }

  const layerWatcher = watch(currentLayer, () => {
    setCurrentSession(null);
    if (!currentLayer.value) {
      currentLayer.value = layer;
    }
  });

  let templateFeatureProperties = {};
  const mapChangedListener = app.maps.mapActivated.addEventListener((map) => {
    if (templateFeature) {
      templateFeature = undefined;
    }
    if (map.className === PanoramaMap.className) {
      templateFeatureProperties = { olcs_altitudeMode: 'absolute' };
    } else {
      templateFeatureProperties = {};
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
        const id = `drawing.create.${geometryType}`;
        // create dummy geomtery. Template feature must have geometry, otherwise property components can not recognize what type of feature will be drawn next.
        // alternative would be to pass through the geometry type (in e.g. styleComponent), but might be more errorprone and complex
        switch (geometryType) {
          case GeometryType.Point:
            geometry = new Point([]);
            break;
          case GeometryType.LineString:
            geometry = new LineString([]);
            break;
          default:
            geometry = new Polygon([]);
            break;
        }
        templateFeature = new Feature({
          geometry,
          ...templateFeatureProperties,
        });
        templateFeature.setId(id);
      }

      const session = startCreateFeatureSession(
        app,
        currentLayer.value,
        geometryType,
      );
      const templateFeatureListener = templateFeature.on(
        'propertychange',
        ({ key }) => {
          if (key === 'olcs_altitudeMode') {
            session.featureAltitudeMode = templateFeature.get(key);
          }
        },
      );
      session.stopped.addEventListener(() => {
        unByKey(templateFeatureListener);
      });
      setCurrentSession(session);
      currentFeatures.value = [templateFeature];
      app.maps.eventHandler.featureInteraction.pullPickedPosition = 0.05;
    },
    startSelectSession(features) {
      if (currentEditSession.value?.type !== SessionType.SELECT) {
        setCurrentSession(
          startSelectFeaturesSession(
            app,
            currentLayer.value,
            selectInteractionId,
            undefined,
          ),
        );
      }
      if (features) {
        currentSession.value?.setCurrentFeatures(features);
      }
    },
    async startEditSession(feature) {
      await setCurrentEditSession(
        () =>
          startEditGeometrySession(
            app,
            currentLayer.value,
            selectInteractionId,
          ),
        feature,
      );
    },
    async startTransformSession(mode, features) {
      await setCurrentEditSession(
        () =>
          startEditFeaturesSession(
            app,
            currentLayer.value,
            selectInteractionId,
            mode,
          ),
        features,
      );
    },
    async stop() {
      setCurrentSession(null);
      await setCurrentEditSession(null);
    },
    async stopEditing() {
      await setCurrentEditSession(null);
      if (currentSession?.value?.type === SessionType.SELECT) {
        currentSession.value.setMode(SelectionMode.MULTI);
      }
    },
    async placeCurrentFeaturesOnTerrain() {
      // can't use placeGeometryOnTerrain from @vcmap/core since edit features handlers do not listen to geometry changes
      const map = app.maps.activeMap;

      // XXX this does not work for XY layouts
      const maxDiffs = await Promise.all(
        // XXX do this in one go: get all coordiantes first, then place them onto terrain
        currentFeatures.value.map(async (feature) => {
          let maxDiff = 0;
          const geometry = feature.getGeometry();
          if (
            (map instanceof CesiumMap || map instanceof PanoramaMap) &&
            geometry
          ) {
            const flats = getFlatCoordinateReferences(geometry);
            const groundFlats = structuredClone(flats);
            const { terrainProvider } = map.getScene();
            if (!terrainProvider || !terrainProvider.availability) {
              return 0;
            }
            await getHeightFromTerrainProvider(
              terrainProvider,
              groundFlats,
              mercatorProjection,
              groundFlats,
            );
            maxDiff = flats.reduce((acc, coord, index) => {
              const current = groundFlats[index][2] - coord[2];
              return current > acc ? current : acc;
            }, -Infinity);
          }
          return maxDiff;
        }),
      );
      const maxDiff = Math.max(...maxDiffs);
      if (Number.isFinite(maxDiff) && maxDiff !== 0) {
        this.startTransformSession(TransformationMode.TRANSLATE);
        currentEditSession.value.translate(0, 0, maxDiff);
      }
    },
    getDefaultLayer() {
      return layer;
    },
    destroy() {
      setCurrentSession(null);
      mapChangedListener();
      layerWatcher();
      app.layers.remove(layer);
      layer.destroy();
    },
  };
}
