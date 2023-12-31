import { GeometryType, TransformationMode, moduleIdSymbol } from '@vcmap/core';
import { version, name, mapVersion } from '../package.json';
import { createSimpleEditorManager } from './editorManager.js';
import { addToolButtons } from './util/toolbox.js';
import { setupKeyListeners } from './util/keyListeners.js';
import addContextMenu from './util/context.js';
import SimpleEditorCategory, {
  setupSimpleCategories,
} from './category/simpleCategory.js';
import { setupDrawWindow } from './window/setup.js';

export default function drawingPlugin() {
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
    getDefaultOptions() {
      return {};
    },
    toJSON() {
      return {};
    },
    getConfigEditors() {
      return [];
    },
    _destroy: () => {},
    async initialize(vcsUiApp) {
      this._editorManager = createSimpleEditorManager(vcsUiApp);
      const destroyButtons = addToolButtons(this._editorManager, vcsUiApp);
      const { destroy: destroyDrawWindow, toggleWindow } = setupDrawWindow(
        this._editorManager,
        vcsUiApp,
      );
      const destroyKeyListeners = setupKeyListeners(this._editorManager);
      vcsUiApp.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        SimpleEditorCategory.className,
        SimpleEditorCategory,
      );
      const destroySimpleCategory = await setupSimpleCategories(
        this._editorManager,
        vcsUiApp,
      );
      addContextMenu(vcsUiApp, this._editorManager, this.name, toggleWindow);
      this._destroy = () => {
        destroyButtons();
        destroyDrawWindow();
        destroySimpleCategory();
        destroyKeyListeners();
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
            header: 'Geometry',
            info1: 'For editing the vertices of the geometry click the',
            info2: 'icon in the header above',
            placeOnTerrain: 'Place on terrain',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Translate features',
            [TransformationMode.ROTATE]: 'Rotate features',
            [TransformationMode.SCALE]: 'Scale features',
            [TransformationMode.EXTRUDE]: 'Extrude features',
            header: 'Transform',
            apply: 'Apply',
            cw: 'Rotate 90° clockwise',
            ccw: 'Rotate 90° counter clockwise',
            angle: 'Angle',
          },
          select: 'Select features',
          category: {
            shape: 'Shapes',
            text: 'Texts',
            object: '3D objects',
            layer: 'Layers',
            selectAll: 'Select all',
            hideAll: 'Hide all',
            showAll: 'Show all',
            removeSelected: 'Remove selected features',
            zoomTo: 'Zoom to',
            rename: 'Rename',
            edit: 'Edit',
            remove: 'Remove',
            import: 'Import JSON file',
            exportSelected: 'Export selected features',
            exportAll: 'Export all features',
          },
          modify: {
            header: 'Modify',
            info: 'For modifying the selected feature(s), click on one of the icons in the header above.',
          },
          style: {
            reset: 'Reset',
            close: 'Close',
            lineWidth: 'Line width',
            header: 'Style',
            fill: 'Fill',
            stroke: 'Stroke',
          },
          parameters: {
            header: 'Parameters',
            altitudeMode: 'Altitude mode',
            groundLevel: 'Ground level',
            absolute: 'Absolute',
            classificationType: 'Classification',
            none: 'None',
            both: 'Both',
            cesium3DTile: '3D Tiles',
            terrain: 'Terrain',
          },
          contextMenu: {
            editProperties: 'Edit properties',
            exportSelected: 'Export selected',
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
            header: 'Geometrie',
            info1:
              'Um in der Karte die Eckpunkte der Geomtrie zu bearbeiten, klicken Sie auf den',
            info2: 'Icon in der Überschrift',
            placeOnTerrain: 'Auf Gelände plazieren',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Objekt verschieben',
            [TransformationMode.ROTATE]: 'Objekt rotieren',
            [TransformationMode.SCALE]: 'Objekt skalieren',
            [TransformationMode.EXTRUDE]: 'Objekt extrudieren',
            header: 'Transformieren',
            info: 'Klicken Sie auf einen der Icons in der Überschrift um die selektieren Objekte zu transformieren.',
            apply: 'Anwenden',
            cw: '90° rechtsherum drehen',
            ccw: '90° linksherum drehen',
            angle: 'Winkel',
          },
          select: 'Objekte selektieren',
          category: {
            shape: 'Formen',
            text: 'Texte',
            object: '3D Objekte',
            layer: 'Ebenen',
            selectAll: 'Alle selektieren',
            hideAll: 'Alle ausblenden',
            showAll: 'Alle einblenden',
            removeSelected: 'Selektierte Feature löschen',
            zoomTo: 'Hin zoomen',
            rename: 'Umbenennen',
            edit: 'Editieren',
            remove: 'Entfernen',
            import: 'JSON Datei importieren',
            exportSelected: 'Export selected',
            exportAll: 'Alle Feature exportieren',
          },
          modify: {
            header: 'Editieren',
            info: 'Klicke die Symbole in der Überschrift um die selektierten Geometrien zu editieren.',
          },
          style: {
            reset: 'Zurücksetzen',
            close: 'Schließen',
            lineWidth: 'Linienbreite',
            header: 'Stil',
            fill: 'Füllstil',
            stroke: 'Linienstil',
          },
          parameters: {
            header: 'Parameter',
            altitudeMode: 'Höhenmodus',
            groundLevel: 'Bodenlevel',
            absolute: 'Absolut',
            classificationType: 'Klassifizierung',
            none: 'Keine',
            both: 'Beide',
            cesium3DTile: '3D Tiles',
            terrain: 'Gelände',
          },
          contextMenu: {
            editProperties: 'Eigenschaften editieren',
            exportSelected: 'Selektierte exportieren',
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
