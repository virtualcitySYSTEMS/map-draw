import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { VcsUiApp, loadPlugin } from '@vcmap/ui';
import plugin from '../src/index.js';
import packageJSON from '../package.json';

function sleep(ms = 0) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

window.VcsPluginLoaderFunction = () => ({
  default: (config, baseUrl) => plugin(config, baseUrl),
});

const testPropSymbol = Symbol('testProp');

describe('VcsPlugin Interface test', () => {
  let pluginInstance;

  beforeAll(async () => {
    pluginInstance = await loadPlugin(packageJSON.name, {
      name: packageJSON.name,
      entry: '_dev',
    });
  });

  afterAll(() => {
    pluginInstance?.destroy?.();
  });

  describe('name, version, mapVersion', () => {
    it('should return the plugin name from the package.json', () => {
      expect(pluginInstance).to.have.property('name', packageJSON.name);
    });
    it('should return the plugin version from the package.json', () => {
      expect(pluginInstance).to.have.property('version', packageJSON.version);
    });
    it('should return the plugin mapVersion from the package.json', () => {
      expect(pluginInstance).to.have.property(
        'mapVersion',
        packageJSON.mapVersion,
      );
    });
  });

  describe('internationalization', () => {
    it('may provide an i18n object and should provide at least en as fallback language', () => {
      if (pluginInstance?.i18n) {
        expect(pluginInstance?.i18n).to.be.a('object').with.property('en');
      }
    });

    // eslint-disable-next-line mocha/no-skipped-tests
    it.skip('should use unscoped plugin name as namespace for plugin specific i18n entries', () => {
      if (pluginInstance?.i18n) {
        expect(pluginInstance.i18n).to.be.a('object');
        const [scope, name] = packageJSON.name.split('/');
        const unscopedName = name || scope;
        const camelCaseName = unscopedName.replace(/-./g, (x) =>
          x[1].toUpperCase(),
        );
        Object.values(pluginInstance.i18n).forEach((locale) => {
          expect(locale).to.have.property(camelCaseName);
        });
      }
    });
  });

  describe('plugin hooks', () => {
    it('may implement initialize', () => {
      if (pluginInstance?.initialize) {
        expect(pluginInstance.initialize).to.be.a('function');
      }
    });
    it('should implement destroy', () => {
      if (pluginInstance?.destroy) {
        expect(pluginInstance.destroy).to.be.a('function');
      }
    });
  });

  describe('options & serialization', () => {
    it('should return default options', () => {
      expect(pluginInstance?.getDefaultOptions?.()).to.be.a('object');
    });

    it('should implement toJSON returning the plugin config', () => {
      expect(pluginInstance?.toJSON?.()).to.be.a('object');
    });

    it('should return changed altitude modes', async () => {
      const otherPluginInstance = await loadPlugin(packageJSON.name, {
        name: packageJSON.name,
        entry: '_dev',
        altitudeModes: ['absolute'],
      });

      const config = otherPluginInstance.toJSON();
      expect(config)
        .to.have.property('altitudeModes')
        .and.to.have.members(['absolute']);
      otherPluginInstance.destroy;
    });

    it('should return changed altitude modes of same length as defualt', async () => {
      const altitudeModesOfSameLengthAsDefault = [
        'clampToGround',
        'clampToTerrain',
        'absolute',
        'relativeToTerrain',
      ];

      const otherPluginInstance = await loadPlugin(packageJSON.name, {
        name: packageJSON.name,
        entry: '_dev',
        altitudeModes: altitudeModesOfSameLengthAsDefault,
      });

      const config = otherPluginInstance.toJSON();
      expect(config)
        .to.have.property('altitudeModes')
        .and.to.have.members(altitudeModesOfSameLengthAsDefault);
      otherPluginInstance.destroy;
    });
  });

  describe('shadowing a plugin', () => {
    let app;
    let pluginInstance2;

    beforeAll(async () => {
      app = new VcsUiApp();
      app.plugins.add(pluginInstance);
      pluginInstance2 = await loadPlugin(packageJSON.name, {
        name: packageJSON.name,
        version: '2.0.0',
        entry: '_dev',
      });
      if (pluginInstance2) {
        pluginInstance2[testPropSymbol] = 'test';
      }
    });

    afterAll(() => {
      pluginInstance2?.destroy?.();
    });

    it('should override the plugin correctly', () => {
      expect(() => app.plugins.override(pluginInstance2)).to.not.throw;
      app.plugins.override(pluginInstance2);
      expect(app.plugins.getByKey(packageJSON.name)).to.have.property(
        testPropSymbol,
        'test',
      );
      expect(app.plugins.getByKey(packageJSON.name)).to.equal(pluginInstance2);
    });

    it('should reincarnate the plugin correctly', async () => {
      expect(() => app.plugins.remove(pluginInstance2)).to.not.throw;
      app.plugins.remove(pluginInstance2);
      await sleep(0);
      expect(app.plugins.getByKey(packageJSON.name)).not.to.have.property(
        testPropSymbol,
        'test',
      );
    });
  });
});
