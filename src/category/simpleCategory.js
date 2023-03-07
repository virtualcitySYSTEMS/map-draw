import {
  Category,
  writeGeoJSONFeature,
  parseGeoJSON,
  GeometryType,
  TransformationMode,
  Viewpoint,
  mercatorProjection,
  Extent,
  SessionType,
} from '@vcmap/core';
import { unByKey } from 'ol/Observable.js';
import { shallowRef, watch } from 'vue';
import { isEmpty } from 'ol/extent.js';
import { createModalAction, WindowSlot } from '@vcmap/ui';
import { name } from '../../package.json';
import AttributeWindow, { defaultAttributeTablePosition } from './attributeTable.vue';
import RenameDialog from './renameDialog.vue';

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
 */
function setTitleOnFeature(feature) {
  const geometry = feature.getGeometry();
  let typeName = 'Unknown';
  if (geometry) {
    typeName = geometry.get('_vcsGeomType') ?? geometry.getType();
  }

  feature.set('title', `drawing.geometry.${typeName}`);
}

/**
 * @class
 * @extends {Category<SimpleDrawingItem>}
 */
class SimpleEditorCategory extends Category {
  static get className() { return 'SimpleEditorCategory'; }

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

    const sourceListeners = [
      source.on('removefeature', ({ feature }) => {
        const item = this.collection.getByKey(feature.getId());
        if (item) {
          this.collection.remove(item);
        }
      }),
      source.on('addfeature', ({ feature }) => {
        if (isFeatureOfType(feature, this._categoryType) && !this.collection.hasKey(feature.getId())) {
          setTitleOnFeature(feature);
          this.collection.add({
            name: feature.getId(),
            feature,
          });
        }
      }),
      // XXX remove and add feature again...
      // source.on('changefeature', (feature) => {
      //   const item = this.collection.get(feature.getId());
      //   const isFeature = isFeatureOfType(feature, this._categoryType);
      //   if (item && !isFeature) {
      //     this.collection.remove(item);
      //   } else if (isFeature && !item) {
      //     this.collection.add({
      //       name: feature.getId(),
      //       feature,
      //     });
      //   }
      //   if (item.title !== feature.get('title')) {
      //     item.title = feature.get('title');
      //   }
      // }),
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
    if (!this._layer.getFeatureById(item.name)) {
      this._layer.addFeatures(item.feature);
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
    if (features[0]) { // XXX do we warn on feature collection?
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
 * @param {EditorManager} manager
 * @param {SimpleDrawingItem} featureItem
 * @param {Category<SimpleDrawingItem>} c
 * @param {VcsListItem} categoryListItem
 */
function itemMappingFunction(vcsApp, manager, featureItem, c, categoryListItem) {
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
          manager.currentSession.value.featureSelection?.clear?.(); // TODO maybe not clear?
        }
      } else {
        layer.featureVisibility.showObjects([featureItem.name]);
        hidden = false;
        this.icon = 'mdi-eye';
      }
    },
  };

  categoryListItem.selectionChanged = (selected) => {
    if (selected && hidden) {
      hideAction.callback();
    }
  };

