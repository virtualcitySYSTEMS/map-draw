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
import {
  createListExportAction,
  createListImportAction,
  makeEditorCollectionComponentClass,
} from '@vcmap/ui';
import { Feature } from 'ol';
import { unByKey } from 'ol/Observable.js';
import { watch } from 'vue';
import { isEmpty } from 'ol/extent.js';
import { name } from '../../package.json';
import { exportFeatures, importFeatures } from '../util/actionHelper.js';
import { getDrawEditor } from '../util/windowHelper.js';

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

  feature.set('title', featureName, true);
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
          if (!feature.get('title')) {
            setTitleOnFeature(feature, layer);
          }
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
  categoryListItem.title = featureItem.feature.get('title') ?? 'Object';
  const layer = manager.getDefaultLayer();

  let hidden = layer.featureVisibility.hiddenObjects[featureItem.name];

  const hideAction = {
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
          manager.currentSession.value.setCurrentFeatures(newSelection);
        }
      } else {
        layer.featureVisibility.showObjects([featureItem.name]);
        hidden = false;
        this.icon = '$vcsCheckboxChecked';
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
        hideAction.icon = hidden ? '$vcsCheckbox' : '$vcsCheckboxChecked';
      }
    },
  );

  categoryListItem.selectionChanged = (selected) => {
    if (selected && hidden) {
      hideAction.callback();
    }
  };

  categoryListItem.titleChanged = (newTitle) => {
    featureItem.feature.set('title', newTitle);
    categoryListItem.title = newTitle;
  };

  categoryListItem.actions.push(
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
  );

  categoryListItem.destroy = () => {
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
      if (
        manager.currentSession.value?.type !== SessionType.SELECT &&
        selection.value.length
      ) {
        manager.startSelectSession();
      }
      manager.currentSession.value?.setCurrentFeatures(
        layer.getFeaturesById(selection.value.map((i) => i.name)),
      );
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
 * @enum {string}
 */
const VisibilityState = {
  ALL: 'all',
  NONE: 'none',
  SOME: 'some',
};

/**
 * @enum {string}
 */
const VisibilityStateIcon = {
  [VisibilityState.ALL]: '$vcsCheckboxChecked',
  [VisibilityState.NONE]: '$vcsCheckbox',
  [VisibilityState.SOME]: '$vcsCheckboxIndeterminate',
};

/**
 * Calculates the visibility state of a layer based on its features.
 * @param {Layer} layer - The layer to calculate the visibility state for.
 * @returns {VisibilityState} The visibility state of the layer.
 */
function getVisibilityState(layer) {
  const { hiddenObjects } = layer.featureVisibility;
  const features = layer.getFeatures();
  const visibleFeatures = features.filter(
    (feature) => !hiddenObjects[feature.getId()],
  );
  if (visibleFeatures.length === features.length) {
    return VisibilityState.ALL;
  }
  if (visibleFeatures.length === 0) {
    return VisibilityState.NONE;
  }
  return VisibilityState.SOME;
}

/**
 * @param {import("../editorManager").EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} vcsApp
 * @returns {Promise<{destroy: function():void, editSelection: function():void}>}
 */
export async function createCategory(manager, vcsApp) {
  const layer = manager.getDefaultLayer();
  let visibilityState = getVisibilityState(layer);

  const hideAllAction = {
    name: 'hide-all',
    title:
      visibilityState === VisibilityState.ALL
        ? 'drawing.category.hideAll'
        : 'drawing.category.showAll',
    icon: VisibilityStateIcon[visibilityState],
    callback() {
      if (
        visibilityState === VisibilityState.ALL &&
        layer.getFeatures()?.length
      ) {
        layer.featureVisibility.hideObjects(
          layer.getFeatures().map((feature) => feature.getId()),
        );
        if (manager.currentFeatures.value) {
          manager.currentSession.value.clearSelection?.();
        }
        this.icon = '$vcsCheckbox';
        this.title = 'drawing.category.showAll';
      } else {
        layer.featureVisibility.clearHiddenObjects();
        this.icon = '$vcsCheckboxChecked';
        this.title = 'drawing.category.hideAll';
      }
    },
  };

  function updateHideAllAction() {
    visibilityState = getVisibilityState(layer);
    hideAllAction.icon = VisibilityStateIcon[visibilityState];
    hideAllAction.title =
      visibilityState === VisibilityState.ALL
        ? 'drawing.category.hideAll'
        : 'drawing.category.showAll';
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
    () => {
      unByKey(hideAllEventsKeys);
    },
  ];

  const { collectionComponent: categoryUiItem, category } =
    await vcsApp.categoryManager.requestCategory(
      {
        type: SimpleEditorCategory.className,
        name: `Simple Drawing - shape`,
        title: 'drawing.category.shape',
        categoryType: CategoryType.SHAPE,
        layer,
        featureProperty: 'feature',
      },
      name,
      {
        selectable: true,
        renamable: true,
        removable: true,
        overflowCount: 3,
      },
    );

  const drawEditor = getDrawEditor(manager, vcsApp);

  makeEditorCollectionComponentClass(vcsApp, categoryUiItem, {
    editor: drawEditor,
    multiEditor: drawEditor,
  });

  const { action: importAction, destroy: destroyImportAction } =
    createListImportAction(
      (files) => importFeatures(manager, files),
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
    () => {
      return true;
    },
    itemMappingFunction.bind(null, vcsApp, manager),
    name,
    [category.name],
  );

  category.collection.removed.addEventListener((item) => {
    if (manager.currentFeatures.value.includes(item.feature)) {
      const newFeatures = manager.currentFeatures.value.filter(
        (feature) => feature.getId() !== item.feature.getId(),
      );
      manager.currentFeatures.value = newFeatures;
    }
  });

  const selectionWatchers = syncSelection(manager, categoryUiItem, layer);
  return {
    destroy: () => {
      selectionWatchers();
      hideAllActionListeners.forEach((cb) => cb());
      vcsApp.categoryManager.removeOwner(name);
      destroyExportAction();
      destroyImportAction();
    },
    editSelection: () => {
      if (categoryUiItem.selection.value.length === 1) {
        categoryUiItem.openEditorWindow();
      } else if (categoryUiItem.selection.value.length > 1) {
        categoryUiItem.openMultiEditorWindow();
      }
    },
  };
}
