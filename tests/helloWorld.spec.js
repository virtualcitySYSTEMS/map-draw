import { vi, describe, it, expect, beforeAll } from 'vitest';
import { VcsUiApp } from '@vcmap/ui';
import { Context, VectorLayer, OpenlayersMap } from '@vcmap/core';
import { helloWorld } from '../src/index.js';

describe('HelloWorld', () => {
  describe('helloWorld', () => {
    it('should return hello World', () => {
      const val = helloWorld();
      expect(val).to.equal('hello World!');
    });
  });

  describe('addContext', () => {
    let context;
    /** @type {VcsUiApp} */
    let app;
    let added;

    beforeAll(async () => {
      context = new Context({
        layers: [
          new VectorLayer({ name: 'foo', activeOnStartup: true }).toJSON(),
        ],
        maps: [
          new OpenlayersMap({ name: 'foo' }).toJSON(),
        ],
        startingViewPointName: 'foo',
        startingMapName: 'foo',
      });
      app = new VcsUiApp();
      added = vi.fn();
      app.contextAdded.addEventListener(added);
      await app.addContext(context);
    });

    it('should add the context', () => {
      expect(app.getContextById(context.id)).to.equal(context);
    });

    it('should raise the contextAdded event', () => {
      expect(added).toHaveBeenCalledTimes(1);
    });

    it('should add layers which are active on startup', () => {
      const layer = app.layers.getByKey('foo');
      expect(layer).to.be.an.instanceOf(VectorLayer);
      expect(layer.active || layer.loading).to.be.true;
    });
  });
});
