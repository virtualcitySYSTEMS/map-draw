import { GeometryType, TransformationMode, moduleIdSymbol } from '@vcmap/core';
import { version, name, mapVersion } from '../package.json';
import { createSimpleEditorManager } from './editorManager.js';
import { addToolButtons } from './util/toolbox.js';
import { setupKeyListeners } from './util/keyListeners.js';
import addContextMenu from './util/context.js';
import SimpleEditorCategory, {
  createCategory,
} from './category/simpleCategory.js';
import { setupDrawWindow } from './util/windowHelper.js';
import getDefaultOptions from './defaultOptions.js';
import ConfigEditor from './ConfigEditor.vue';

export default function drawingPlugin(moduleConfig) {
  /** @type {DrawConfig} */
  const config = { ...structuredClone(moduleConfig), ...getDefaultOptions() };

  return {
    get name() {
      return name;
    },
    get version() {
      return version;
    },
    get mapVersion() {
      return mapVersion;
    },
    get config() {
      return config;
    },
    getDefaultOptions,
    toJSON() {
      return {};
    },
    getConfigEditors() {
      return [
        {
          title: 'drawing.config.title',
          component: ConfigEditor,
        },
      ];
    },
    _destroy: () => {},
    async initialize(vcsUiApp) {
      this._editorManager = createSimpleEditorManager(vcsUiApp);
      const destroyButtons = addToolButtons(this._editorManager, vcsUiApp);
      const destroyDrawWindow = setupDrawWindow(this._editorManager, vcsUiApp);
      const destroyKeyListeners = setupKeyListeners(this._editorManager);
      vcsUiApp.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        SimpleEditorCategory.className,
        SimpleEditorCategory,
      );
      const { destroy: destroySimpleCategory, editSelection } =
        await createCategory(this._editorManager, vcsUiApp);
      const destoryContextMenu = addContextMenu(
        vcsUiApp,
        this._editorManager,
        this.name,
        editSelection,
      );
      this._destroy = () => {
        destroyButtons();
        destroyDrawWindow();
        destroySimpleCategory();
        destroyKeyListeners();
        destoryContextMenu();
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
            edit: 'Edit geometry',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Translate features',
            [TransformationMode.ROTATE]: 'Rotate features',
            [TransformationMode.SCALE]: 'Scale features',
            [TransformationMode.EXTRUDE]: 'Extrude features',
          },
          select: 'Select features',
          category: {
            shape: 'Shapes',
            hideAll: 'Hide all',
            showAll: 'Show all',
            removeSelected: 'Remove selection',
            zoomTo: 'Zoom to',
            edit: 'Edit geometry',
          },
          contextMenu: {
            editProperties: 'Edit properties',
            removeSelection: 'Remove selection',
            exportSelection: 'Export selection',
          },
          config: {
            title: 'Draw configuration',
            altitudeModes: 'Altitude modes',
          },
        },
      },
      de: {
        drawing: {
          create: {
            [GeometryType.Point]: 'Punkte zeichnen',
            [GeometryType.Polygon]: 'Polygone zeichnen',
            [GeometryType.LineString]: 'Linien zeichnen',
            [GeometryType.BBox]: 'Bounding Box zeichnen',
            [GeometryType.Circle]: 'Kreise zeichnen',
          },
          geometry: {
            [GeometryType.Point]: 'Punkt',
            [GeometryType.Polygon]: 'Polygon',
            [GeometryType.LineString]: 'Linie',
            [GeometryType.BBox]: 'Bounding Box',
            [GeometryType.Circle]: 'Kreis',
            edit: 'Geometrie editieren',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Objekt verschieben',
            [TransformationMode.ROTATE]: 'Objekt rotieren',
            [TransformationMode.SCALE]: 'Objekt skalieren',
            [TransformationMode.EXTRUDE]: 'Objekt extrudieren',
          },
          select: 'Objekte selektieren',
          category: {
            shape: 'Formen',
            hideAll: 'Alle ausblenden',
            showAll: 'Alle einblenden',
            removeSelected: 'Selektierte Feature löschen',
            zoomTo: 'Hin zoomen',
            edit: 'Geometrie editieren',
          },
          contextMenu: {
            editProperties: 'Eigenschaften editieren',
            removeSelection: 'Selektion entfernen',
            exportSelection: 'Selektion exportieren',
          },
          config: {
            title: 'Zeichentooleinstellungen',
            altitudeModes: 'Höhenmodi',
          },
        },
      },
    },
    destroy() {
      if (this._editorManager) {
        this._editorManager.destroy();
        this._destroy();
      }
    },
  };
}
