<template>
  <v-sheet>
    <v-menu
      :close-on-content-click="false"
    >
      <template #activator="{ on, attrs }">
        <v-card
          :color="color"
          rounded
          height="20px"
          width="40px"
          v-bind="attrs"
          v-on="on"
        />
      </template>
      <v-card>
        <VcsTextField label="Width" v-model.number="width" />
        <v-color-picker
          :value="color"
          @update:color="updateColor"
          mode="rgba"
          :hide-mode-switch="true"
        />
      </v-card>
    </v-menu>
  </v-sheet>
</template>

<script>
  import { VSheet, VMenu, VCard, VColorPicker } from 'vuetify/lib';
  import { VcsTextField } from '@vcmap/ui';
  import { computed, inject } from 'vue';
  import { olColorToHex } from './fillComponent.vue';

  // IDEA make color swatch API
  export default {
    name: 'StrokeComponent',
    components: {
      VcsTextField,
      VSheet,
      VMenu,
      VCard,
      VColorPicker,
    },
    props: {
      styleOptions: {
        type: Object,
        required: true,
      },
    },
    setup(props, { emit }) {
      const styleOptions = inject('styleOptions').value;
      return {
        color: computed(() => olColorToHex(styleOptions.stroke?.color ?? [0, 0, 0, 1])),
        updateColor(colorObj) {
          const { rgba } = colorObj;
          const stroke = styleOptions.stroke ?? { width: 1 };
          stroke.color = [rgba.r, rgba.g, rgba.b, rgba.a];
          styleOptions.stroke = stroke;
          emit('update'); // XXX only update if it actually changes
        },
        width: computed({
          get() { return styleOptions.stroke?.width; },
          set(value) {
            if (value > 0) { // XXX only update if it actually changes
              const stroke = styleOptions.stroke ?? { color: [0, 0, 0, 1] };
              stroke.width = value;
              styleOptions.stroke = stroke;
              emit('update');
            }
          },
        }),
        style: computed(() => {
          if (props.styleOptions.stroke) {
            return `border-color: '${styleOptions.stroke.color}'; border-width: ${styleOptions.stroke.width}`;
          }
          return 'background-color: white';
        }),
      };
    },
  };
</script>

<style scoped>

</style>
