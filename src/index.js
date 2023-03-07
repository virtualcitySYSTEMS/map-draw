import { GeometryType, TransformationMode, contextIdSymbol } from '@vcmap/core';
import { version, name } from '../package.json';
import { addToolButtons, createSimpleEditorManager, setupFeaturePropertyWindow } from './editorManager.js';
import SimpleEditorCategory, { setupSimpleCategories } from './category/simpleCategory.js';
import LayerEditorCategory, { setupLayerCategory } from './category/layerCategory.js';

export default function drawingPlugin() {
  return {
    get name() { return name; },
    get version() { return version; },
    _destroy: () => {},
    async initialize(vcsUiApp) {
      this._editorManager = createSimpleEditorManager(vcsUiApp);
      const destroyButtons = addToolButtons(this._editorManager, vcsUiApp);
      const destroyFeaturePropertyWindow = setupFeaturePropertyWindow(this._editorManager, vcsUiApp);
      vcsUiApp.categoryClassRegistry
        .registerClass(this[contextIdSymbol], SimpleEditorCategory.className, SimpleEditorCategory);
      vcsUiApp.categoryClassRegistry
        .registerClass(this[contextIdSymbol], LayerEditorCategory.className, LayerEditorCategory);
      const destroySimpleCategory = await setupSimpleCategories(this._editorManager, vcsUiApp);
      const destroyLayerCategory = await setupLayerCategory(this._editorManager, vcsUiApp);
      this._destroy = () => {
        destroyButtons();
        destroyFeaturePropertyWindow();
        destroySimpleCategory();
        destroyLayerCategory();
      };
    },
    i18n: {
      en: {
        drawing: {
          create: {
            [GeometryType.Point]: 'Draw Points',
            [GeometryType.Polygon]: 'Draw Polygons',
            [GeometryType.LineString]: 'Draw Lines',
            [GeometryType.BBox]: 'Draw Boxes',
            [GeometryType.Circle]: 'Draw Circles',
          },
          geometry: {
            [GeometryType.Point]: 'Point',
            [GeometryType.Polygon]: 'Polygon',
            [GeometryType.LineString]: 'Line',
            [GeometryType.BBox]: 'Box',
            [GeometryType.Circle]: 'Circle',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Translate Features',
            [TransformationMode.ROTATE]: 'Rotate Features',
            [TransformationMode.SCALE]: 'Scale Features',
            [TransformationMode.EXTRUDE]: 'Extrude Features',
          },
          category: {
            shape: 'Shapes',
            text: 'Texts',
            object: '3D Objects',
            layer: 'Layers',
          },
        },
      },
      de: {},
    },
    destroy() {
      if (this._editorManager) {
        this._editorManager.destroy();
        this._destroy();
      }
    },
  };
}
