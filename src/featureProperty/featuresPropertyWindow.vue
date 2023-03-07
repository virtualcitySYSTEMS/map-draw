<template>
  <v-sheet>
    <VcsFormSection
      heading="Geometry"
      v-if="singleFeatureGeometryComponent"
    >
      <component :is="singleFeatureGeometryComponent" />
    </VcsFormSection>
    <VcsFormSection
      heading="Style"
    >
      <StyleComponent />
    </VcsFormSection>
    <VcsFormSection
      heading="Parameters"
    >
      <feature-parameters />
    </VcsFormSection>
    <VcsFormSection
      heading="Transform"
      v-if="isFeatureMode"
    >
      <feature-transforms />
    </VcsFormSection>
    <VcsFormSection
      heading="Selected"
    >
      <v-chip
        small
      >
        Selected: {{ features.length }}
      </v-chip>
    </VcsFormSection>
  </v-sheet>
</template>

<script>
  import { VSheet, VCard, VChip } from 'vuetify/lib';
  import { VcsFormSection } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import {
    inject,
    ref,
    watch,
    onUnmounted,
    provide,
    onMounted,
  } from 'vue';
  import { SessionType } from '@vcmap/core';
  import CircleGeometryComponent from './circleGeometryComponent.vue';
  import PointGeometryComponent from './pointGeometryComponent.vue';
  import StyleComponent from './styleComponent.vue';
  import FeatureParameters from './featureParameters.vue';
  import FeatureTransforms from './featureTransforms.vue';

  const singleFeatureGeometryComponentId = {
    Circle: 'CircleGeometryComponent',
    Point: 'PointGeometryComponent',
  };

  function setupSingleFeature(feature, singleFeatureGeometryComponent) {
    const setComponentId = () => {
      const geometryType = feature.getGeometry()?.getType?.();
      singleFeatureGeometryComponent.value = singleFeatureGeometryComponentId[geometryType];
    };
    setComponentId();

    const eventKey = feature.on('change:geometry', setComponentId);
    return () => {
      unByKey(eventKey);
    };
  }

  export default {
    components: {
      FeatureTransforms,
      FeatureParameters,
      VSheet,
      VCard,
      VChip,
      VcsFormSection,
      CircleGeometryComponent,
      PointGeometryComponent,
      StyleComponent,
    },
    name: 'FeaturesPropertyWindow',
    setup() {
      /** @type {EditorManager} */
      const editorManager = inject('manager');
      const features = editorManager.currentFeatures;
      provide('features', features);
      const singleFeatureGeometryComponent = ref(null);
      const isFeatureMode = ref(false);

      let featureListeners = () => {};
      const setupFeatures = () => {
        featureListeners();
        const sessionType = editorManager.currentSession.value?.type;
        isFeatureMode.value = sessionType === SessionType.EDIT_FEATURES;
        if (sessionType === SessionType.EDIT_GEOMETRY || sessionType === SessionType.CREATE) {
          featureListeners = setupSingleFeature(features.value[0], singleFeatureGeometryComponent);
        }
      };

      let featureWatcher = () => {};
      onMounted(() => {
        featureWatcher = watch(features, setupFeatures);
        setupFeatures();
      });

      onUnmounted(() => {
        featureWatcher();
        featureListeners();
      });

      return {
        singleFeatureGeometryComponent,
        features,
        isFeatureMode,
      };
    },
  };
</script>

<style scoped>

</style>
