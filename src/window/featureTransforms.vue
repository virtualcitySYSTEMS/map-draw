<template>
  <v-sheet>
    <v-container class="pl-0 pr-1 py-1">
      <v-row
        no-gutters
        v-if="transformationMode === TransformationMode.TRANSLATE"
      >
        <v-col>
          <VcsTextField
            type="number"
            placeholder="0 m"
            prefix="X"
            v-model.number="xValue"
            unit="m"
            @keydown.enter.prevent="translate"
          />
        </v-col>
        <v-col>
          <VcsTextField
            type="number"
            placeholder="0 m"
            prefix="Y"
            v-model.number="yValue"
            unit="m"
            @keydown.enter.prevent="translate"
          />
        </v-col>
        <v-col>
          <VcsTextField
            type="number"
            placeholder="0 m"
            prefix="Z"
            v-model.number="zValue"
            unit="m"
            :disabled="
              !allowZInput || featureProperties.altitudeMode !== 'absolute'
            "
            @keydown.enter.prevent="translate"
          />
        </v-col>
        <v-col class="d-flex justify-end align-center">
          <VcsButton @click="translate">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
        <v-col cols="1" class="d-flex justify-end align-center">
          <VcsButton
            @click="placeOnTerrain"
            tooltip="drawing.geometry.placeOnTerrain"
            :disabled="
              !allowZInput || featureProperties.altitudeMode !== 'absolute'
            "
          >
            <v-icon>$vcsGround</v-icon>
          </VcsButton>
        </v-col>
      </v-row>
      <v-row no-gutters v-if="transformationMode === TransformationMode.ROTATE">
        <v-col cols="3">
          <VcsTextField
            type="number"
            v-model.number="xValue"
            placeholder="0 °"
            unit="°"
            @keydown.enter.prevent="rotate"
          />
        </v-col>
        <v-col class="d-flex justify-end align-center">
          <VcsButton @click="rotate">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
        <v-col cols="1" class="d-flex justify-end align-center">
          <VcsButton @click="ccw" tooltip="drawing.transform.ccw">
            <v-icon>$vcsRotateLeft</v-icon>
          </VcsButton>
        </v-col>
        <v-col cols="1" class="d-flex justify-end align-center">
          <VcsButton @click="cw" tooltip="drawing.transform.cw">
            <v-icon>$vcsRotateRight</v-icon>
          </VcsButton>
        </v-col>
      </v-row>
      <v-row no-gutters v-if="transformationMode === TransformationMode.SCALE">
        <v-col cols="3">
          <VcsTextField
            prefix="X"
            v-model.number="xValue"
            placeholder="1"
            @keydown.enter.prevent="scale"
          />
        </v-col>
        <v-col cols="3">
          <VcsTextField
            prefix="Y"
            v-model.number="yValue"
            placeholder="1"
            @keydown.enter.prevent="scale"
          />
        </v-col>
        <v-col class="d-flex justify-end align-center">
          <VcsButton @click="scale">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
      </v-row>
    </v-container>
  </v-sheet>
</template>

<script>
  import { Math as CesiumMath } from '@vcmap-cesium/engine';
  import { TransformationMode } from '@vcmap/core';
  import { VcsButton, VcsTextField } from '@vcmap/ui';
  import { VSheet, VContainer, VRow, VCol, VIcon } from 'vuetify/lib';
  import { inject, ref, watch } from 'vue';

  export default {
    components: {
      VcsButton,
      VSheet,
      VContainer,
      VRow,
      VCol,
      VIcon,
      VcsTextField,
    },
    props: {
      transformationMode: {
        type: String,
        required: true,
      },
      featureProperties: {
        type: Object,
        required: true,
      },
      allowZInput: {
        type: Boolean,
        default: false,
      },
    },
    name: 'FeatureTransforms',
    setup(props) {
      const manager = inject('manager');

      const showTranslate = ref(false);
      const showRotate = ref(false);
      const showScale = ref(false);
      const xValue = ref(null);
      const yValue = ref(null);
      const zValue = ref(null);

      function resetInputs() {
        xValue.value = null;
        yValue.value = null;
        zValue.value = null;
      }

      watch(
        () => props.transformationMode,
        () => {
          resetInputs();
        },
      );

      return {
        showTranslate,
        showRotate,
        showScale,
        TransformationMode,
        xValue,
        yValue,
        zValue,
        async translate() {
          manager.currentEditSession.value.translate(
            xValue.value ?? 0,
            yValue.value ?? 0,
            zValue.value ?? 0,
          );
          resetInputs();
        },
        async rotate() {
          manager.currentEditSession.value.rotate(
            CesiumMath.toRadians(xValue.value ?? 0),
          );
          xValue.value = null;
        },
        async cw() {
          manager.currentEditSession.value.rotate(-CesiumMath.PI_OVER_TWO);
        },
        async ccw() {
          manager.currentEditSession.value.rotate(CesiumMath.PI_OVER_TWO);
        },
        async scale() {
          manager.currentEditSession.value.scale(
            xValue.value ?? 1,
            yValue.value ?? 1,
          );
          resetInputs();
        },
        placeOnTerrain() {
          manager.placeCurrentFeaturesOnTerrain();
        },
      };
    },
  };
</script>

<style scoped></style>
