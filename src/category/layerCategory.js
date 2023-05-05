import {
  Category,
  // mercatorProjection,
  // VectorLayer,
  writeGeoJSON,
} from '@vcmap/core';
import { createModalAction } from '@vcmap/ui';
import { name } from '../../package.json';
import RenameDialog from './renameDialog.vue';
// import ImportDialog from './importDialog.vue';
import { downloadText } from '../util/downloadHelper.js';

/**
 * @extends {Category<import("@vcmap/core").VectorLayer>}
 */
class LayerEditorCategory extends Category {
  static get className() {
    return 'LayerEditorCategory';
  }

  _itemAdded(layer) {
    if (!this._app.layers.hasKey(layer.name)) {
      this._app.layers.add(layer);
    }
  }

  _itemRemoved(layer) {
    this._app.layers.remove(layer);
  }
}

export default LayerEditorCategory;

/**
 * @param {VcsUiApp} vcsApp
 * @param {EditorManager} manager
 * @param {VectorLayer} layer
 * @param {Category<VectorLayer>} category
 * @param {VcsListItem} categoryListItem
 */
function itemMappingFunction(
  vcsApp,
  manager,
  layer,
  category,
  categoryListItem,
) {
  categoryListItem.title = layer.properties.title ?? 'Unnamed Layer';

  let hidden = !(layer.active || layer.loading);

  const hideAction = {
    name: 'hideAction',
    icon: hidden ? 'mdi-eye-off' : 'mdi-eye',
    callback() {
      if (!hidden) {
        layer.deactivate();
        hidden = true;
        this.icon = 'mdi-eye-off';
      } else {
        layer.activate();
        hidden = false;
        this.icon = 'mdi-eye';
      }
    },
  };

  categoryListItem.selectionChanged = (selected) => {
    if (selected && hidden) {
      hideAction.callback();
    }

    if (selected) {
      manager.currentLayer.value = layer;
    } else {
      manager.currentLayer.value = null;
    }
  };

  const { action: modalAction, destroy } = createModalAction(
    { name: 'Rename' },
    {
      component: RenameDialog,
      provides: {
        setName(newName) {
          layer.properties.title = newName;
        },
        item: categoryListItem,
      },
    },
    vcsApp.windowManager,
    name,
  );
  categoryListItem.actions = [
    hideAction,
    // {
    //   name: 'Zoom To',
    //   async callback() {
    //     const extent = featureItem.feature.getGeometry()?.getExtent?.();
    //     if (extent && !isEmpty(extent)) {
    //       const vp = Viewpoint
    //         .createViewpointFromExtent(new Extent({ coordinates: extent, projection: mercatorProjection.toJSON() }));
    //       vp.animate = true;
    //       await vcsApp.maps.activeMap?.gotoViewpoint(vp);
    //     }
    //   },
    // },
    modalAction,
    {
      name: 'Download',
      async callback() {
        // let features;
        // if (exports === 'selected') { // TODO only export selected?
        //   if (editor.features.size) {
        //     features = new Array(editor.features.size);
        //     let i = 0;
        //     editor.features.forEach((feat) => {
        //       features[i] = feat;
        //       i += 1;
        //     });
        //   } else {
        //     this.notifyInfo(this.$t('i18n_drawing_nothingSelected'));
        //     return;
        //   }
        // } else {
        const features = layer.getFeatures();
        const writeOptions = {
          writeStyle: true,
          embedIcons: true,
          prettyPrint: true,
          writeId: true,
        };

        const text = writeGeoJSON(
          {
            features,
            vcsMeta: layer.getVcsMeta(writeOptions),
          },
          writeOptions,
        );
        downloadText(text, `${categoryListItem.title}.geojson`);
      },
    },
    {
      name: 'Remove',
      callback() {
        category.collection.remove(layer);
      },
    },
  ];

  categoryListItem.destroy = destroy;
}

/**
 * @param {EditorManager} manager
 * @param {VcsUiApp} vcsApp
 * @returns {Promise<function():void>}
 */
export async function setupLayerCategory(manager, vcsApp) {
  // const category = await vcsApp.categories.requestCategory({
  //   type: LayerEditorCategory.className,
  //   name: 'LayerEditorCategory',
  //   title: 'drawing.category.layer',
  // });

  // vcsApp.categoryManager.add(
  //   {
  //     categoryName: 'LayerEditorCategory',
  //     selectable: true,
  //     singleSelect: true,
  //     actions: [
  //       {
  //         name: 'Add',
  //         icon: 'mdi-plus',
  //         callback() {
  //           const layer = new VectorLayer({
  //             properties: { title: 'Drawing Layer' },
  //             projection: mercatorProjection.toJSON(),
  //           });
  //           layer.activate();
  //           category.collection.add(layer);
  //         },
  //       },
  //       {
  //         name: 'Import',
  //         callback() {
  //           vcsApp.windowManager.add(
  //             {
  //               component: ImportDialog,
  //               state: {
  //                 hideHeader: true,
  //               },
  //               provides: {
  //                 category,
  //               },
  //             },
  //             name,
  //           );
  //         },
  //       },
  //     ],
  //   },
  //   name,
  // );

  vcsApp.categoryManager.addMappingFunction(
    () => true,
    itemMappingFunction.bind(null, vcsApp, manager),
    ['LayerEditorCategory'],
    name,
  );
  return () => {};
}
