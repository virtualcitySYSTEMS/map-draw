<template>
  <v-sheet>
    <v-dialog
      v-model="showTranslate"
      width="200"
    >
      <template #activator="{ on, attrs }">
        <VcsButton
          v-bind="attrs"
          v-on="on"
        >
          Translate
        </VcsButton>
      </template>
      <v-card class="d-flex pa-2 justify-center" width="200px">
        <VcsTextField label="X" v-model.number="xValue" />
        <VcsTextField label="Y" v-model.number="yValue" />
        <VcsTextField label="Z" v-model.number="zValue" />
        <VcsButton @click="translate">
          Apply
        </VcsButton>
      </v-card>
    </v-dialog>
    <v-dialog
      v-model="showRotate"
      width="400"
    >
      <template #activator="{ on, attrs }">
        <VcsButton
          v-bind="attrs"
          v-on="on"
        >
          Rotate
        </VcsButton>
      </template>
      <v-card class="d-flex pa-2">
        <VcsTextField label="Angle" v-model.number="xValue" />
        <VcsButton @click="rotate">
          Apply
        </VcsButton>
        <VcsButton @click="cw">
          CW
        </VcsButton>
        <VcsButton @click="ccw">
          CCW
        </VcsButton>
      </v-card>
    </v-dialog>
    <v-dialog
      v-model="showScale"
      width="200"
    >
      <template #activator="{ on, attrs }">
        <VcsButton
          v-bind="attrs"
          v-on="on"
        >
          Scale
        </VcsButton>
      </template>
      <v-card class="d-flex pa-2">
        <VcsTextField label="X" v-model.number="xValue" placeholder="1" />
        <VcsTextField label="Y" v-model.number="yValue" placeholder="1" />
        <VcsButton @click="scale">
          Apply
        </VcsButton>
      </v-card>
    </v-dialog>
    <VcsButton>Drape</VcsButton>
  </v-sheet>
</template>

<script>
  // TODO make the above forms so `enter` works as expected
  import { Math as CesiumMath } from '@vcmap-cesium/engine';
  import { VcsButton, VcsTextField } from '@vcmap/ui';
  import { VCard, VDialog, VSheet } from 'vuetify/lib';
  import { inject, ref } from 'vue';

  export default {
    components: {
      VcsButton,
      VCard,
      VSheet,
      VDialog,
      VcsTextField,
    },
    name: 'FeatureTransforms',
    setup() {
      const showTranslate = ref(false);
      const showRotate = ref(false);
      const showScale = ref(false);
      const xValue = ref(null);
      const yValue = ref(null);
      const zValue = ref(null);
      const manager = inject('manager');
      const is3D = ref(true); // XXX todo calculate

      return {
        showTranslate,
        showRotate,
        showScale,
        xValue,
        yValue,
        zValue,
        translate() {
          manager.currentSession.value.translate(xValue.value ?? 0, yValue.value ?? 0, zValue.value ?? 0);
          xValue.value = null;
          yValue.value = null;
          zValue.value = null;
          showTranslate.value = false;
        },
        rotate() {
          manager.currentSession.value.rotate(CesiumMath.toRadians(xValue.value ?? 0));
          xValue.value = null;
          showRotate.value = false;
        },
        cw() {
          manager.currentSession.value.rotate(-CesiumMath.PI_OVER_TWO);
        },
        ccw() {
          manager.currentSession.value.rotate(CesiumMath.PI_OVER_TWO);
        },
        scale() {
          manager.currentSession.value.scale(xValue.value ?? 1, yValue.value ?? 1);
          xValue.value = null;
          yValue.value = null;
          showScale.value = false;
        },
      };
    },
  };
</script>

<style scoped>

</style>
