<script setup>
  import {
    AbstractConfigEditor,
    VcsFormSection,
    VcsLabel,
    VcsSelect,
  } from '@vcmap/ui';
  import { ref } from 'vue';
  import { VContainer, VCol, VRow } from 'vuetify/components';
  import getDefaultOptions from './defaultOptions.js';

  const props = defineProps({
    getConfig: {
      type: Function,
      required: true,
    },
    setConfig: {
      type: Function,
      required: true,
    },
  });

  const localConfig = ref({ ...props.getConfig(), ...getDefaultOptions() });

  /**
   * @type {{ value: import("@vcmap/core").VectorPropertiesOptions["altitudeMode"], title: string }}
   */
  const altitudeModes = [
    'clampToGround',
    'clampToTerrain',
    'clampTo3DTiles',
    'absolute',
    'relativeToGround',
    'relativeToTerrain',
    'relativeTo3DTiles',
  ].map((value) => ({
    value,
    title: `components.vectorProperties.${value}`,
  }));

  function apply() {
    props.setConfig(localConfig.value);
  }
</script>

<template>
  <AbstractConfigEditor @submit="apply" v-bind="{ ...$attrs, ...$props }">
    <VcsFormSection
      heading="drawing.config.title"
      expandable
      :start-open="true"
      v-if="localConfig"
    >
      <v-container class="py-0 px-1">
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="altitudeModes">
              {{ $t('drawing.config.altitudeModes') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              :items="altitudeModes"
              multiple
              v-model="localConfig.altitudeModes"
            />
          </v-col>
        </v-row>
      </v-container>
    </VcsFormSection>
  </AbstractConfigEditor>
</template>

<style scoped></style>
