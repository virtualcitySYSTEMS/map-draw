<template>
  <div class="pa-2" v-if="center">
    <CoordinateInput
      v-model="center"
    />
    <VcsTextField
      v-model.number="radius"
      label="Radius"
      dense
    />
  </div>
</template>

<script>
  import { computed, inject, onUnmounted, ref, watch } from 'vue';
  import { VcsTextField } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import CoordinateInput from './coordinateInput.vue';

  export default {
    name: 'CircleGeometryComponent',
    components: {
      VcsTextField,
      CoordinateInput,
    },
    setup() {
      const features = inject('features');
      const radiusRef = ref(null);
      const center = ref(null);
      let featureListener = () => {};

      const setupFeature = (feature) => {
        featureListener();
        if (feature) {
          const geometry = feature.getGeometry();
          radiusRef.value = geometry.getRadius();
          center.value = geometry.getCenter();

          const changedListener = geometry.on('change', () => {
            radiusRef.value = geometry.getRadius();
            center.value = geometry.getCenter();
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
        radius: computed({
          get() { return radiusRef.value; },
          set(radius) {
            if (Number.isFinite(radius)) {
              features.value[0].getGeometry().setRadius(radius);
            }
          },
        }),
        center: computed({
          get() { return center.value; },
          set(newCenter) {
            features.value[0].getGeometry().setCenter(newCenter);
          },
        }),
      };
    },
  };
</script>

<style scoped>

</style>
