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
  import {
    GeometryType,
    highlighted,
    originalStyle,
    parseColor,
  } from '@vcmap/core';
  import { Circle, Fill, Icon, RegularShape, Stroke, Style } from 'ol/style.js';
  import { inject, onUnmounted, ref, watch, provide } from 'vue';
  import FillComponent from './fillComponent.vue';
  import StrokeComponent from './strokeComponent.vue';
  import ImageComponent from './imageComponent.vue';

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
    IMAGE: 'ImageComponent',
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
        let usedStyle;
        // XXX else clause only needed when there is a possibility that style component is shown for a feature that is not highlighted (which is currently the case for oblique). Same for other if (feature[highlighted]).
        if (feature[highlighted]) {
          // not using f.getStyle because this would return the highlighted style (since its already highlighted).
          usedStyle = feature[originalStyle] ?? style;
        } else {
          usedStyle = feature.getStyle() ?? style;
        }
        if (typeof usedStyle === 'function') {
          usedStyle = usedStyle(feature);
        }
        if (usedStyle.getImage()) {
          if (usedStyle.getImage() instanceof RegularShape) {
            components.push(
              styleComponentId.IMAGE,
              styleComponentId.FILL,
              styleComponentId.STROKE,
            );
          } else {
            components.push(styleComponentId.IMAGE);
          }
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
      .map((feature) =>
        getStyleComponentsForFeature(
          feature,
          layer.vectorProperties,
          layer.style.style.clone(),
        ),
      )
      .filter((c) => c.length > 0);

    if (components.length === 0) {
      return [];
    }

    return (
      Object.values(styleComponentId)
        // only add those style components, that are shared by all features
        .filter((id) =>
          components.every((c) => c.length === 0 || c.includes(id)),
        )
    );
  }

  /**
   * @param {import("ol/color").Color} c1
   * @param {import("ol/color").Color}  c2
   * @returns {boolean}
   */
  function olColorEqual(c1, c2) {
    return (
      c1[0] === c2[0] && c1[1] === c2[1] && c1[2] === c2[2] && c1[3] === c2[3]
    );
  }

  function regularShapeGeometryEqual(shape1, shape2) {
    return JSON.stringify(shape1) === JSON.stringify(shape2);
  }

  /**
   * @param {Array<import("ol/style").StyleLike>} styles - Style for each feature
   * @param {styleComponentId} componentId
   * @param {StyleOptions} styleOptions
   */
  function setStyleOptions(styles, componentId, styleOptions) {
    if (componentId === styleComponentId.FILL) {
      // checks if there is a fill style and that all fill styles are equal. Otherwise return null.
      styleOptions.fill = styles.reduce((prev, style) => {
        if (prev === null) {
          return null;
        }
        const currentColor = style?.getFill()?.getColor();
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
      // checks if there is a stroke style and that all stoke styles are equal. Otherwise return null.
      styleOptions.stroke = styles.reduce((prev, style) => {
        if (prev === null) {
          return null;
        }
        const currentColor = style?.getStroke()?.getColor();
        if (!currentColor) {
          return null;
        }
        const parsedColor = parseColor(currentColor);
        if (prev && !olColorEqual(parsedColor, prev.color)) {
          return null;
        }
        const width = style?.getStroke().getWidth();
        if (prev && prev.width !== width) {
          return null;
        }

        return {
          color: parsedColor,
          width,
        };
      }, undefined);
    } else if (componentId === styleComponentId.IMAGE) {
      styleOptions.image = styles.reduce((prev, style) => {
        if (prev === null) {
          return null;
        }
        const isRegularShape = style instanceof RegularShape; // TODO: Might be too expensive. How can this be replaced?

        let current;
        if (isRegularShape) {
          current = {
            radius: style.getRadius(),
            radius2: style.getRadius2(),
            angle: style.getAngle(),
            points: style.getPoints(),
          };
          if (prev && !regularShapeGeometryEqual(prev, current)) {
            return null;
          }
        } else {
          current = style.src;
          if (!current) {
            return null;
          }

          if (prev && current !== prev) {
            return null;
          }
        }
        return current;
      }, undefined);
    }
  }

  /**
   * @param {Array<import("ol").Feature>} features
   * @param {StyleOptions} styleOptions
   */
  function setStyleFromStyleOptions(features, styleOptions) {
    features.forEach((f) => {
      const isPoint = f.getGeometry().getType() === GeometryType.Point;
      /** @type {import("ol/style").Style} */
      const featureStyle = f[highlighted] ? f[originalStyle] : f.getStyle();
      const style = featureStyle ?? new Style();
      if (isPoint && typeof styleOptions.image === 'string') {
        const icon = new Icon({ src: styleOptions.image });
        style.setImage(icon);
      } else {
        /**
         * Style where fill and stroke should be applied.
         * @type {import("ol/style").Style | import("ol/style").RegularShape | import("ol/style").Circle }
         */
        let styleToApplyColor = style;
        if (isPoint && styleOptions.image) {
          if (styleOptions.image?.points) {
            styleToApplyColor = new RegularShape({
              ...styleOptions.image,
            });
          } else {
            styleToApplyColor = new Circle({
              radius: styleOptions.image.radius,
            });
          }
          style.setImage(styleToApplyColor);
        }
        if (styleOptions.fill !== undefined) {
          if (styleOptions.fill === false) {
            styleToApplyColor.setFill(null);
          } else if (styleOptions.fill) {
            const fill = styleToApplyColor.getFill() ?? new Fill();
            fill.setColor(styleOptions.fill);
            styleToApplyColor.setFill(fill);
          }
        }

        if (styleOptions.stroke !== undefined) {
          if (styleOptions.stroke === false) {
            styleToApplyColor.setStroke(null);
          } else if (styleOptions.stroke) {
            const stroke = styleToApplyColor.getStroke() ?? new Stroke();
            stroke.setColor(styleOptions.stroke.color);
            stroke.setWidth(styleOptions.stroke.width);
            styleToApplyColor.setStroke(stroke);
          }
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
      ImageComponent,
    },
    setup() {
      /** @type {EditorManager} */
      const manager = inject('manager');

      const styleComponents = ref([]);
      const styleOptions = ref({
        fill: undefined,
        stroke: undefined,
        image: undefined,
      });

      provide('styleOptions', {
        styleOptions,
        setFill(fill) {
          styleOptions.value.fill = fill;
        },
        setStroke(stroke) {
          styleOptions.value.stroke = stroke;
        },
      });
      const setComponents = () => {
        styleOptions.value = {
          fill: undefined,
          stroke: undefined,
          image: undefined,
        };
        if (
          manager.currentFeatures.value.length > 0 &&
          manager.currentLayer.value
        ) {
          styleComponents.value = getComponentsForFeatures(
            manager.currentFeatures.value,
            manager.currentLayer.value,
          );
          if (styleComponents.value.length > 0) {
            const styles = manager.currentFeatures.value.map((feature) => {
              const layerStyle = manager.currentLayer.value.style.style.clone();
              let featureStyle;
              // not using f.getStyle because this would return the highlighted style (since its already highlighted).
              if (feature[highlighted]) {
                featureStyle = feature[originalStyle] ?? layerStyle;
              } else {
                featureStyle = feature.getStyle() ?? layerStyle;
              }
              // By returning only the regular shape itself, fill and color handling can be same as for normal geometries.
              // TODO: Might have to be changed when more style componentids are added
              return feature.getGeometry().getType() === GeometryType.Point
                ? featureStyle.getImage()
                : featureStyle;
            });
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
          const vectorPropertiesListener =
            manager.currentLayer.value.vectorProperties.propertyChanged.addEventListener(
              setComponents,
            );
          const styleListener =
            manager.currentLayer.value.styleChanged.addEventListener(
              setComponents,
            );
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
        /**
         * Updates styleOptions with new style from one of the styleComponents and then sets the style on the (selected) feature.
         * @param {{key: string, value: any}} update An Object with a key "key", that contains the key that should be updated, and a key "value" with the value to the key that should be updated.
         */
        updateStyle(update) {
          if (update.value) {
            styleOptions.value[update.key] = update.value;
          } else {
            // if value is undefined a reset to layer style is perfomed
            let layerStyle = manager.currentLayer.value.style.style;
            const isPoint =
              manager.currentFeatures.value[0]?.getGeometry().getType() ===
              GeometryType.Point;
            layerStyle = isPoint ? layerStyle.getImage() : layerStyle;
            setStyleOptions(
              [layerStyle],
              styleComponentId[update.key.toUpperCase()],
              styleOptions.value,
            );
          }
          setStyleFromStyleOptions(
            manager.currentFeatures.value,
            styleOptions.value,
          );
        },
      };
    },
  };
</script>

<style scoped></style>
