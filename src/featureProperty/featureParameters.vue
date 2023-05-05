<template>
  <v-container class="pa-2">
    <v-row dense no-gutters align="center" v-if="show3dParameters">
      <v-col>
        <VcsLabel html-for="drawing-extrusion" :dense="true">
          Extrusion
        </VcsLabel>
      </v-col>
      <v-col>
        <VcsTextField
          id="drawing-extrusion"
          dense
          :value="parameters.olcs_extrudedHeight"
          @input="(value) => setExtrudedHeight(Number(value))"
          placeholder="0 m"
          type="number"
          unit="m"
        />
      </v-col>
    </v-row>
    <v-row no-gutters v-if="show3dParameters">
      <v-col>
        <VcsLabel html-for="drawing-altitudeMode" :dense="true">
          {{ $t('drawing.parameters.altitudeMode') }}
        </VcsLabel>
      </v-col>
      <v-col>
        <VcsSelect
          id="drawing-altitudeMode"
          :items="[
            { value: 'clambToGround', text: 'drawing.parameters.groundLevel' },
            { value: 'absolute', text: 'drawing.parameters.absolute' },
          ]"
          :value="parameters.olcs_altitudeMode || 'clambToGround'"
          @input="setAltitudeMode"
          dense
        />
      </v-col>
    </v-row>
    <v-row no-gutters v-if="show3dParameters">
      <v-col>
        <VcsLabel html-for="drawing-classification" :dense="true">
          {{ $t('drawing.parameters.classificationType') }}
        </VcsLabel>
      </v-col>
      <v-col>
        <VcsSelect
          id="drawing-classification"
          :items="[
            { value: 'none', text: 'drawing.parameters.none' },
            { value: 'both', text: 'drawing.parameters.both' },
            { value: 'cesium3DTile', text: 'drawing.parameters.cesium3DTile' },
            { value: 'terrain', text: 'drawing.parameters.terrain' },
          ]"
          :value="parameters.olcs_classificationType || 'none'"
          @input="setClassificationType"
          dense
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import { VContainer, VRow, VCol } from 'vuetify/lib';
  import { inject, onUnmounted, ref, watch } from 'vue';
  import { VcsTextField, VcsSelect, VcsLabel } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import { CesiumMap } from '@vcmap/core';

  export default {
    name: 'FeatureParameters',
    components: {
      VRow,
      VContainer,
      VCol,
      VcsTextField,
      VcsSelect,
      VcsLabel,
    },
    setup() {
      const features = inject('features', ref([]));
      const vcsApp = inject('vcsApp');
      const show3dParameters = ref(false);
      const setupMap = () => {
        show3dParameters.value = vcsApp.maps.activeMap instanceof CesiumMap;
      };
      const mapActivatedListener =
        vcsApp.maps.mapActivated.addEventListener(setupMap);
      setupMap();

      const parameters = ref({
        olcs_extrudedHeight: null,
        olcs_altitudeMode: null,
        olcs_classificationType: null,
      });

      let featureListeners = [];
      const setupSingleFeature = () => {
        const feature = features.value[0];
        featureListeners = [
          feature.on('propertychange', ({ key }) => {
            if (Object.keys(parameters.value).includes(key)) {
              parameters.value[key] = feature.get(key);
            }
          }),
        ];
        Object.keys(parameters.value).forEach((key) => {
          parameters.value[key] = feature.get(key);
        });
      };

      watch(
        features,
        () => {
          unByKey(featureListeners);
          if (features.value.length === 1) {
            setupSingleFeature();
          } else {
            Object.keys(parameters.value).forEach((key) => {
              parameters.value[key] = features.value.reduce(
                (prevValue, feature) => {
                  if (prevValue === null) {
                    return null;
                  }
                  const currentValue = feature.get(key);
                  if (!currentValue) {
                    return null;
                  }
                  if (prevValue === undefined) {
                    return currentValue;
                  }
                  return prevValue === currentValue ? prevValue : null;
                },
                undefined,
              );
            });
          }
        },
        { immediate: true },
      );

      onUnmounted(() => {
        mapActivatedListener();
        unByKey(featureListeners);
      });

      return {
        show3dParameters,
        parameters,
        setExtrudedHeight(value) {
          if (
            parameters.value.olcs_extrudedHeight !== value &&
            Number.isFinite(value)
          ) {
            parameters.value.olcs_extrudedHeight = value;
            features.value.forEach((f) => {
              // ensureFeatureAbsolute(f); XXX todo
              f.set('olcs_extrudedHeight', value);
            });
          }
        },
        setAltitudeMode(value) {
          if (parameters.value.olcs_altitudeMode !== value) {
            parameters.value.olcs_altitudeMode = value;
            features.value.forEach((f) => {
              f.set('olcs_altitudeMode', value);
            });
          }
        },
        setClassificationType(value) {
          if (parameters.value.olcs_classificationType !== value) {
            parameters.value.olcs_classificationType = value;
            features.value.forEach((f) => {
              f.set('olcs_classificationType', value);
            });
          }
        },
      };
    },
  };
</script>

<style scoped></style>
