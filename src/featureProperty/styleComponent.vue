<template>
  <div class="d-flex">
    <component
      class="ma-2"
      v-for="id in styleComponents"
      :key="id"
      :is="id"
      :style-options="styleOptions"
      @update="updateStyle"
    />
  </div>
</template>

<script>
  import { GeometryType, originalStyle, parseColor } from '@vcmap/core';
  import { Fill, RegularShape, Stroke, Style } from 'ol/style.js';
  import { inject, onUnmounted, ref, watch, provide } from 'vue';
  import FillComponent from './fillComponent.vue';
  import StrokeComponent from './strokeComponent.vue';

  /**
   * @typedef {Object} StrokeOptions
   * @property {number} width
   * @property {string} color
   */

  /**
   * @typedef {Object} StyleOptions
   * @property {string|null|false} [fill]
   * @property {StrokeOptions|null|false} [stroke]
   */

  const styleComponentId = {
    NONE: '',
    STROKE: 'StrokeComponent',
    FILL: 'FillComponent',
    MODEL: 'ModelComponent',
    PRIMITIVE: 'PrimitiveComponent',
    ICON: 'IconComponent',
    REGULAR_SHAPE: 'RegularShapeComponent',
  };

  /**
   * @param {import("ol").Feature} feature
   * @param {import("@vcmap/core").VectorProperties} vectorProperties
   * @param {import("ol/style").Style} style
   * @returns {Array<styleComponentId>}
   */
  function getStyleComponentsForFeature(feature, vectorProperties, style) {
    const type = feature.getGeometry()?.getType?.();
    const components = [];

    if (type === GeometryType.Point) {
      if (vectorProperties.getExtrudedHeight(feature)) {
        components.push(styleComponentId.STROKE);
      }

      if (vectorProperties.getModelUrl(feature)) {
        components.push(styleComponentId.MODEL);
      } else if (vectorProperties.getPrimitiveOptions(feature)) {
        components.push(styleComponentId.PRIMITIVE);
      } else {
        let usedStyle = feature[originalStyle] ?? feature.getStyle() ?? style;
        if (typeof usedStyle === 'function') {
          usedStyle = usedStyle(feature);
        }
        if (usedStyle.getImage() instanceof RegularShape) {
          components.push(styleComponentId.REGULAR_SHAPE);
        }
      }
    } else if (type === GeometryType.LineString) {
      if (vectorProperties.getExtrudedHeight(feature)) {
        components.push(styleComponentId.FILL);
      }
      components.push(styleComponentId.STROKE);
    } else if (type === GeometryType.Polygon || type === GeometryType.Circle) {
      components.push(styleComponentId.STROKE, styleComponentId.FILL);
    }

    return components;
  }

  /**
   * @param {Array<import("ol").Feature>} features
   * @param {import("@vcmap/core").VectorLayer} layer
   * @returns {Array<styleComponentId>}
   */
  function getComponentsForFeatures(features, layer) {
    const components = features
      .map(feature => getStyleComponentsForFeature(feature, layer.vectorProperties, layer.style.style))
      .filter(c => c.length > 0);

    if (components.length === 0) {
      return [];
    }

    return Object.values(styleComponentId)
      .filter(id => components.every(c => c.length === 0 || c.includes(id)));
  }

  /**
   * @param {import("ol/color").Color} c1
   * @param {import("ol/color").Color}  c2
   * @returns {boolean}
   */
  function olColorEqual(c1, c2) {
    return c1[0] === c2[0] &&
      c1[1] === c2[1] &&
      c1[2] === c2[2] &&
      c1[3] === c2[3];
  }

  /**
   * @param {Array<import("ol/style").Style>} styles
   * @param {styleComponentId} componentId
   * @param {StyleOptions} styleOptions
   */
  function setStyleOptions(styles, componentId, styleOptions) {
    if (componentId === styleComponentId.FILL) {
      styleOptions.fill = styles.reduce((prev, style) => {
        if (prev === null) {
          return null;
        }
        const currentColor = style.getFill()?.getColor();
        if (!currentColor) {
          return null;
        }
        const parsedColor = parseColor(currentColor);
        if (prev === undefined) {
          return parsedColor;
        }
        return olColorEqual(parsedColor, prev) ? parsedColor : null;
      }, undefined);
    } else if (componentId === styleComponentId.STROKE) {
      styleOptions.stroke = styles.reduce((prev, style) => {
        if (prev === null) {
          return null;
        }
        const currentColor = style.getStroke()?.getColor();
        if (!currentColor) {
          return null;
        }
        const parsedColor = parseColor(currentColor);
        if (prev && !olColorEqual(parsedColor, prev.color)) {
          return null;
        }
        const width = style.getStroke().getWidth();
        if (prev && prev.width !== width) {
          return null;
        }

        return {
          color: parsedColor,
          width,
        };
      }, undefined);
    }
  }

  /**
   * @param {Array<import("ol").Feature>} features
   * @param {StyleOptions} styleOptions
   */
  function setStyleFromStyleOptions(features, styleOptions) {
    features.forEach((f) => {
      const style = f.getStyle() ?? new Style();
      if (styleOptions.fill !== undefined) {
        if (styleOptions.fill === false) {
          style.setFill(null);
        } else if (styleOptions.fill) {
          const fill = style.getFill() ?? new Fill();
          fill.setColor(styleOptions.fill);
          style.setFill(fill);
        }
      }

      if (styleOptions.stroke !== undefined) {
        if (styleOptions.stroke === false) {
          style.setStroke(null);
        } else if (styleOptions.stroke) {
          const stroke = style.getStroke() ?? new Stroke();
          stroke.setColor(styleOptions.stroke.color);
          stroke.setWidth(styleOptions.stroke.width);
          style.setStroke(stroke);
        }
      }

      f.setStyle(style);
    });
  }

  export default {
    name: 'StyleComponent',
    components: {
      FillComponent,
      StrokeComponent,
    },
    setup() {
      /** @type {EditorManager} */
      const manager = inject('manager');

      const styleComponents = ref([]);
      const styleOptions = ref({
        fill: undefined,
        stroke: undefined,
      });

      provide('styleOptions', styleOptions);
      const setComponents = () => {
        styleOptions.value = {
          fill: undefined,
          stroke: undefined,
        };
        if (manager.currentFeatures.value.length > 0 && manager.currentLayer.value) {
          styleComponents.value = getComponentsForFeatures(manager.currentFeatures.value, manager.currentLayer.value);
          if (styleComponents.value.length > 0) {
            const styles = manager.currentFeatures.value.map(f => f.getStyle() ??
              manager.currentLayer.value.style.style.clone());
            styleComponents.value.forEach((componentId) => {
              setStyleOptions(styles, componentId, styleOptions.value);
            });
          }
        } else {
          styleComponents.value = [];
        }
      };

      let layerListeners = () => {};
      const setupLayer = () => {
        layerListeners();
        if (manager.currentLayer.value) {
          const vectorPropertiesListener = manager.currentLayer.value.vectorProperties
            .propertyChanged.addEventListener(setComponents);
          const styleListener = manager.currentLayer.value.styleChanged.addEventListener(setComponents);
          setComponents();
          layerListeners = () => {
            vectorPropertiesListener();
            styleListener();
          };
        }
      };
      const featuresWatcher = watch(manager.currentFeatures, setComponents);
      const layerWatcher = watch(manager.currentLayer, setupLayer);
      setupLayer();

      onUnmounted(() => {
        featuresWatcher();
        layerWatcher();
        layerListeners();
      });

      return {
        styleComponents,
        styleOptions,
        updateStyle() {
          setStyleFromStyleOptions(manager.currentFeatures.value, styleOptions.value);
        },
      };
    },
  };
</script>

<style scoped>

</style>
