<template>
  <v-container class="px-0 py-0">
    <v-row no-gutters>
      <v-col cols="4">
        <VcsTextField
          type="number"
          v-model.number="x"
          :tooltip-position="'bottom'"
          prefix="X"
          dense
          @change="onInput"
        />
      </v-col>
      <v-col cols="4">
        <VcsTextField
          type="number"
          v-model.number="y"
          :tooltip-position="'bottom'"
          prefix="Y"
          @change="onInput"
        />
      </v-col>
      <v-col cols="4">
        <VcsTextField
          type="number"
          v-model.number="z"
          :tooltip-position="'bottom'"
          prefix="Z"
          @change="onInput"
        />
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  import { VRow, VCol, VContainer } from 'vuetify/lib';
  import { ref, watch } from 'vue';
  import { Projection } from '@vcmap/core';
  import { VcsTextField } from '@vcmap/ui';

  export default {
    name: 'CoordinateInput',
    components: { VcsTextField, VRow, VCol, VContainer },
    props: {
      value: {
        type: Array,
        required: true,
      },
      label: {
        type: String,
        default: 'Position', // TODO i18n
      },
      wgs84: {
        type: Boolean,
        default: false,
      },
    },
    setup(props, { emit }) {
      const x = ref(0);
      const y = ref(0);
      const z = ref(0);
      let currentCoords = [0, 0, 0];

      function setFromProps() {
        if (currentCoords.some((c, index) => c !== props.value[index])) {
          if (props.wgs84) {
            const wgs84Coords = Projection.mercatorToWgs84(props.value);
            x.value = wgs84Coords[0];
            y.value = wgs84Coords[1];
            z.value = wgs84Coords[2];
          } else {
            x.value = props.value[0];
            y.value = props.value[1];
            z.value = props.value[2];
          }
          currentCoords = props.value.slice();
        }
      }
      watch(props, () => {
        currentCoords = [0, 0, 0];
        setFromProps();
      });
      setFromProps();

      const onInput = () => {
        const coords = [x.value, y.value, z.value];
        if (coords.every((c) => Number.isFinite(c))) {
          if (props.wgs84) {
            emit('input', Projection.wgs84ToMercator(coords));
          } else {
            emit('input', coords);
          }
        }
      };

      return {
        x,
        y,
        z,
        onInput,
      };
    },
  };
</script>
