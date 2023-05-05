<template>
  <v-sheet>
    <VcsFormSection
      v-if="session.type === SessionType.SELECT && features.length === 1"
      heading="drawing.geometry.header"
      :header-actions="[
        {
          name: 'editGeometry',
          title: 'drawing.geometry.edit',
          icon: '$vcsPen',
          active: isGeometryEditing,
          callback: () => {
            toggleEditGeometrySession();
          },
        },
      ]"
    >
      <component
        v-if="singleFeatureGeometryComponent"
        :is="singleFeatureGeometryComponent"
        :is-bbox="isBbox"
      />
      <div v-else class="px-2 py-1">
        {{ $t('drawing.geometry.info1') }} <v-icon>$vcsPen</v-icon>
        {{ $t('drawing.geometry.info2') }}.
      </div>
    </VcsFormSection>
    <VcsFormSection heading="drawing.style.header">
      <StyleComponent />
    </VcsFormSection>
    <VcsFormSection heading="drawing.parameters.header">
      <feature-parameters />
    </VcsFormSection>
    <VcsFormSection
      v-if="session.type === SessionType.SELECT"
      heading="drawing.transform.header"
      :action-button-list-overflow-count="4"
      :header-actions="availableTransformationModes"
    >
      <div class="px-1">
        <feature-transforms
          v-if="currentTransformationMode"
          :transformation-mode="currentTransformationMode"
        />
        <div v-else class="px-2 py-1">
          {{ $t('drawing.transform.info') }}
        </div>
      </div>
    </VcsFormSection>
  </v-sheet>
</template>

<script>
  import { VSheet, VCard, VChip, VIcon } from 'vuetify/lib';
  import { VcsFormSection, VcsSelect } from '@vcmap/ui';
  import { unByKey } from 'ol/Observable.js';
  import {
    inject,
    ref,
    watch,
    onUnmounted,
    provide,
    onMounted,
    computed,
  } from 'vue';
  import { GeometryType, SessionType, TransformationMode } from '@vcmap/core';
  import CircleGeometryComponent from './circleGeometryComponent.vue';
  import PointGeometryComponent from './pointGeometryComponent.vue';
  import RectangleGeometryComponent from './rectangleGeometryComponent.vue';
  import StyleComponent from './styleComponent.vue';
  import FeatureParameters from './featureParameters.vue';
  import FeatureTransforms from './featureTransforms.vue';

  const singleFeatureGeometryComponentId = {
    Circle: 'CircleGeometryComponent',
    Point: 'PointGeometryComponent',
    BBox: 'RectangleGeometryComponent',
  };

  export const TransformationIcons = {
    [TransformationMode.TRANSLATE]: 'mdi-axis-arrow',
    [TransformationMode.ROTATE]: 'mdi-rotate-3d-variant',
    [TransformationMode.SCALE]: 'mdi-arrow-top-right-bottom-left',
    [TransformationMode.EXTRUDE]: '$vcsWall',
  };

  /**
   * Returns all the available transformation modes for the provided features.
   * @param {Array<import("ol").Feature>} features The selected features to which transformation options should be shown.
   * @returns {Array<TransformationMode>} The allowed transformation modes.
   */
  export function getAllowedTransformationModes(features) {
    const isSinglePoint =
      features.length === 1 &&
      features[0].getGeometry().getType() === GeometryType.Point;
    return [
      TransformationMode.TRANSLATE,
      TransformationMode.EXTRUDE,
      ...(!isSinglePoint ? [TransformationMode.ROTATE] : []),
      ...(!isSinglePoint ? [TransformationMode.SCALE] : []),
    ];
  }

  /**
   * @param {import('ol').Feature} feature The feature that is selected.
   * @param {import('vue').Ref<any>} singleFeatureGeometryComponent The ref that holds the id of the currently selected geometry.
   * @param {import('vue').Ref<Boolean>} isBbox If the geometry is bbox.
   * @returns {Function} Function to delete geometry change listener on the provided feature.
   */
  function updateGeometryComponent(
    feature,
    singleFeatureGeometryComponent,
    isBbox,
  ) {
    function setComponentId() {
      const geometry = feature?.getGeometry();
      const geometryType = geometry?.getType?.();
      if (
        geometryType === GeometryType.Polygon &&
        geometry.get('_vcsGeomType') === GeometryType.BBox
      ) {
        singleFeatureGeometryComponent.value =
          singleFeatureGeometryComponentId.BBox;
        isBbox.value = true;
      } else {
        singleFeatureGeometryComponent.value =
          singleFeatureGeometryComponentId[geometryType];
        isBbox.value = false;
      }
    }
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
      VIcon,
      VcsFormSection,
      VcsSelect,
      CircleGeometryComponent,
      PointGeometryComponent,
      RectangleGeometryComponent,
      StyleComponent,
    },
    name: 'FeaturesPropertyWindow',
    setup() {
      /** @type {import("../editorManager").EditorManager} */
      const editorManager = inject('manager');
      const {
        currentFeatures: features,
        currentSession: session,
        currentEditSession: editSession,
      } = editorManager;
      provide('features', features);
      const singleFeatureGeometryComponent = ref(null);
      /** If the geometry is bbox. Helps to distinguish between bbox and recangle. */
      const isBbox = ref(false);
      const currentTransformationMode = ref();

      let featureListener = () => {};
      function updateProperyWindow() {
        featureListener();
        const sessionType = session.value?.type;
        if (sessionType) {
          featureListener = updateGeometryComponent(
            features.value[0],
            singleFeatureGeometryComponent,
            isBbox,
          );
        }
      }

      const isGeometryEditing = computed(
        () => editSession.value?.type === SessionType.EDIT_GEOMETRY,
      );

      const editModeListener = () => {};
      watch(editSession, () => {
        editModeListener();
        currentTransformationMode.value = editSession.value?.mode || null;
        if (currentTransformationMode.value) {
          editSession.value.modeChanged.addEventListener((mode) => {
            currentTransformationMode.value = mode;
          });
        }
      });

      function toggleEditSession(mode) {
        if (
          currentTransformationMode.value &&
          currentTransformationMode.value === mode
        ) {
          editorManager.stopEditing();
        } else {
          editorManager.startTransformSession(mode);
        }
      }

      const availableTransformationModes = computed(() => {
        const allowedModes = getAllowedTransformationModes(
          editorManager.currentFeatures.value,
        );
        return allowedModes.map((mode) => {
          return {
            name: mode,
            title: `drawing.transform.${mode}`,
            icon: TransformationIcons[mode],
            active: currentTransformationMode.value === mode,
            callback: () => {
              toggleEditSession(mode);
            },
          };
        });
      });

      let featureWatcher = () => {};
      onMounted(() => {
        featureWatcher = watch(features, updateProperyWindow);
        updateProperyWindow();
      });

      onUnmounted(() => {
        featureWatcher();
        featureListener();
        editModeListener();
        editorManager.stopEditing();
      });

      return {
        singleFeatureGeometryComponent,
        features,
        session,
        SessionType,
        isBbox,
        isGeometryEditing,
        toggleEditGeometrySession() {
          if (isGeometryEditing.value) {
            editorManager.stopEditing();
          } else {
            editorManager.startEditSession();
          }
        },
        currentTransformationMode,
        TransformationMode,
        TransformationIcons,
        availableTransformationModes,
      };
    },
  };
</script>

<style scoped></style>
