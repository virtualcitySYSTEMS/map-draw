<template>
  <v-sheet>
    <v-row>
      <v-col
        cols="12"
        sm="8"
      >
        {{ $t(label) }}
      </v-col>
      <v-col
        cols="12"
        sm="4"
      >
        <v-switch v-model="wgs84" label="WGS 84" small />
      </v-col>
    </v-row>
    <v-row>
      <v-col
        cols="12"
        sm="4"
      >
        <VcsTextField
          v-model.number="x"
          :tooltip-position="'bottom'"
          label="X"
          dense
          @change="onInput"
        />
      </v-col>
      <v-col
        cols="12"
        sm="4"
      >
        <VcsTextField
          v-model.number="y"
          :tooltip-position="'bottom'"
          label="Y"
          dense
          @change="onInput"
        />
      </v-col>
      <v-col
        cols="12"
        sm="4"
      >
        <VcsTextField
          v-model.number="z"
          :tooltip-position="'bottom'"
          label="Z"
          dense
          @change="onInput"
        />
      </v-col>
    </v-row>
  </v-sheet>
</template>

<script>
  import { VRow, VCol, VSwitch, VSheet } from 'vuetify/lib';
  import { computed, ref, watch } from 'vue';
  import { Projection } from '@vcmap/core';
  import { VcsTextField } from '@vcmap/ui';

  export default {
    name: 'CoordinateInput',
    components: { VcsTextField, VRow, VCol, VSwitch, VSheet },
    props: {
      value: {
        type: Array,
        required: true,
      },
      label: {
        type: String,
        default: 'Position', // TODO i18n
      },
    },
    setup(props, { emit }) {
      const wgs84 = ref(false);
      const x = ref(0);
      const y = ref(0);
      const z = ref(0);
      let currentCoords = [0, 0, 0];

      const setFromProps = () => {
        if (currentCoords.some((c, index) => c !== props.value[index])) {
          if (wgs84.value) {
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
      };
      watch(props, setFromProps);
      setFromProps();

      const onInput = () => {
        const coords = [x.value, y.value, z.value];
        if (coords.every(c => Number.isFinite(c))) {
          if (wgs84.value) {
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
        wgs84: computed({
          get() {
            return wgs84.value;
          },
          set(value) {
            wgs84.value = value;
            currentCoords = [0, 0, 0];
            setFromProps();
          },
        }),
      };
    },
  };
</script>
