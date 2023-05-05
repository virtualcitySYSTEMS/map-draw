<template>
  <v-sheet>
    <v-container
      v-if="transformationMode === TransformationMode.TRANSLATE"
      class="pa-0"
    >
      <v-row no-gutters>
        <v-col>
          <VcsTextField placeholder="0" prefix="X" v-model.number="xValue" />
        </v-col>
        <v-col>
          <VcsTextField placeholder="0" prefix="Y" v-model.number="yValue" />
        </v-col>
        <v-col>
          <VcsTextField placeholder="0" prefix="Z" v-model.number="zValue" />
        </v-col>
        <v-col>
          <VcsButton @click="translate">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
      </v-row>
    </v-container>
    <v-container
      v-if="transformationMode === TransformationMode.ROTATE"
      class="pa-0"
    >
      <v-row no-gutters>
        <v-col>
          <VcsTextField
            :placeholder="$t('drawing.transform.angle')"
            v-model.number="xValue"
          />
        </v-col>
        <v-col>
          <VcsButton @click="rotate">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
        <v-col>
          <VcsButton @click="cw" tooltip="drawing.transform.cw">
            <v-icon>$vcsRotateRight</v-icon>
          </VcsButton>
        </v-col>
        <v-col>
          <VcsButton @click="ccw" tooltip="drawing.transform.ccw">
            <v-icon>$vcsRotateLeft</v-icon>
          </VcsButton>
        </v-col>
      </v-row>
    </v-container>
    <v-container
      v-if="transformationMode === TransformationMode.SCALE"
      class="pa-0"
    >
      <v-row no-gutters>
        <v-col>
          <VcsTextField prefix="X" v-model.number="xValue" placeholder="1" />
        </v-col>
        <v-col>
          <VcsTextField prefix="Y" v-model.number="yValue" placeholder="1" />
        </v-col>
        <v-col>
          <VcsButton @click="scale">
            {{ $t('drawing.transform.apply') }}
          </VcsButton>
        </v-col>
      </v-row>
    </v-container>
    <!-- <v-container
      class="pa-0"
    >
      <v-row>
        <v-col>
          <VcsButton>Drape</VcsButton>
        </v-col>
      </v-row>
    </v-container> -->
  </v-sheet>
</template>

<script>
  // TODO make the above forms so `enter` works as expected
  import { Math as CesiumMath } from '@vcmap-cesium/engine';
  import { SessionType, TransformationMode } from '@vcmap/core';
  import { VcsButton, VcsTextField } from '@vcmap/ui';
  import { VSheet, VContainer, VRow, VCol, VIcon } from 'vuetify/lib';
  import { inject, ref } from 'vue';

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
    },
    name: 'FeatureTransforms',
    setup(props) {
      const showTranslate = ref(false);
      const showRotate = ref(false);
      const showScale = ref(false);
      const xValue = ref(null);
      const yValue = ref(null);
      const zValue = ref(null);
      const manager = inject('manager');
      // eslint-disable-next-line no-unused-vars
      const is3D = ref(true); // XXX todo calculate

      function manageTransformSession() {
        if (
          manager.currentEditSession.value?.type === SessionType.EDIT_FEATURES
        ) {
          return () => {};
        } else if (
          manager.currentEditSession.value?.type === SessionType.EDIT_GEOMETRY
        ) {
          manager.startTransformSession(props.transformationMode);
          return manager.startEditSession;
        } else {
          manager.startTransformSession(props.transformationMode);
          return manager.currentEditSession.value.stop;
        }
      }

      return {
        showTranslate,
        showRotate,
        showScale,
        TransformationMode,
        xValue,
        yValue,
        zValue,
        async translate() {
          const endTransformation = manageTransformSession();
          // TODO: Replace all the timeout promises when SelectFeaturesSession is async (https://gitlab.virtualcitysystems.de/vcsuite/npm/vcmap/core/-/issues/107)
          await new Promise((res) => {
            setTimeout(res, 1);
          });
          manager.currentEditSession.value.translate(
            xValue.value ?? 0,
            yValue.value ?? 0,
            zValue.value ?? 0,
          );
          xValue.value = null;
          yValue.value = null;
          zValue.value = null;
          endTransformation();
        },
        async rotate() {
          await new Promise((res) => {
            setTimeout(res, 1);
          });
          const endTransformation = manageTransformSession();
          manager.currentEditSession.value.rotate(
            CesiumMath.toRadians(xValue.value ?? 0),
          );
          xValue.value = null;
          endTransformation();
        },
        async cw() {
          await new Promise((res) => {
            setTimeout(res, 1);
          });
          const endTransformation = manageTransformSession();
          manager.currentEditSession.value.rotate(-CesiumMath.PI_OVER_TWO);
          endTransformation();
        },
        async ccw() {
          await new Promise((res) => {
            setTimeout(res, 1);
          });
          const endTransformation = manageTransformSession();
          manager.currentEditSession.value.rotate(CesiumMath.PI_OVER_TWO);
          endTransformation();
        },
        async scale() {
          await new Promise((res) => {
            setTimeout(res, 1);
          });
          const endTransformation = manageTransformSession();
          manager.currentEditSession.value.scale(
            xValue.value ?? 1,
            yValue.value ?? 1,
          );
          xValue.value = null;
          yValue.value = null;
          endTransformation();
        },
      };
    },
  };
</script>

<style scoped></style>
