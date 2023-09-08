import {
  Category,
  writeGeoJSONFeature,
  parseGeoJSON,
  GeometryType,
  Viewpoint,
  mercatorProjection,
  Extent,
  SessionType,
  FeatureVisibilityAction,
} from '@vcmap/core';
import { Feature } from 'ol';
import { unByKey } from 'ol/Observable.js';
import { watch } from 'vue';
import { isEmpty } from 'ol/extent.js';
import { createModalAction } from '@vcmap/ui';
import { name } from '../../package.json';
import RenameDialog from './renameDialog.vue';
import {
  createExportSelectedAction,
  createImportAction,
} from '../util/actionHelper.js';

/**
 * @typedef {Object} SimpleDrawingItem
 * @property {string} id
 * @property {string} name
 * @property {import("ol").Feature} feature
 */

/**
 * @enum {number}
 * @type {{SHAPE: number, TEXT: number, NONE: number, OBJECT: number}}
 */
export const CategoryType = {
  NONE: 0,
  SHAPE: 1,
  TEXT: 2,
  OBJECT: 3,
};

const categoryTitle = {
  [CategoryType.SHAPE]: 'drawing.category.shape',
  [CategoryType.TEXT]: 'drawing.category.text',
  [CategoryType.OBJECT]: 'drawing.category.object',
};

/**
 * @param {import("ol").Feature} feature
 * @param {CategoryType} categoryType
 * @returns {boolean}
 */
function isFeatureOfType(feature, categoryType) {
  const geometryType = feature.getGeometry()?.getType?.();
  if (!geometryType) {
    return false;
  }

  if (geometryType === GeometryType.Point) {
    if (feature.get('olcs_modelUrl') || feature.get('olcs_primitiveOptions')) {
      return CategoryType.OBJECT === categoryType;
    }
    if (feature.getStyle()?.getText()?.getText?.()) {
      return CategoryType.TEXT === categoryType;
    }
  }
  return CategoryType.SHAPE === categoryType;
}

/**
 * @param {import("ol").Feature} feature
 * @param {import("@vcmap/core").VectorLayer} layer
 */
function setTitleOnFeature(feature, layer) {
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
      .filter((f) => f.getGeometry().getType() === typeName)
      .map((f) => f.get('title')),
  );

  do {
    count += 1;
    if (!sameTypeFeaturesNames.has(`${typeName}-${count}`)) {
      featureName = `${typeName}-${count}`;
    }
  } while (!featureName);

  feature.set('title', featureName);
}

/**
 * @class
 * @extends {Category<SimpleDrawingItem>}
 */
class SimpleEditorCategory extends Category {
  static get className() {
    return 'SimpleEditorCategory';
  }

  constructor(options) {
    super(options);
    /**
     * @type {import("@vcmap/core").VectorLayer}
     * @private
     */
    this._layer = null;
    this._categoryType = options.categoryType;
    this._layerListeners = () => {};
    this._setCurrentLayer(options.layer);
  }

  /**
   * @param {import("@vcmap/core").VectorLayer} layer
   */
  _setCurrentLayer(layer) {
    this._layerListeners();
    this._layer = layer;
    const source = layer.getSource();

    // In case the collection already has layers
    [...this.collection].forEach((item) => {
      if (!this._layer.getFeatureById(item.name)) {
        this._itemAdded(item);
      }
    });

    const sourceListeners = [
      source.on('removefeature', ({ feature }) => {
        const item = this.collection.getByKey(feature.getId());
        if (item) {
          this.collection.remove(item);
        }
      }),
      source.on('addfeature', ({ feature }) => {
        if (
          isFeatureOfType(feature, this._categoryType) &&
          !this.collection.hasKey(feature.getId())
        ) {
          setTitleOnFeature(feature, layer);
          this.collection.add({
            name: feature.getId(),
            feature,
          });
        }
      }),
    ];

    this._layerListeners = () => {
      unByKey(sourceListeners);
    };
  }

  mergeOptions(options) {
    super.mergeOptions(options);
    this._setCurrentLayer(options.layer);
  }

