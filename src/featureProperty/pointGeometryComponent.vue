<template>
  <div class="pa-2" v-if="coordinate">
    <CoordinateInput
      v-model="coordinate"
    />
  </div>
</template>

<script>
  import { computed, inject, onUnmounted, ref, watch } from 'vue';
  import { unByKey } from 'ol/Observable.js';
  import CoordinateInput from './coordinateInput.vue';

  export default {
    name: 'PointGeometryComponent',
    components: {
      CoordinateInput,
    },
    setup() {
      const features = inject('features');
      const coordinate = ref(null);
      let featureListener = () => {};

      const setupFeature = (feature) => {
        featureListener();
        if (feature) {
          const geometry = feature.getGeometry();
          coordinate.value = geometry.getCoordinates();

          const changedListener = geometry.on('change', () => {
            coordinate.value = geometry.getCoordinates();
          });

          featureListener = () => {
            unByKey(changedListener);
          };
        }
      };

      const watcher = watch(features, () => {
        setupFeature(features.value[0]);
      });
      setupFeature(features.value[0]);

      onUnmounted(() => {
        featureListener();
        watcher();
      });

      return {
        coordinate: computed({
          get() { return coordinate.value; },
          set(newCoordinates) {
            features.value[0].getGeometry().setCoordinates(newCoordinates);
          },
        }),
      };
    },
  };
</script>

<style scoped>

</style>
