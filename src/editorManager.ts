import { watch, shallowRef, nextTick } from 'vue';
import type { ShallowRef } from 'vue';
import type {
  CreateFeatureSession,
  EditFeaturesSession,
  EditGeometrySession,
  EditorSession,
  SelectFeaturesSession,
  VectorStyleItemOptions,
} from '@vcmap/core';
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
  PanoramaMap,
  getHeightFromTerrainProvider,
  ObliqueMap,
} from '@vcmap/core';
import { Feature } from 'ol';
import type { CesiumTerrainProvider } from '@vcmap-cesium/engine';
import { getLogger } from '@vcsuite/logger';
import type { VcsUiApp } from '@vcmap/ui';
import { LineString, Point, Polygon } from 'ol/geom';
import { unByKey } from 'ol/Observable.js';
import type { Style } from 'ol/style.js';
import { name } from '../package.json';

export type EditorManager = {
  currentSession: ShallowRef<EditorSession | null>;
  currentEditSession: ShallowRef<EditorSession | null>;
  currentFeatures: ShallowRef<Feature[]>;
  currentLayer: ShallowRef<VectorLayer>;
  startCreateSession(geometryType: GeometryType): void;
  startSelectSession(features?: Feature[]): void;
  startEditSession(feature?: Feature): Promise<void>;
  startTransformSession(
    mode: TransformationMode,
    features?: Feature[],
  ): Promise<void>;
  getDefaultLayer(): VectorLayer;
  placeCurrentFeaturesOnTerrain(): Promise<void>;
  stop(): Promise<void>;
  stopEditing(): Promise<void>;
  destroy(): void;
};

export const selectInteractionId = 'select_interaction_id';

function createSimpleEditorLayer(app: VcsUiApp): VectorLayer {
  const layer = new VectorLayer({
    projection: mercatorProjection.toJSON(),
    zIndex: maxZIndex - 1,
    mapNames: [
      CesiumMap.className,
      OpenlayersMap.className,
      ObliqueMap.className,
      PanoramaMap.className,
    ],
  });
  markVolatile(layer);
  layer.activate().catch((e: unknown) => {
    getLogger(name).error('Error activating simple editor layer', e);
  });
  app.layers.add(layer);
  return layer;
}

export function isCreateSession(
  session?: EditorSession | null,
): session is CreateFeatureSession<GeometryType> {
  return !!session && session.type === SessionType.CREATE;
}
export function isSelectSession(
  session?: EditorSession | null,
): session is SelectFeaturesSession {
  return !!session && session.type === SessionType.SELECT;
}
export function isEditGeometrySession(
  session?: EditorSession | null,
): session is EditGeometrySession {
  return !!session && session.type === SessionType.EDIT_GEOMETRY;
}
export function assertIsSelectSession(
  session?: EditorSession | null,
): asserts session is SelectFeaturesSession {
  if (!isSelectSession(session)) {
    throw new Error('Session is not a SelectFeaturesSession');
  }
}

function setupSessionListener(
  app: VcsUiApp,
  session: EditorSession,
  currentFeatures: ShallowRef<Feature[]>,
  layer: VectorLayer,
  templateFeature: Feature | undefined,
): () => void {
  const listeners: (() => void)[] = [];
  if (isSelectSession(session)) {
    listeners.push(
      session.featuresChanged.addEventListener((newFeatures) => {
        currentFeatures.value = newFeatures;
      }),
    );
  }

  if (isCreateSession(session)) {
    listeners.push(
      session.featureCreated.addEventListener((newFeature) => {
        currentFeatures.value = [newFeature];
        const style =
          (templateFeature?.getStyle() as Style | undefined)?.clone() ||
          (layer.style.style as Style).clone();
        const properties = templateFeature?.getProperties();
        delete properties?.geometry; // delete geomertry from template properties
        if (properties && app.maps.activeMap instanceof OpenlayersMap) {
          properties.olcs_altitudeMode = 'clampToGround';
        }
        currentFeatures.value[0].setStyle(style);
        const styleOptions = getStyleOptions(style) as VectorStyleItemOptions;
        if (styleOptions.text?.text) {
          styleOptions.label = Array.isArray(styleOptions.text.text)
            ? styleOptions.text.text.map(String).join('')
            : styleOptions.text.text;
        }
        currentFeatures.value[0][vectorStyleSymbol] = new VectorStyleItem(
          styleOptions,
        );
        if (properties && Object.keys(properties).length) {
          currentFeatures.value[0].setProperties(properties);
        }
      }),
      (): void => {
        app.maps.eventHandler.featureInteraction.pullPickedPosition = 0;
      },
    );

    listeners.push(
      session.creationFinished.addEventListener(() => {
        currentFeatures.value = [templateFeature!];
      }),
    );
  }

  return () => {
    listeners.forEach((l) => {
      l();
    });
  };
}

/**
 * Creates listeners that listen to select session changes and apply these to the edit sessions.
 */
function setupEditSessionListeners(
  selectSession: SelectFeaturesSession,
  editSession: EditGeometrySession | EditFeaturesSession,
): () => void {
  let updateFeatures: (newFeatures: Feature[]) => void;
  if (editSession.type === SessionType.EDIT_FEATURES) {
    updateFeatures = (newFeatures): void => {
      editSession.setFeatures(newFeatures);
    };
  } else if (isEditGeometrySession(editSession)) {
    updateFeatures = (newFeatures): void => {
      editSession.setFeature(newFeatures[0]);
    };
  }
  const featuresChangesListener =
    selectSession.featuresChanged.addEventListener(updateFeatures!);
  const stopListener = selectSession.stopped.addEventListener((): void => {
    editSession.stop();
  });

  return (): void => {
    featuresChangesListener();
    stopListener();
  };
}

