<template>
  <div v-if="center" class="px-1">
    <CoordinateInput v-model="center" :wgs84="isWgs84" />
    <VcsTextField
      id="drawing-radius-input"
      type="number"
      unit="m"
      prepend-icon="mdi-radius-outline"
      v-model.number="radius"
      @change="handleRadiusInput()"
    />
    <VcsSelect
      v-model="isWgs84"
      :items="[
        { value: true, text: 'EPSG: 4326' },
        { value: false, text: 'EPSG: 3857' },
      ]"
    />
  </div>
</template>

<script>
  import { computed, inject, onUnmounted, ref, watch } from 'vue';
  import { VcsTextField, VcsSelect } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import CoordinateInput from './coordinateInput.vue';

  export default {
    name: 'CircleGeometryComponent',
    components: {
      VcsTextField,
      VcsSelect,
      CoordinateInput,
    },
    setup() {
      const features = inject('features');
      const radius = ref();
      const center = ref();
      let featureListener = () => {};

      function setupFeature(feature) {
        featureListener();
        if (feature) {
          const geometry = feature.getGeometry();
          radius.value = geometry.getRadius();
          center.value = geometry.getCenter();

          const changedListener = geometry.on('change', () => {
            radius.value = geometry.getRadius();
            center.value = geometry.getCenter();
          });

          featureListener = () => {
            unByKey(changedListener);
          };
        }
      }

      const watcher = watch(features, () => {
        setupFeature(features.value[0]);
      });
      setupFeature(features.value[0]);

      onUnmounted(() => {
        featureListener();
        watcher();
      });

      return {
        center: computed({
          get() {
            return center.value;
          },
          set(newCenter) {
            features.value[0].getGeometry().setCenter(newCenter);
          },
        }),
        handleRadiusInput() {
          if (Number.isFinite(radius.value)) {
            features.value[0].getGeometry().setRadius(radius.value);
          }
        },
        radius,
        isWgs84: ref(false),
      };
    },
  };
</script>

<style scoped>
  #drawing-radius-input {
    width: 37%;
    left: 63%;
    position: relative;
  }
</style>