  _itemAdded(item) {
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

  _itemRemoved(item) {
    if (this._layer.getFeatureById(item.name)) {
      this._layer.removeFeaturesById([item.name]);
    }
  }

  // eslint-disable-next-line class-methods-use-this
  async _deserializeItem(item) {
    const { features } = parseGeoJSON(item.feature);
    if (features[0]) {
      // XXX do we warn on feature collection?
      item.feature = features[0];
    }
    return item;
  }

  // eslint-disable-next-line class-methods-use-this
  _serializeItem(item) {
    return {
      name: item.name,
      feature: writeGeoJSONFeature(item.feature),
    };
  }
}

export default SimpleEditorCategory;

/**
 * @param {import("@vcmap/ui").VcsUiApp} vcsApp
 * @param {import("../editorManager").EditorManager} manager
 * @param {SimpleDrawingItem} featureItem
 * @param {Category<SimpleDrawingItem>} c
 * @param {VcsListItem} categoryListItem
 */
function itemMappingFunction(
  vcsApp,
  manager,
  featureItem,
  c,
  categoryListItem,
) {
  const featureId = featureItem.feature.getId();
  categoryListItem.title = featureItem.feature.get('title') ?? 'Object';
  const layer = manager.getDefaultLayer();

  let hidden = layer.featureVisibility.hiddenObjects[featureItem.name];

  const hideAction = {
    name: 'hideAction',
    icon: hidden ? 'mdi-eye-off' : 'mdi-eye',
    callback() {
      if (!hidden) {
        layer.featureVisibility.hideObjects([featureItem.name]);
        hidden = true;
        this.icon = 'mdi-eye-off';
        if (manager.currentFeatures.value.includes(featureItem.feature)) {
          const newSelection = manager.currentFeatures.value.filter(
            (feature) => feature.getId() !== featureItem.feature.getId(),
          );
          manager.currentSession.value.setCurrentFeatures(newSelection);
        }
      } else {
        layer.featureVisibility.showObjects([featureItem.name]);
        hidden = false;
        this.icon = 'mdi-eye';
      }
    },
  };

  const hideListener = layer.featureVisibility.changed.addEventListener(
    (event) => {
      if (
        (event.action === FeatureVisibilityAction.HIDE ||
          event.action === FeatureVisibilityAction.SHOW) &&
        event.ids.some((id) => id === categoryListItem.name)
      ) {
        hidden = !!layer.featureVisibility.hiddenObjects[categoryListItem.name];
        hideAction.icon = hidden ? 'mdi-eye-off' : 'mdi-eye';
      }
    },
  );

  categoryListItem.selectionChanged = (selected) => {
    if (selected && hidden) {
      hideAction.callback();
    }
  };

  const { action: modalAction, destroy } = createModalAction(
    { name: 'drawing.category.rename' },
    {
      component: RenameDialog,
      provides: {
        setName(newName) {
          featureItem.feature.set('title', newName);
        },
        item: categoryListItem,
      },
    },
    vcsApp,
    name,
  );
  categoryListItem.actions = [
    hideAction,
    {
      name: 'drawing.category.zoomTo',
      async callback() {
        const extent = featureItem.feature.getGeometry()?.getExtent?.();
        if (extent && !isEmpty(extent)) {
          const vp = Viewpoint.createViewpointFromExtent(
            new Extent({
              coordinates: extent,
              projection: mercatorProjection.toJSON(),
            }),
          );
          vp.animate = true;
          await vcsApp.maps.activeMap?.gotoViewpoint(vp);
        }
      },
    },
    modalAction,
    {
      name: 'drawing.category.edit',
      callback() {
        if (hidden) {
          hideAction.callback();
        }
        if (manager.currentLayer.value !== layer) {
          manager.currentLayer.value = layer;
        }
        manager.startEditSession(featureItem.feature);
      },
    },
    {
      name: 'drawing.category.remove',
      callback() {
        if (manager.currentFeatures.value.includes(featureItem.feature)) {
          const newFeatures = manager.currentFeatures.value.filter(
            (feature) => feature.getId() !== featureId,
          );
          manager.currentFeatures.value = newFeatures;
        }
        layer.removeFeaturesById([featureId]);
      },
    },
  ];

  categoryListItem.destroy = () => {
    destroy();
    hideListener();
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").CollectionComponent} categoryUiItem
 * @param {import("@vcmap/core").VectorLayer} layer
 * @returns {(function(): void)}
 */
function syncSelection(manager, categoryUiItem, layer) {
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
      if (manager.currentSession.value?.type !== SessionType.SELECT) {
        manager.startSelectSession();
      }
      manager.currentSession.value.setCurrentFeatures(
        layer.getFeaturesById(selection.value.map((i) => i.name)),
      );
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
 * @param {import("../editorManager").EditorManager} manager
 * @param {VcsUiApp} vcsApp
 * @param {CategoryType} categoryType
 * @returns {function():void}
 */
async function createCategory(manager, vcsApp, categoryType) {
  const layer = manager.getDefaultLayer();
  let someHidden = !!Object.keys(layer.featureVisibility.hiddenObjects).length;

  const hideAllAction = {
    name: 'hide-all',
    title: someHidden ? 'drawing.category.showAll' : 'drawing.category.hideAll',
    icon: someHidden ? 'mdi-eye-off' : 'mdi-eye',
    callback() {
      if (!someHidden && layer.getFeatures()?.length) {
        layer.featureVisibility.hideObjects(
          layer.getFeatures().map((feature) => feature.getId()),
        );
        if (manager.currentFeatures.value) {
          manager.currentSession.value.clearSelection?.();
        }
        this.icon = 'mdi-eye-off';
        this.title = 'drawing.category.showAll';
      } else {
        layer.featureVisibility.clearHiddenObjects();
        this.icon = 'mdi-eye';
        this.title = 'drawing.category.hideAll';
      }
    },
  };

  const hideListener = layer.featureVisibility.changed.addEventListener(
    (event) => {
      if (
        event.action === FeatureVisibilityAction.HIDE ||
        event.action === FeatureVisibilityAction.SHOW
      ) {
        someHidden = !!Object.keys(layer.featureVisibility.hiddenObjects)
          .length;
        hideAllAction.icon = someHidden ? 'mdi-eye-off' : 'mdi-eye';
        hideAllAction.title = someHidden
          ? 'drawing.category.showAll'
          : 'drawing.category.hideAll';
      }
    },
  );

  const { action: exportAction, destroy: destroyExportAction } =
    createExportSelectedAction(
      manager,
      'drawing-category-exportSelected',
      true,
      true,
    );

  const { collectionComponent: categoryUiItem, category } =
    await vcsApp.categoryManager.requestCategory(
      {
        type: SimpleEditorCategory.className,
        name: `Simple Drawing - ${categoryType}`,
        title: categoryTitle[categoryType],
        categoryType,
        layer,
        featureProperty: 'feature',
      },
      name,
      {
        selectable: true,
        overflowCount: 3,
      },
    );

  vcsApp.categoryManager.addActions(
    [
      {
        name: 'drawing.category.selectAll',
        callback() {
          if (manager.currentLayer.value !== layer) {
            manager.currentLayer.value = layer;
          }
          if (!manager.currentSession.value?.type !== SessionType.SELECT) {
            manager.startSelectSession();
          }
          manager.currentSession.value.setCurrentFeatures(
            [...category.collection].map((i) => i.feature),
          );
        },
      },
      createImportAction(vcsApp, manager, 'drawing-category-import'),
      exportAction,
      {
        name: 'drawing.category.removeSelected',
        callback() {
          if (
            manager.currentLayer.value === layer &&
            manager.currentFeatures.value?.length > 0 &&
            manager.currentSession.value?.currentFeatures?.length
          ) {
            const ids = manager.currentFeatures.value.map((f) => f.getId());
            manager.currentSession.value.clearSelection();
            manager.currentLayer.value.removeFeaturesById(ids);
          }
        },
      },
      hideAllAction,
    ],
    name,
    [categoryUiItem.id],
  );

  vcsApp.categoryManager.addMappingFunction(
    () => {
      return true;
    },
    itemMappingFunction.bind(null, vcsApp, manager),
    name,
    [category.name],
  );

  const selectionWatchers = syncSelection(manager, categoryUiItem, layer);
  return () => {
    selectionWatchers();
    hideListener();
    vcsApp.categoryManager.removeOwner(name);
    destroyExportAction();
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {Promise<function():void>}
 */
export async function setupSimpleCategories(manager, app) {
  const listeners = await Promise.all(
    // [CategoryType.SHAPE, CategoryType.TEXT, CategoryType.OBJECT].map((c) =>
    [CategoryType.SHAPE].map((c) => createCategory(manager, app, c)),
  );

  return () => {
    listeners.forEach((cb) => cb());
  };
}
