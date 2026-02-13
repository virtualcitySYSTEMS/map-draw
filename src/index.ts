import { GeometryType, TransformationMode, moduleIdSymbol } from '@vcmap/core';
import type { PluginConfigEditor, VcsPlugin, VcsUiApp } from '@vcmap/ui';
import { version, name, mapVersion } from '../package.json';
import type { EditorManager } from './editorManager.js';
import { createSimpleEditorManager } from './editorManager.js';
import { addToolButtons } from './util/toolbox.js';
import { setupKeyListeners } from './util/keyListeners.js';
import addContextMenu from './util/context.js';
import SimpleEditorCategory, {
  createCategory,
} from './category/simpleCategory.js';
import { setupDrawWindow } from './util/windowHelper.js';
import type { DrawConfig } from './defaultOptions.js';
import getDefaultOptions from './defaultOptions.js';
import ConfigEditor from './ConfigEditor.vue';

export type DrawPlugin = VcsPlugin<
  Partial<DrawConfig>,
  Record<never, never>
> & {
  readonly config: Required<DrawConfig>;
};

export default function drawingPlugin(options: DrawConfig): DrawPlugin {
  let destroyFunction: () => void;
  let editorManager: EditorManager | undefined;
  const config: Required<DrawConfig> = {
    ...getDefaultOptions(),
    ...structuredClone(options),
  };

  return {
    get name(): string {
      return name;
    },
    get version(): string {
      return version;
    },
    get mapVersion(): string {
      return mapVersion;
    },
    get config(): Required<DrawConfig> {
      return structuredClone(config);
    },
    async initialize(vcsUiApp: VcsUiApp): Promise<void> {
      editorManager = createSimpleEditorManager(vcsUiApp);
      const destroyButtons = addToolButtons(editorManager, vcsUiApp);
      const destroyDrawWindow = setupDrawWindow(editorManager, vcsUiApp);
      const destroyKeyListeners = setupKeyListeners(editorManager);
      vcsUiApp.categoryClassRegistry.registerClass(
        this[moduleIdSymbol],
        SimpleEditorCategory.className,
        SimpleEditorCategory,
      );
      const { destroy: destroySimpleCategory, editSelection } =
        await createCategory(editorManager, vcsUiApp);
      const destroyContextMenu = addContextMenu(
        vcsUiApp,
        editorManager,
        this.name,
        editSelection,
      );
      destroyFunction = (): void => {
        destroyButtons();
        destroyDrawWindow();
        destroySimpleCategory();
        destroyKeyListeners();
        destroyContextMenu();
      };
    },
    getDefaultOptions,
    toJSON(): DrawConfig {
      const defaultOptions = getDefaultOptions();
      const serializedConfig: DrawConfig = {};
      if (
        config.altitudeModes.length !== defaultOptions.altitudeModes.length ||
        config.altitudeModes.some(
          (e) => !defaultOptions.altitudeModes.includes(e),
        )
      ) {
        serializedConfig.altitudeModes = config.altitudeModes.slice();
      }
      return serializedConfig;
    },
    getConfigEditors(): PluginConfigEditor<object>[] {
      return [
        {
          component: ConfigEditor,
          title: 'draw.config.title',
        },
      ];
    },
    i18n: {
      en: {
        draw: {
          create: {
            [GeometryType.Point]: 'Draw points',
            [GeometryType.Polygon]: 'Draw polygons',
            [GeometryType.LineString]: 'Draw lines',
            [GeometryType.BBox]: 'Draw bounding box',
            [GeometryType.Circle]: 'Draw circles',
          },
          geometry: {
            edit: 'Edit geometry',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Translate features',
            [TransformationMode.ROTATE]: 'Rotate features',
            [TransformationMode.SCALE]: 'Scale features',
            [TransformationMode.EXTRUDE]: 'Extrude features',
          },
          select: 'Select drawn objects',
          category: {
            shape: 'Shapes',
            hideAll: 'Hide all',
            showAll: 'Show all',
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
        draw: {
          create: {
            [GeometryType.Point]: 'Punkte zeichnen',
            [GeometryType.Polygon]: 'Polygone zeichnen',
            [GeometryType.LineString]: 'Linien zeichnen',
            [GeometryType.BBox]: 'Bounding Box zeichnen',
            [GeometryType.Circle]: 'Kreise zeichnen',
          },
          geometry: {
            edit: 'Geometrie editieren',
          },
          transform: {
            [TransformationMode.TRANSLATE]: 'Objekt verschieben',
            [TransformationMode.ROTATE]: 'Objekt rotieren',
            [TransformationMode.SCALE]: 'Objekt skalieren',
            [TransformationMode.EXTRUDE]: 'Objekt extrudieren',
          },
          select: 'Gezeichnete Objekte auswählen',
          category: {
            shape: 'Formen',
            hideAll: 'Alle ausblenden',
            showAll: 'Alle einblenden',
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
    destroy(): void {
      if (editorManager) {
        editorManager.destroy();
      }
      destroyFunction();
    },
  };
}
