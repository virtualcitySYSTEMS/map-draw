import type {
  VectorLayer,
  CategoryOptions,
  VcsObjectOptions,
  PanoramaImage,
  VcsMap,
} from '@vcmap/core';
import {
  Category,
  writeGeoJSONFeature,
  parseGeoJSON,
  Viewpoint,
  mercatorProjection,
  Extent,
  SessionType,
  FeatureVisibilityAction,
  CesiumMap,
  ObliqueMap,
  OpenlayersMap,
  PanoramaMap,
} from '@vcmap/core';
import type {
  CollectionComponentClass,
  CollectionComponentListItem,
  EditorCollectionComponentClass,
  VcsUiApp,
} from '@vcmap/ui';
import {
  callSafeAction,
  createListExportAction,
  createListImportAction,
  importIntoLayer,
  makeEditorCollectionComponentClass,
} from '@vcmap/ui';
import { getLogger } from '@vcsuite/logger';
import { Feature } from 'ol';
import { unByKey } from 'ol/Observable.js';
import { reactive, watch } from 'vue';
import { isEmpty } from 'ol/extent.js';
import { name } from '../../package.json';
import {
  assertIsSelectSession,
  isSelectSession,
  type EditorManager,
} from '../editorManager.js';
import { exportFeatures } from '../util/actionHelper.js';
import { getDrawEditor } from '../util/windowHelper.js';

type SimpleDrawingItem = VcsObjectOptions & {
  name: string;
  feature: Feature;
};

type DrawingCategoryOptions = CategoryOptions<SimpleDrawingItem> & {
  categoryType: CategoryType;
  layer: VectorLayer;
};

enum CategoryType {
  NONE = 0,
  SHAPE = 1,
  TEXT = 2,
  OBJECT = 3,
}

function setTitleOnFeature(feature: Feature, layer: VectorLayer): void {
  const geometry = feature.getGeometry();
  let typeName = 'Unknown';
  if (geometry) {
    typeName = geometry.get('_vcsGeomType') ?? geometry.getType();
  }

  let featureName;
  let count = 0;

  const sameTypeFeaturesNames = new Set(
    layer
      .getFeatures()
      .filter((f) => f.getGeometry()?.getType() === typeName)
      .map((f) => f.get('title')),
  );

  do {
    count += 1;
    if (!sameTypeFeaturesNames.has(`${typeName}-${count}`)) {
      featureName = `${typeName}-${count}`;
    }
  } while (!featureName);

  feature.set('title', featureName, true);
}

class SimpleEditorCategory extends Category<SimpleDrawingItem> {
  static get className(): string {
    return 'SimpleEditorCategory';
  }
  categoryType: CategoryType;
  protected _layer: VectorLayer;
  // eslint-disable-next-line class-methods-use-this
  private _layerListeners: () => void = () => {};

  constructor(options: DrawingCategoryOptions) {
    super(options);
    this.categoryType = options.categoryType;
    this._layer = options.layer;
    this._updateLayerSource();
  }

  private _updateLayerSource(): void {
    this._layerListeners();
    const source = this._layer.getSource();

    // In case the collection already has layers
    [...this.collection].forEach((item) => {
      if (!this._layer.getFeatureById(item.name)) {
        this._itemAdded(item);
      }
    });

    const sourceListeners = [
      source.on('removefeature', ({ feature }) => {
        const item = this.collection.getByKey(feature?.getId());
        if (item) {
          this.collection.remove(item);
        }
      }),
      source.on('addfeature', ({ feature }) => {
        if (feature && !this.collection.hasKey(feature.getId())) {
          if (!feature.get('title')) {
            setTitleOnFeature(feature, this._layer);
          }
          this.collection.add({
            name: String(feature.getId()),
            feature,
          });
        }
      }),
    ];

    this._layerListeners = (): void => {
      unByKey(sourceListeners);
    };
  }

  mergeOptions(options: DrawingCategoryOptions): void {
    super.mergeOptions(options);
    this._layer = options.layer;
    this._updateLayerSource();
  }

