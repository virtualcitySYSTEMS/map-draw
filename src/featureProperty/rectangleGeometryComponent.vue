<template>
  <v-container class="px-1 py-0">
    <v-row no-gutters>
      <v-col>
        <CoordinateInput v-model="firstPoint" :wgs84="isWgs84" />
      </v-col>
    </v-row>
    <v-row no-gutters>
      <v-col cols="4">
        <VcsTextField
          type="number"
          prefix="W"
          v-model.number="dimensions.width"
          @change="handleDimensionInput('width')"
        />
      </v-col>
      <v-col cols="4">
        <VcsTextField
          type="number"
          prefix="L"
          v-model.number="dimensions.length"
          @change="handleDimensionInput('length')"
        />
      </v-col>
      <v-col cols="4">
        <VcsTextField
          type="number"
          prefix="H"
          v-model.number="dimensions.height"
          @change="handleDimensionInput('height')"
        />
      </v-col>
    </v-row>
    <v-row v-if="!isBbox" no-gutters class="flex-row-reverse">
      <v-col cols="4">
        <VcsTextField
          type="number"
          prepend-icon="$vcsRotateRight"
          :value="angle"
        />
      </v-col>
    </v-row>
    <v-row no-gutters>
      <v-col>
        <VcsSelect
          v-model="isWgs84"
          :items="[
            { value: true, text: 'EPSG: 4326' },
            { value: false, text: 'EPSG: 3857' },
          ]"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import { computed, inject, onUnmounted, ref, watch } from 'vue';
  import { VRow, VCol, VContainer } from 'vuetify/lib';
  import { Projection } from '@vcmap/core';
  import { VcsTextField, VcsSelect } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable';
  import { getDistance as haversineDistance, offset } from 'ol/sphere';
  import CoordinateInput from './coordinateInput.vue';

  function calcBearing(c1, c2) {
    const lon1 = (c1[0] * Math.PI) / 180; // lat, lon in radians
    const lat1 = (c1[1] * Math.PI) / 180;
    const lon2 = (c2[0] * Math.PI) / 180;
    const lat2 = (c2[1] * Math.PI) / 180;

    const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
    const x =
      Math.cos(lat1) * Math.sin(lat2) -
      Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
    return Math.atan2(y, x);
    // return ((θ * 180) / Math.PI + 360) % 360; // in degrees
  }

  export default {
    name: 'RectangleGeometryComponent',
    components: {
      VcsTextField,
      VcsSelect,
      CoordinateInput,
      VRow,
      VCol,
      VContainer,
    },
    props: {
      isBbox: {
        type: Boolean,
        default: false,
      },
    },
    setup() {
      const features = inject('features');
      const firstPoint = ref();
      const dimensions = ref({ width: 0, length: 0, height: 0 });
      const angle = ref();
      let featureListener = () => {};

      /**
       * @param {import("ol/geom").Geometry} geometry The geometry of the rectangle.
       */
      function updateGeometryDisplay(geometry) {
        const polygonGeometry = geometry.getCoordinates()[0];
        firstPoint.value = polygonGeometry[0];
        if (polygonGeometry.length > 1) {
          /** @type {Array<Array<number>>} */
          const wgs84Geometry = polygonGeometry.map((point) => {
            return Projection.mercatorToWgs84(point);
          });
          const width = haversineDistance(wgs84Geometry[0], wgs84Geometry[3]);
          const length = haversineDistance(wgs84Geometry[0], wgs84Geometry[1]);
          const polygonAngle = calcBearing(wgs84Geometry[0], wgs84Geometry[3]); // TODO: Calc angle

          dimensions.value.width = width;
          dimensions.value.length = length;
          angle.value = ((polygonAngle * 180) / Math.PI + 360) % 360;
        }
      }

      /**
       * @param {import("ol").Feature} feature
       */
      function setupFeature(feature) {
        featureListener();
        const geometry = feature?.getGeometry();
        if (geometry) {
          updateGeometryDisplay(geometry, firstPoint, dimensions, angle);
          dimensions.value.height = feature.get('olcs_extrudedHeight') || 0;

          const geometryListener = geometry.on('change', () => {
            updateGeometryDisplay(geometry, firstPoint, dimensions, angle);
          });
          const properyListener = feature.on('propertychange', ({ key }) => {
            if (key === 'olcs_extrudedHeight') {
              dimensions.value.height = feature.get(key);
            }
          });

          featureListener = () => {
            unByKey(geometryListener);
            unByKey(properyListener);
          };
        }
      }

      const featureWatcher = watch(features, () => {
        setupFeature(features.value[0]);
      });
      setupFeature(features.value[0]);

      onUnmounted(() => {
        featureListener();
        featureWatcher();
      });

      return {
        firstPoint: computed({
          get() {
            return firstPoint.value;
          },
          set(newFirstPoint) {
            /** @type {Array<Array<number>>} */
            const oldCoordinates = features.value[0]
              .getGeometry()
              .getCoordinates()[0];
            const offsetMeters = oldCoordinates[0].map(
              (coord, i) => coord - newFirstPoint[i],
            );

            const newCoordinates = oldCoordinates.map((points) => {
              return points.map((coord, i) => coord - offsetMeters[i]);
            });

            features.value[0].getGeometry().setCoordinates([newCoordinates]);
          },
        }),
        dimensions,
        angle,
        isWgs84: ref(false),
        handleDimensionInput(dimension) {
          if (dimension === 'height') {
            features.value[0].set(
              'olcs_extrudedHeight',
              dimensions.value.height,
            );
          } else {
            const polygonGeometry = features.value[0]
              .getGeometry()
              .getCoordinates()[0];
            const height = polygonGeometry[0][2];
            const wgs84Geometry = polygonGeometry.map((point) => {
              return Projection.mercatorToWgs84(point);
            });
            if (dimension === 'width') {
              const bearing = calcBearing(wgs84Geometry[0], wgs84Geometry[3]);
              const newC3 = offset(
                wgs84Geometry[0],
                dimensions.value[dimension],
                bearing,
              );
              polygonGeometry[3] = Projection.wgs84ToMercator(newC3).concat([
                height,
              ]);
              const newC2 = offset(
                wgs84Geometry[1],
                dimensions.value[dimension],
                bearing,
              );
              polygonGeometry[2] = Projection.wgs84ToMercator(newC2).concat([
                height,
              ]);
            } else if (dimension === 'length') {
              const bearing = calcBearing(wgs84Geometry[0], wgs84Geometry[1]);
              const newC1 = offset(
                wgs84Geometry[0],
                dimensions.value[dimension],
                bearing,
              );
              polygonGeometry[1] = Projection.wgs84ToMercator(newC1).concat([
                height,
              ]);
              const newC2 = offset(
                wgs84Geometry[3],
                dimensions.value[dimension],
                bearing,
              );
              polygonGeometry[2] = Projection.wgs84ToMercator(newC2).concat([
                height,
              ]);
            }
            features.value[0].getGeometry().setCoordinates([polygonGeometry]);
          }
        },
      };
    },
  };
</script>
