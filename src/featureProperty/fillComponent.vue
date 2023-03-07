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
          v-on="on"
          v-bind="attrs"
        />
      </template>
      <v-color-picker
        :value="color"
        @update:color="updateColor"
        mode="rgba"
        :hide-mode-switch="true"
      />
    </v-menu>
  </v-sheet>
</template>

<script>
  import { VSheet, VMenu, VCard, VColorPicker } from 'vuetify/lib';
  import { computed, inject } from 'vue';

  export function olColorToHex(color) {
    function componentHex(c) {
      const hex = c.toString(16);
      return hex.length === 1 ? `0${hex}` : hex;
    }

    const clone = color.slice();
    clone[3] *= 255;
    return clone.reduce((prev, val) => `${prev}${componentHex(val)}`, '#');
  }

  export default {
    name: 'FillComponent',
    components: {
      VSheet,
      VMenu,
      VCard,
      VColorPicker,
    },
    setup(p, { emit }) {
      const styleOptions = inject('styleOptions');
      return {
        color: computed(() => olColorToHex(styleOptions.value.fill ?? [255, 255, 255, 0.4])),
        updateColor(colorObj) {
          const { rgba } = colorObj;
          styleOptions.value.fill = [rgba.r, rgba.g, rgba.b, rgba.a]; // XXX only update if it actually changes
          emit('update');
        },
      };
    },
  };
</script>

<style scoped>

</style>
