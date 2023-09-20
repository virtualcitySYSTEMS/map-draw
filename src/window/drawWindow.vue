<template>
  <v-sheet>
    <VcsFormSection
      v-if="session.type === SessionType.SELECT"
      heading="drawing.modify.header"
      :action-button-list-overflow-count="5"
      :header-actions="availableModifyActions"
    >
      <div class="px-1">
        <feature-transforms
          v-if="currentTransformationMode"
          :transformation-mode="currentTransformationMode"
          :feature-properties="featureProperties"
          :allow-z-input="is3D"
        />
        <div v-else class="px-1 py-1">
          {{ $t('drawing.modify.info') }}
        </div>
      </div>
    </VcsFormSection>
    <VcsFormSection heading="drawing.style.header">
      <StyleComponent :feature-properties="featureProperties" />
    </VcsFormSection>
    <VcsVectorPropertiesComponent
      :value="featureProperties"
      :show3-d-properties="is3D"
      @propertyChange="updateFeatureProperties"
      :value-default="defaultVectorProperties"
      :properties="availableVectorProperties"
      :hide-dividers="true"
    />
  </v-sheet>
</template>

<script>
  import { VSheet } from 'vuetify/lib';
  import { VcsFormSection, VcsVectorPropertiesComponent } from '@vcmap/ui';
  import { inject, ref, watch, onUnmounted, provide, computed } from 'vue';
  import {
    CesiumMap,
    GeometryType,
    SessionType,
    TransformationMode,
    VectorProperties,
  } from '@vcmap/core';
  import StyleComponent from './styleComponent.vue';
  import FeatureTransforms from './featureTransforms.vue';

  export const TransformationIcons = {
    [TransformationMode.TRANSLATE]: 'mdi-axis-arrow',
    [TransformationMode.ROTATE]: 'mdi-rotate-3d-variant',
    [TransformationMode.SCALE]: 'mdi-arrow-top-right-bottom-left',
    [TransformationMode.EXTRUDE]: '$vcsWall',
  };

  /**
   * Returns a Set with all geometry types of the provided features
   * @param {import("ol").Feature[]} features Array of ol features
   * @returns {Set<GeometryType>} Set with GeometryTypes
   */
  export function getGeometryTypes(features) {
    return features.reduce((acc, feature) => {
      const geometryType = feature.getGeometry().getType();

      if (
        geometryType === GeometryType.Polygon &&
        feature.getGeometry().get('_vcsGeomType') === GeometryType.BBox
      ) {
        acc.add(GeometryType.BBox);
      } else {
        acc.add(geometryType);
      }
      return acc;
    }, new Set());
  }

  /**
   * Returns all the available transformation modes for the provided features.
   * @param {Set<GeometryType>} geometryTypes The currently selected geometry types.
   * @param {number} nFeatures The number of selected features.
   * @returns {Array<TransformationMode>} The allowed transformation modes.
   */
  export function getAllowedTransformationModes(geometryTypes, nFeatures) {
    const isSinglePoint =
      nFeatures === 1 && geometryTypes.has(GeometryType.Point);
    const isSingleCircle =
      nFeatures === 1 && geometryTypes.has(GeometryType.Circle);
    const isBboxSelected = geometryTypes.has(GeometryType.BBox);
    return [
      TransformationMode.TRANSLATE,
      ...(isSinglePoint || isSingleCircle || isBboxSelected
        ? []
        : [TransformationMode.ROTATE]),
      ...(isSinglePoint || isSingleCircle ? [] : [TransformationMode.SCALE]),
    ];
  }

  export default {
    components: {
      FeatureTransforms,
      VSheet,
      VcsFormSection,
      VcsVectorPropertiesComponent,
      StyleComponent,
    },
    name: 'DrawWindow',
    setup() {
      const vcsApp = inject('vcsApp');
      /** @type {import("../editorManager").EditorManager} */
      const editorManager = inject('manager');
      const {
        currentFeatures: features,
        currentSession: session,
        currentEditSession: editSession,
        currentLayer: layer,
      } = editorManager;

      const availableModifyActions = ref([]);
      const availableVectorProperties = ref([]);

      provide('features', features);
      const featureProperties = ref();

      watch(
        features,
        () => {
          featureProperties.value =
            layer.value.vectorProperties.getValuesForFeatures(features.value);
        },
        { immediate: true },
      );

      /**
       * Sets the changed vector property options on the features. Also handles side effects.
       * @param {import("@vcmap/core").VectorPropertiesOptions} update New property values from user input.
       */
      async function updateFeatureProperties(update) {
        const extrusionLikePropertyKeys = [
          'extrudedHeight',
          'skirt',
          'storeysAboveGround',
          'storeysBelowGround',
          'storeyHeightsAboveGround',
          'storeyHeightsBelowGround',
        ];
        const setsExtrusionLikePropertyKeys =
          !!extrusionLikePropertyKeys.filter(
            (key) => Object.keys(update).includes(key) && !!update[key],
          ).length;
        if (
          setsExtrusionLikePropertyKeys &&
          featureProperties.value.altitudeMode !== 'absolute'
        ) {
          update.altitudeMode = 'absolute';
        } else if (update.altitudeMode === 'clampToGround') {
          extrusionLikePropertyKeys
            .filter((key) => !!featureProperties.value[key])
            .forEach((key) => {
              update[key] = 0;
            });
        }
        // when in create mode and changing altitude mode, this is triggered, but currentFeatures is empty array.
        if (update.altitudeMode === 'absolute' && features?.length) {
          await editorManager.placeCurrentFeaturesOnTerrain();
        }

        layer.value.vectorProperties.setValuesForFeatures(
          update,
          features.value,
        );
        featureProperties.value =
          layer.value.vectorProperties.getValuesForFeatures(features.value);
      }

      const currentTransformationMode = ref();
      const is3D = ref(false);

      function updateIs3D() {
        is3D.value = vcsApp.maps.activeMap instanceof CesiumMap;
      }
      const mapActivatedListener =
        vcsApp.maps.mapActivated.addEventListener(updateIs3D);
      updateIs3D();

      const isGeometryEditing = computed(
        () => editSession.value?.type === SessionType.EDIT_GEOMETRY,
      );

      let editModeListener = () => {};
      watch(editSession, () => {
        editModeListener();
        currentTransformationMode.value = editSession.value?.mode || null;
        if (currentTransformationMode.value) {
          editModeListener = editSession.value.modeChanged.addEventListener(
            (mode) => {
              currentTransformationMode.value = mode;
            },
          );
        }
      });

      function toggleTransformationSession(mode) {
        if (
          currentTransformationMode.value &&
          currentTransformationMode.value === mode
        ) {
          editorManager.stopEditing();
        } else {
          editorManager.startTransformSession(mode);
        }
      }

      function toggleEditGeometrySession() {
        if (isGeometryEditing.value) {
          editorManager.stopEditing();
        } else {
          editorManager.startEditSession();
        }
      }

      /**
       * Set of currently selected geometry types
       * @type {import("vue").ComputedRef<Set<GeometryType>>}
       */
      const currentGeometryTypes = computed(() =>
        getGeometryTypes(features.value),
      );

      function getAllowedModifyActions() {
        const allowedModes = getAllowedTransformationModes(
          currentGeometryTypes.value,
          features.value.length,
        );

        const allowedActions = allowedModes.map((mode) => {
          return {
            name: mode,
            title: `drawing.transform.${mode}`,
            icon: TransformationIcons[mode],
            active: currentTransformationMode.value === mode,
            callback: () => {
              toggleTransformationSession(mode);
            },
          };
        });

        if (features.value.length === 1) {
          allowedActions.unshift({
            name: 'editGeometry',
            title: `drawing.geometry.edit`,
            icon: '$vcsEditVertices',
            active: isGeometryEditing.value,
            callback: () => {
              toggleEditGeometrySession();
            },
          });
        }

        return allowedActions;
      }

      function getAllowedVectorProperties() {
        const properties = ['altitudeMode', 'extrudedHeight'];
        const geomTypes = currentGeometryTypes.value;
        if (geomTypes.size > 1 || !geomTypes.has(GeometryType.Point)) {
          properties.push('classificationType');
        }
        return properties;
      }

      // watcher instead of computeds to avoid triggerung through currentGeometryTypes AND features.
      const geometryTypesWatcher = watch(
        currentGeometryTypes,
        (curr, prev) => {
          if (
            curr.size !== prev?.size ||
            ![...curr].every((value) => prev?.has(value))
          ) {
            availableModifyActions.value = getAllowedModifyActions();
            availableVectorProperties.value = getAllowedVectorProperties();
          }
        },
        { immediate: true },
      );

      onUnmounted(() => {
        mapActivatedListener();
        editModeListener();
        geometryTypesWatcher();
        editorManager.stopEditing();
      });

      return {
        featureProperties,
        session,
        SessionType,
        currentTransformationMode,
        TransformationMode,
        availableModifyActions,
        availableVectorProperties,
        is3D,
        updateFeatureProperties,
        defaultVectorProperties: VectorProperties.getDefaultOptions(),
      };
    },
  };
</script>

<style scoped></style>