  protected _itemAdded(item: SimpleDrawingItem): void {
    // Is needed because in core the feature first gets removed, which triggers the source listener above and ends in an event trigger cicle that does not stop.
    // If in core intead of removing, just checking if it is already existing AND set item.name as features id ->>> no need to override original function
    if (!this._layer.getFeatureById(item.name)) {
      let { feature } = item;
      if (!(feature instanceof Feature)) {
        const features = parseGeoJSON(feature);
        feature = Array.isArray(features) ? features[0] : features;
      }
      feature.setId(item.name);
      this._layer.addFeatures([feature]);
    }
  }

  protected _itemRemoved(item: SimpleDrawingItem): void {
    if (this._layer.getFeatureById(item.name)) {
      this._layer.removeFeaturesById([item.name]);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  protected _deserializeItem(
    item: SimpleDrawingItem,
  ): Promise<SimpleDrawingItem> {
    const { features } = parseGeoJSON(item.feature);
    if (features[0]) {
      // XXX do we warn on feature collection?
      item.feature = features[0];
    }
    return Promise.resolve(item);
  }

  // eslint-disable-next-line class-methods-use-this
  protected _serializeItem(item: SimpleDrawingItem): SimpleDrawingItem {
    return {
      name: item.name,
      feature: writeGeoJSONFeature(item.feature),
    };
  }
}

export default SimpleEditorCategory;

function itemMappingFunction(
  vcsApp: VcsUiApp,
  manager: EditorManager,
  featureItem: SimpleDrawingItem,
  _c: CollectionComponentClass<SimpleDrawingItem>,
  categoryListItem: CollectionComponentListItem,
): void {
  categoryListItem.title = featureItem.feature.get('title') ?? 'Object';
  const layer = manager.getDefaultLayer();

  let hidden = !!layer.featureVisibility.hiddenObjects[featureItem.name];

  const hideAction = reactive({
    name: 'hideAction',
    icon: hidden ? '$vcsCheckbox' : '$vcsCheckboxChecked',
    callback() {
      if (!hidden) {
        layer.featureVisibility.hideObjects([featureItem.name]);
        hidden = true;
        this.icon = '$vcsCheckbox';
        if (manager.currentFeatures.value.includes(featureItem.feature)) {
          const newSelection = manager.currentFeatures.value.filter(
            (feature) => feature.getId() !== featureItem.feature.getId(),
          );
          assertIsSelectSession(manager.currentSession.value);
          manager.currentSession.value
            .setCurrentFeatures(newSelection)
            .catch((e: unknown) => {
              getLogger(name).error(
                'Error updating current features after hiding feature',
                e,
              );
            });
        }
      } else {
        layer.featureVisibility.showObjects([featureItem.name]);
        hidden = false;
        this.icon = '$vcsCheckboxChecked';
      }
    },
  });

  const hideListener = layer.featureVisibility.changed.addEventListener(
    (event) => {
      if (
        (event.action === FeatureVisibilityAction.HIDE ||
          event.action === FeatureVisibilityAction.SHOW) &&
        event.ids.some((id) => id === categoryListItem.name)
      ) {
        hidden = !!layer.featureVisibility.hiddenObjects[categoryListItem.name];
        hideAction.icon = hidden ? '$vcsCheckbox' : '$vcsCheckboxChecked';
      }
    },
  );

  categoryListItem.selectionChanged = (selected): void => {
    if (selected && hidden) {
      callSafeAction(hideAction);
    }
  };

  categoryListItem.titleChanged = (newTitle): void => {
    featureItem.feature.set('title', newTitle);
    categoryListItem.title = newTitle;
  };

  categoryListItem.actions.push(
    hideAction,
    {
      name: 'draw.category.zoomTo',
      async callback() {
        const extent = featureItem.feature.getGeometry()?.getExtent?.();
        if (extent && !isEmpty(extent)) {
          const vp = Viewpoint.createViewpointFromExtent(
            new Extent({
              coordinates: extent,
              projection: mercatorProjection.toJSON(),
            }),
          );
          if (vp) {
            vp.animate = true;
            await vcsApp.maps.activeMap?.gotoViewpoint(vp);
          }
        }
      },
    },
    {
      name: 'draw.category.edit',
      callback() {
        if (hidden) {
          callSafeAction(hideAction);
        }
        if (manager.currentLayer.value !== layer) {
          manager.currentLayer.value = layer;
        }
        manager.startEditSession(featureItem.feature).catch((e: unknown) => {
          getLogger(name).error('Error starting edit session for feature', e);
        });
      },
    },
  );

  let currentImageListener = (): void => {};
  const panoramaImageChanged = (image?: PanoramaImage): void => {
    categoryListItem.disabled = !image?.hasDepth;
  };

  const mapChanged = (map: VcsMap | null): void => {
    currentImageListener();
    if (
      map instanceof OpenlayersMap ||
      map instanceof CesiumMap ||
      map instanceof ObliqueMap
    ) {
      categoryListItem.disabled = false;
    } else if (map instanceof PanoramaMap) {
      currentImageListener =
        map.currentImageChanged.addEventListener(panoramaImageChanged);
      panoramaImageChanged(map.currentPanoramaImage);
    } else {
      categoryListItem.disabled = true;
    }
  };

  const mapChangedListener =
    vcsApp.maps.mapActivated.addEventListener(mapChanged);
  mapChanged(vcsApp.maps.activeMap);

  categoryListItem.destroy = (): void => {
    hideListener();
    mapChangedListener();
    currentImageListener();
  };
}

function syncSelection(
  manager: EditorManager,
  categoryUiItem: EditorCollectionComponentClass<SimpleDrawingItem>,
  layer: VectorLayer,
): () => void {
  let selectionRevision = 0;
  let featureRevision = 0;

  const selectionWatcher = watch(categoryUiItem.selection, () => {
    if (selectionRevision < featureRevision) {
      selectionRevision = featureRevision;
      return;
    }
    if (selectionRevision === featureRevision) {
      selectionRevision += 1;
      const { selection } = categoryUiItem;
      if (manager.currentLayer.value !== layer) {
        manager.currentLayer.value = layer;
      }
      if (
        manager.currentSession.value?.type !== SessionType.SELECT &&
        selection.value.length
      ) {
        manager.startSelectSession();
      }
      if (isSelectSession(manager.currentSession.value)) {
        manager.currentSession.value
          .setCurrentFeatures(
            layer.getFeaturesById(selection.value.map((i) => i.name)),
          )
          .catch((e: unknown) => {
            getLogger(name).error(
              'Error updating current features from selection',
              e,
            );
          });
      }
      selection.value.forEach((featureItem) => {
        if (layer.featureVisibility.hiddenObjects[featureItem.name]) {
          layer.featureVisibility.showObjects([featureItem.name]);
        }
      });
    }
  });
  const featureWatcher = watch(manager.currentFeatures, () => {
    if (featureRevision < selectionRevision) {
      featureRevision = selectionRevision;
      return;
    }
    if (featureRevision === selectionRevision) {
      featureRevision += 1;
      categoryUiItem.selection.value = categoryUiItem.items.value.filter((i) =>
        manager.currentFeatures.value.find((f) => f.getId() === i.name),
      ); // XXX perfomance?
    }
  });
  return () => {
    selectionWatcher();
    featureWatcher();
  };
}

/**
 * Visibility state of a layers features.
 */
enum VisibilityState {
  ALL = 'all',
  NONE = 'none',
  SOME = 'some',
}

/**
 * @enum {string}
 */
const visibilityStateIcon: Record<VisibilityState, string> = {
  [VisibilityState.ALL]: '$vcsCheckboxChecked',
  [VisibilityState.NONE]: '$vcsCheckbox',
  [VisibilityState.SOME]: '$vcsCheckboxIndeterminate',
};

/**
 * Calculates the visibility state of a layer based on its features.
 */
function getVisibilityState(layer: VectorLayer): VisibilityState {
  const { hiddenObjects } = layer.featureVisibility;
  const features = layer.getFeatures();
  const visibleFeatures = features.filter(
    (feature) => !hiddenObjects[feature.getId()!],
  );
  if (visibleFeatures.length === features.length) {
    return VisibilityState.ALL;
  }
  if (visibleFeatures.length === 0) {
    return VisibilityState.NONE;
  }
  return VisibilityState.SOME;
}

export async function createCategory(
  manager: EditorManager,
  vcsApp: VcsUiApp,
): Promise<{
  destroy: () => void;
  editSelection: () => void;
}> {
  const layer = manager.getDefaultLayer();
  let visibilityState = getVisibilityState(layer);

  const hideAllAction = reactive({
    name: 'hide-all',
    title:
      visibilityState === VisibilityState.ALL
        ? 'draw.category.hideAll'
        : 'draw.category.showAll',
    icon: visibilityStateIcon[visibilityState],
    callback() {
      if (
        visibilityState === VisibilityState.ALL &&
        layer.getFeatures()?.length
      ) {
        layer.featureVisibility.hideObjects(
          layer.getFeatures().map((feature) => feature.getId()!),
        );
        if (isSelectSession(manager.currentSession.value)) {
          manager.currentSession.value.clearSelection?.();
        }
        this.icon = '$vcsCheckbox';
        this.title = 'draw.category.showAll';
      } else {
        layer.featureVisibility.clearHiddenObjects();
        this.icon = '$vcsCheckboxChecked';
        this.title = 'draw.category.hideAll';
      }
    },
  });

  function updateHideAllAction(): void {
    visibilityState = getVisibilityState(layer);
    hideAllAction.icon = visibilityStateIcon[visibilityState];
    hideAllAction.title =
      visibilityState === VisibilityState.ALL
        ? 'draw.category.hideAll'
        : 'draw.category.showAll';
  }

  const hideAllEventsKeys = [
    layer.source.on('addfeature', updateHideAllAction),
    layer.source.on('removefeature', updateHideAllAction),
  ];

  const hideAllActionListeners = [
    layer.featureVisibility.changed.addEventListener((event) => {
      if (
        event.action === FeatureVisibilityAction.HIDE ||
        event.action === FeatureVisibilityAction.SHOW
      ) {
        updateHideAllAction();
      }
    }),
    (): void => {
      unByKey(hideAllEventsKeys);
    },
  ];
  const categoryOptions: DrawingCategoryOptions = {
    type: SimpleEditorCategory.className,
    name: `Simple Drawing - shape`,
    title: 'draw.category.shape',
    featureProperty: 'feature',
    layer,
    categoryType: CategoryType.SHAPE,
  };
  const { collectionComponent, category } =
    await vcsApp.categoryManager.requestCategory<SimpleDrawingItem>(
      categoryOptions,
      name,
      { selectable: true, renamable: true, removable: true, overflowCount: 3 },
    );

  const drawEditor = getDrawEditor(manager, vcsApp);

  const categoryUiItem = makeEditorCollectionComponentClass<SimpleDrawingItem>(
    vcsApp,
    collectionComponent,
    { editor: drawEditor, multiEditor: drawEditor },
  );

  const { action: importAction, destroy: destroyImportAction } =
    createListImportAction(
      (files) =>
        importIntoLayer(files, vcsApp, manager.currentLayer.value, {
          setStyle: true,
          setVcsMeta: true,
        }),
      vcsApp.windowManager,
      name,
      'category-manager',
    );

  const { action: exportAction, destroy: destroyExportAction } =
    createListExportAction(
      categoryUiItem.selection,
      () => {
        exportFeatures(
          manager.currentFeatures.value,
          manager.currentLayer.value,
        );
      },
      name,
    );

  categoryUiItem.addActions([
    importAction,
    exportAction,
    { action: hideAllAction, owner: name },
  ]);

  vcsApp.categoryManager.addMappingFunction(
    () => true,
    itemMappingFunction.bind(null, vcsApp, manager),
    name,
    [category.name],
  );

  category.collection.removed.addEventListener((item) => {
    if (manager.currentFeatures.value.includes(item.feature)) {
      const newFeatures = manager.currentFeatures.value.filter(
        (feature: Feature) => feature.getId() !== item.feature.getId(),
      );
      manager.currentFeatures.value = newFeatures;
    }
  });

  const selectionWatchers = syncSelection(manager, categoryUiItem, layer);
  return {
    destroy: (): void => {
      selectionWatchers();
      hideAllActionListeners.forEach((cb) => {
        cb();
      });
      vcsApp.categoryManager.removeOwner(name);
      destroyExportAction();
      destroyImportAction();
    },
    editSelection: (): void => {
      if (categoryUiItem.selection.value.length === 1) {
        // @ts-expect-error ignore
        categoryUiItem.openEditorWindow();
      } else if (categoryUiItem.selection.value.length > 1) {
        categoryUiItem.openMultiEditorWindow();
      }
    },
  };
}