export function createSimpleEditorManager(app: VcsUiApp): EditorManager {
  const currentSession = shallowRef<EditorSession | null>(null);
  const currentEditSession = shallowRef<
    EditGeometrySession | EditFeaturesSession | null
  >(null);
  const currentFeatures = shallowRef<Feature[]>([]);
  const layer = createSimpleEditorLayer(app);
  const currentLayer = shallowRef(layer);

  let templateFeature: Feature | undefined;
  let sessionListener = (): void => {};
  let editSessionListener = (): void => {};
  let sessionStoppedListener = (): void => {};
  let editSessionStoppedListener = (): void => {};

  /**
   * Stops running sessions and starts a new one.
   * @param newSession The new editor session to be started.
   */
  function setCurrentSession(newSession: EditorSession | null): void {
    sessionStoppedListener();
    sessionListener();
    currentFeatures.value = [];
    currentSession.value?.stop?.();

    currentSession.value = newSession;
    if (currentSession.value) {
      sessionStoppedListener = currentSession.value.stopped.addEventListener(
        () => {
          setCurrentSession(null);
        },
      );

      sessionListener = setupSessionListener(
        app,
        currentSession.value,
        currentFeatures,
        currentLayer.value,
        templateFeature,
      );
    } else {
      sessionStoppedListener = (): void => {};
      sessionListener = (): void => {};
    }
  }

  /**
   * Sets a new edit sesstion (either features or geometry) and makes sure that the current edit session is stopped and there is a selection session running.
   * @param newSessionCallback
   * @param features Initially selected features
   */
  async function setCurrentEditSession(
    newSessionCallback:
      | (() => EditFeaturesSession | EditGeometrySession)
      | null,
    features?: Feature[] | Feature,
  ): Promise<void> {
    editSessionStoppedListener();
    editSessionListener();
    currentEditSession.value?.stop?.();
    const newSession = newSessionCallback?.() || null;
    if (newSession) {
      // next tick is needed because onUnmounted the window ends the current editing session.
      await nextTick();
      const selectionMode = isEditGeometrySession(newSession)
        ? SelectionMode.SINGLE
        : SelectionMode.MULTI;
      if (!isSelectSession(currentSession.value)) {
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
      assertIsSelectSession(currentSession.value);

      editSessionStoppedListener = newSession.stopped.addEventListener(() =>
        setCurrentEditSession(null),
      );
      editSessionListener = setupEditSessionListeners(
        currentSession.value,
        newSession,
      );

      if (features) {
        await currentSession.value?.setCurrentFeatures(features);
      } else if (isEditGeometrySession(newSession)) {
        newSession.setFeature(currentSession.value?.currentFeatures[0]);
      } else {
        newSession.setFeatures(currentSession.value?.currentFeatures);
      }
    } else {
      editSessionStoppedListener = (): void => {};
      editSessionListener = (): void => {};
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
    startCreateSession(geometryType: GeometryType): void {
      if (
        !templateFeature?.getGeometry() ||
        geometryType !== templateFeature.getGeometry()?.getType()
      ) {
        let geometry;
        const id = `draw.create.${geometryType}`;
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
            session.featureAltitudeMode = templateFeature?.get(key);
          }
        },
      );
      const listener = session.stopped.addEventListener(() => {
        unByKey(templateFeatureListener);
        listener();
      });
      setCurrentSession(session);
      currentFeatures.value = [templateFeature];
      app.maps.eventHandler.featureInteraction.pullPickedPosition = 0.05;
    },
    startSelectSession(features?: Feature[] | Feature): void {
      if (!isSelectSession(currentSession.value)) {
        setCurrentSession(
          startSelectFeaturesSession(
            app,
            currentLayer.value,
            selectInteractionId,
            undefined,
          ),
        );
      }
      assertIsSelectSession(currentSession.value);
      if (features) {
        currentSession.value
          .setCurrentFeatures(features)
          .catch((e: unknown) => {
            getLogger(name).error(
              'Error setting current features in select session',
              e,
            );
          });
      }
    },
    async startEditSession(feature: Feature): Promise<void> {
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
    async startTransformSession(
      mode: TransformationMode,
      features?: Feature[] | Feature,
    ): Promise<void> {
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
    async stop(): Promise<void> {
      setCurrentSession(null);
      await setCurrentEditSession(null);
    },
    async stopEditing(): Promise<void> {
      await setCurrentEditSession(null);
      if (isSelectSession(currentSession.value)) {
        currentSession.value.setMode(SelectionMode.MULTI);
      }
    },
    async placeCurrentFeaturesOnTerrain(): Promise<void> {
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
            const { terrainProvider } = map.getScene()!;
            if (!terrainProvider || !terrainProvider.availability) {
              return 0;
            }
            await getHeightFromTerrainProvider(
              terrainProvider as CesiumTerrainProvider,
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
        (currentEditSession.value as EditFeaturesSession).translate(
          0,
          0,
          maxDiff,
        );
      }
    },
    getDefaultLayer(): VectorLayer {
      return layer;
    },
    destroy(): void {
      setCurrentSession(null);
      mapChangedListener();
      layerWatcher();
      app.layers.remove(layer);
      layer.destroy();
    },
  };
}
