import { GeometryType, TransformationMode, moduleIdSymbol } from '@vcmap/core';
import { version, name } from '../package.json';
import {
  addToolButtons,
  createSimpleEditorManager,
  setupFeaturePropertyWindow,
  addContextMenu,
} from './editorManager.js';
import SimpleEditorCategory, {
  setupSimpleCategories,
} from './category/simpleCategory.js';
import LayerEditorCategory, {
  setupLayerCategory,
} from './category/layerCategory.js';

export default function drawingPlugin() {
  return {
    get name() {
      return name;
    },
    get version() {
      return version;
    },
    _destroy: () => {},
    async initialize(vcsUiApp) {
      this._editorManager = createSimpleEditorManager(vcsUiApp);
      const destroyButtons = addToolButtons(this._editorManager, vcsUiApp);
      const { destroy: destroyFeaturePropertyWindow, toggleWindow } =
        setupFeaturePropertyWindow(this._editorManager, vcsUiApp);
      this.toggleWindow = toggleWindow;
      vcsUiApp.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        SimpleEditorCategory.className,
        SimpleEditorCategory,
      );
      vcsUiApp.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        LayerEditorCategory.className,
        LayerEditorCategory,
      );
      const destroySimpleCategory = await setupSimpleCategories(
        this._editorManager,
        vcsUiApp,
      );
      const destroyLayerCategory = await setupLayerCategory(
        this._editorManager,
        vcsUiApp,
      );
      const destroyContextMenuEntries = addContextMenu(
        vcsUiApp,
        this._editorManager,
        this.name,
      );
      this._destroy = () => {
        destroyButtons();
        destroyFeaturePropertyWindow();
        destroySimpleCategory();
        destroyLayerCategory();
        destroyContextMenuEntries();
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
            edit: 'Edit Geometry',
            header: 'Geometry',
            info1: 'For editing the vertices of the geometry click the',
            info2: 'icon in the header above',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Translate Features',
            [TransformationMode.ROTATE]: 'Rotate Features',
            [TransformationMode.SCALE]: 'Scale Features',
            [TransformationMode.EXTRUDE]: 'Extrude Features',
            header: 'Transform',
            info: 'For transforming the selected feature(s), click on one of the icons in the header above.',
            apply: 'Apply',
            cw: 'Rotate 90° clockwise',
            ccw: 'Rotate 90° counter clockwise',
            angle: 'Angle',
          },
          select: 'Select features',
          category: {
            shape: 'Shapes',
            text: 'Texts',
            object: '3D Objects',
            layer: 'Layers',
            selectAll: 'Select All',
            removeSelected: 'Remove Selected',
            zoomTo: 'Zoom to',
            rename: 'Rename',
            edit: 'Edit',
            remove: 'Remove',
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
            altitudeMode: 'Altitude Mode',
            groundLevel: 'Ground level',
            absolute: 'Absolute',
            classificationType: 'Classification',
            none: 'None',
            both: 'Both',
            cesium3DTile: '3D Tiles',
            terrain: 'Terrain',
          },
          contextMenu: {
            editProperties: 'Edit Properties',
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
            removeSelected: 'Selektierte löschen',
            zoomTo: 'Hin zoomen',
            rename: 'Umbenennen',
            edit: 'Editieren',
            remove: 'Entfernen',
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
