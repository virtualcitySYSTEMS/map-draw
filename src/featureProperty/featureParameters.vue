<template>
  <v-container class="pa-2">
    <v-row dense no-gutters align="center" v-if="showExtrusion">
      <v-col> Extrusion </v-col>
      <v-col>
        <VcsTextField
          dense
          v-model.number="extrusion"
          placeholder="0 m"
          type="number"
          unit="m"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import { VContainer, VRow, VCol } from 'vuetify/lib';
  import { computed, inject, onUnmounted, ref, watch } from 'vue';
  import { VcsTextField } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import { CesiumMap } from '@vcmap/core';

  export default {
    name: 'FeatureParameters',
    components: {
      VRow,
      VContainer,
      VCol,
      VcsTextField,
    },
    setup() {
      const features = inject('features', ref([]));
      const vcsApp = inject('vcsApp');
      const showExtrusion = ref(false);
      const setupMap = () => {
        showExtrusion.value = vcsApp.maps.activeMap instanceof CesiumMap;
      };
      const mapActivatedListener =
        vcsApp.maps.mapActivated.addEventListener(setupMap);
      setupMap();

      const extrusionRef = ref(null);
      let featureListeners = [];
      const setupSingleFeature = () => {
        const feature = features.value[0];
        featureListeners = [
          feature.on('propertychange', ({ key }) => {
            if (key === 'olcs_extrudedHeight') {
              extrusionRef.value = feature.get(key);
            }
          }),
        ];
        extrusionRef.value = feature.get('olcs_extrudedHeight');
      };

      watch(
        features,
        () => {
          unByKey(featureListeners);
          if (features.value.length === 1) {
            setupSingleFeature();
          } else {
            extrusionRef.value = features.value.reduce((height, f) => {
              if (height === null) {
                return null;
              }
              const currentHeight = f.get('olcs_extrudedHeight');
              if (!currentHeight) {
                return null;
              }
              if (height === undefined) {
                return currentHeight;
              }
              return height === currentHeight ? height : null;
            }, undefined);
          }
        },
        { immediate: true },
      );

      onUnmounted(() => {
        mapActivatedListener();
        unByKey(featureListeners);
      });

      return {
        showExtrusion,
        extrusion: computed({
          get() {
            return extrusionRef.value;
          },
          set(value) {
            if (extrusionRef.value !== value && Number.isFinite(value)) {
              extrusionRef.value = value;
              features.value.forEach((f) => {
                // ensureFeatureAbsolute(f); XXX todo
                f.set('olcs_extrudedHeight', value);
              });
            }
          },
        }),
      };
    },
  };
</script>

<style scoped></style>
