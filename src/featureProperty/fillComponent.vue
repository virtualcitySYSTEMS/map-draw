<template>
  <v-sheet>
    <v-menu
      :close-on-content-click="false"
      v-model="isMenuOpen"
      :absolute="true"
    >
      <template #activator="{ on, attrs }">
        <VcsTooltip tooltip="drawing.style.fill">
          <template #activator="{ on: tooltipOn, attrs: tooltipAttrs }">
            <v-card
              :color="`rgba(${Object.values(color).toString()})`"
              rounded
              height="24px"
              width="32px"
              v-bind="{ ...attrs, ...tooltipAttrs }"
              v-on="{ ...on, ...tooltipOn }"
              class="pa-1"
            />
          </template>
        </VcsTooltip>
      </template>
      <VcsFormSection
        heading="drawing.style.fill"
        :header-actions="[
          {
            name: 'resetFill',
            title: 'drawing.style.reset',
            icon: '$vcsReturn',
            callback: () => {
              reset();
            },
          },
          {
            name: 'closeFill',
            title: 'drawing.style.close',
            icon: 'mdi-close-thick',
            callback: () => {
              close();
            },
          },
        ]"
      >
        <v-sheet>
          <v-color-picker
            :value="color"
            @input="updateColor"
            mode="rgba"
            :hide-mode-switch="true"
          />
        </v-sheet>
      </VcsFormSection>
    </v-menu>
  </v-sheet>
</template>

<script>
  import { computed, ref } from 'vue';
  import { VSheet, VMenu, VCard, VColorPicker } from 'vuetify/lib';
  import { VcsFormSection, VcsTooltip } from '@vcmap/ui';

  export default {
    name: 'FillComponent',
    components: {
      VSheet,
      VMenu,
      VCard,
      VColorPicker,
      VcsFormSection,
      VcsTooltip,
    },
    props: {
      styleOptions: {
        type: Object,
        required: true,
      },
    },
    setup(props, { emit }) {
      const isMenuOpen = ref(false);
      return {
        color: computed(() => {
          const rgbaArray = props.styleOptions.fill;
          if (rgbaArray) {
            return {
              r: rgbaArray[0],
              g: rgbaArray[1],
              b: rgbaArray[2],
              a: rgbaArray[3],
            };
          } else {
            return { r: 255, g: 255, b: 255, a: 0.4 };
          }
        }),
        updateColor(rgba) {
          const fill = [rgba.r, rgba.g, rgba.b, rgba.a];
          emit('update', { key: 'fill', value: fill }); // XXX only update if it actually changes
        },
        reset() {
          emit('update', { key: 'fill', value: undefined });
        },
        isMenuOpen,
        close() {
          isMenuOpen.value = false;
        },
      };
    },
  };
</script>

<style scoped></style>