  const { action: modalAction, destroy } = createModalAction(
    { name: 'Rename' },
    {
      component: RenameDialog,
      provides: {
        setName(newName){
          featureItem.feature.set('title', newName, true);
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
      name: 'Zoom To',
      async callback() {
        const extent = featureItem.feature.getGeometry()?.getExtent?.();
        if (extent && !isEmpty(extent)) {
          const vp = Viewpoint
            .createViewpointFromExtent(new Extent({ coordinates: extent, projection: mercatorProjection.toJSON() }));
          vp.animate = true;
          await vcsApp.maps.activeMap?.gotoViewpoint(vp);
        }
      },
    },
    modalAction,
    {
      name: 'Edit',
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
      name: 'Remove',
      callback() {
        layer.removeFeaturesById([featureId]);
      },
    },
  ];

  categoryListItem.destroy = destroy;
}

/**
 * @param {EditorManager} manager
 * @param {ManagedCategory} categoryUiItem
 * @param {import("@vcmap/core").VectorLayer} layer
 * @returns {(function(): void)}
 */
function syncSelection(manager, categoryUiItem, layer) {
  let selectionRevision = 0;
  let featureRevision = 0;

  const selectionWatcher = watch(() => categoryUiItem.selection, () => {
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
      if (!manager.currentSession.value?.type !== SessionType.EDIT_FEATURES) { // TODO dont change edit geometry?
        manager.startTransformSession(TransformationMode.SELECT);
      }

      manager.currentSession.value.featureSelection
        .setSelectionSet(layer.getFeaturesById(selection.map(i => i.id)));
    }
  });
  const featureWatcher = watch(manager.currentFeatures, () => {
    if (featureRevision < selectionRevision) {
      featureRevision = selectionRevision;
      return;
    }
    if (featureRevision === selectionRevision) {
      featureRevision += 1;
      categoryUiItem.selection = categoryUiItem.items
        .filter(i => manager.currentFeatures.value.find(f => f.getId() === i.id)); // XXX perfomance?
    }
  });
  return () => {
    selectionWatcher();
    featureWatcher();
  };
}

/**
 * @param {EditorManager} manager
 * @param {VcsUiApp} vcsApp
 * @param {CategoryType} categoryType
 * @returns {function():void}
 */
async function createCategory(manager, vcsApp, categoryType) {
  const layer = manager.getDefaultLayer();
  const category = await vcsApp.categories.requestCategory({
    type: SimpleEditorCategory.className,
    name: `Simple Drawing - ${categoryType}`,
    title: categoryTitle[categoryType],
    categoryType,
    layer,
  });

  const attributeWindowId = 'simpleDrawingAttributeWindowId';
  const features = shallowRef([...category.collection].map(i => i.feature));
  const listeners = [
    category.collection.added.addEventListener(() => {
      features.value = [...category.collection].map(i => i.feature);
    }),
    category.collection.removed.addEventListener(() => {
      features.value = [...category.collection].map(i => i.feature);
    }),
  ];

  const categoryUiItem = vcsApp.categoryManager.add(
    {
      categoryName: category.name,
      selectable: true,
      actions: [
        {
          name: 'Select All',
          callback() {
            if (manager.currentLayer.value !== layer) {
              manager.currentLayer.value = layer;
            }
            if (!manager.currentSession.value?.type !== SessionType.EDIT_FEATURES) {
              manager.startTransformSession(TransformationMode.SELECT);
            }
            manager.currentSession.value.featureSelection.setSelectionSet([...category.collection].map(i => i.feature));
          },
        },
        {
          name: 'Remove Selected',
          callback() {
            if (
              manager.currentLayer.value === layer &&
              manager.currentFeatures.value?.length > 0 &&
              manager.currentSession.value?.featureSelection
            ) {
              const ids = manager.currentFeatures.value.map(f => f.getId());
              manager.currentSession.value.featureSelection.clear();
              manager.currentLayer.value.removeFeaturesById(ids);
            }
          },
        },
        {
          name: 'Show Attributes',
          callback() {
            if (!vcsApp.windowManager.has(attributeWindowId)) {
              vcsApp.windowManager.add({
                position: defaultAttributeTablePosition,
                provides: {
                  features,
                  itemSelected({ item, value }) {
                    if (manager.currentLayer.value !== layer) {
                      manager.currentLayer.value = layer;
                    }
                    if (!manager.currentSession.value?.type !== SessionType.EDIT_FEATURES) {
                      manager.startTransformSession(TransformationMode.SELECT);
                    }
                    /**
                     * @type {import("@vcmap/core").SelectMultiFeatureInteraction}
                     */
                    const { featureSelection } = manager.currentSession.value;
                    if (value) {
                      if (!featureSelection.hasFeatureId(item.id)) {
                        const feature = manager.currentLayer.value.getFeatureById(item.id);
                        const { selectedFeatures } = featureSelection;
                        selectedFeatures.push(feature);
                        featureSelection.setSelectionSet(selectedFeatures);
                      }
                    } else if (featureSelection.hasFeatureId((item.id))) {
                      const { selectedFeatures } = featureSelection;
                      featureSelection.setSelectionSet(selectedFeatures.filter(f => f.getId() !== item.id));
                    }
                  },
                },
                component: AttributeWindow,
                slot: WindowSlot.DETACHED,
                state: {
                  id: attributeWindowId,
                  headerTitle: category.name,
                },
              }, name);
            }
          },
        },
      ],
    },
    name,
  );

  vcsApp.categoryManager.addMappingFunction(
    () => {
      return true;
    },
    itemMappingFunction.bind(null, vcsApp, manager),
    [category.name],
    name,
  );

  const selectionWatchers = syncSelection(manager, categoryUiItem, layer);
  return () => {
    listeners.forEach((cb) => { cb(); });
    selectionWatchers();
  };
}

/**
 * @param {EditorManager} manager
 * @param {import("@vcmap/ui").VcsUiApp} app
 * @returns {function():void}
 */
export async function setupSimpleCategories(manager, app) {
  const listeners = await Promise.all([
    CategoryType.SHAPE,
    CategoryType.TEXT,
    CategoryType.OBJECT,
  ].map(c => createCategory(manager, app, c)));

  return () => {
    listeners.forEach(cb => cb());
  }
}

