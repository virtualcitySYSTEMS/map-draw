<template>
  <v-sheet>
    <v-menu
      :close-on-content-click="false"
      v-model="isMenuOpen"
      :absolute="true"
    >
      <template #activator="{ on, attrs }">
        <VcsTooltip tooltip="drawing.style.stroke">
          <template #activator="{ on: tooltipOn, attrs: tooltipAttrs }">
            <v-card
              class="stroke-box"
              :style="{
                borderColor: `rgba(${Object.values(color).toString()})`,
              }"
              rounded
              height="24px"
              width="32px"
              v-bind="{ ...attrs, ...tooltipAttrs }"
              v-on="{ ...on, ...tooltipOn }"
            />
          </template>
        </VcsTooltip>
      </template>
      <VcsFormSection
        heading="drawing.style.stroke"
        :header-actions="[
          {
            name: 'resetStroke',
            title: 'drawing.style.reset',
            icon: '$vcsReturn',
            callback: () => {
              reset();
            },
          },
          {
            name: 'closeStroke',
            title: 'drawing.style.close',
            icon: 'mdi-close-thick',
            callback: () => {
              close();
            },
          },
        ]"
      >
        <v-sheet>
          <v-container class="px-1 py-0">
            <v-row no-gutters>
              <v-col>
                <VcsLabel html-for="draw-stroke-width">
                  {{ $t('drawing.style.lineWidth') }}
                </VcsLabel>
              </v-col>
              <v-col cols="3">
                <VcsTextField
                  id="draw-stroke-width"
                  v-model.number="width"
                  type="number"
                  unit="px"
                />
              </v-col>
            </v-row>
          </v-container>
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
  import {
    VSheet,
    VMenu,
    VCard,
    VColorPicker,
    VContainer,
    VRow,
    VCol,
  } from 'vuetify/lib';
  import {
    VcsTextField,
    VcsLabel,
    VcsFormSection,
    VcsTooltip,
  } from '@vcmap/ui';
  import { computed, ref } from 'vue';

  // IDEA make color swatch API
  export default {
    name: 'StrokeComponent',
    components: {
      VcsTextField,
      VcsLabel,
      VcsFormSection,
      VcsTooltip,
      VSheet,
      VMenu,
      VCard,
      VColorPicker,
      VContainer,
      VRow,
      VCol,
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
          const rgbaArray = props.styleOptions.stroke?.color;
          if (rgbaArray) {
            return {
              r: rgbaArray[0],
              g: rgbaArray[1],
              b: rgbaArray[2],
              a: rgbaArray[3],
            };
          } else {
            return { r: 0, g: 0, b: 0, a: 1 };
          }
        }),
        updateColor(rgba) {
          const stroke = {
            width: props.styleOptions.stroke?.width ?? 1,
            color: [rgba.r, rgba.g, rgba.b, rgba.a],
          };
          emit('update', { key: 'stroke', value: stroke }); // XXX only update if it actually changes
        },
        width: computed({
          get() {
            return props.styleOptions.stroke?.width;
          },
          set(value) {
            if (value > 0) {
              const stroke = {
                width: value,
                color: props.styleOptions.stroke?.color
                  ? [...props.styleOptions.stroke.color]
                  : [0, 0, 0, 1],
              };
              emit('update', { key: 'stroke', value: stroke }); // XXX only update if it actually changes
            }
          },
        }),
        style: computed(() => {
          if (props.styleOptions.stroke) {
            return `border-color: '${props.styleOptions.stroke.color}'; border-width: ${props.styleOptions.stroke.width}`;
          }
          return 'background-color: white';
        }),
        reset() {
          emit('update', { key: 'stroke', value: undefined });
        },
        isMenuOpen,
        close() {
          isMenuOpen.value = false;
        },
      };
    },
  };
</script>

<style scoped>
  .stroke-box {
    border: 3px solid;
    background-color: transparent;
  }
</style>
