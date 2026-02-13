<script setup lang="ts">
  import type { VectorPropertiesOptions } from '@vcmap/core';
  import {
    AbstractConfigEditor,
    VcsFormSection,
    VcsLabel,
    VcsSelect,
  } from '@vcmap/ui';
  import type { PropType } from 'vue';
  import { ref, toRaw } from 'vue';
  import { VContainer, VCol, VRow } from 'vuetify/components';
  import type { DrawConfig } from './defaultOptions.js';
  import getDefaultOptions from './defaultOptions.js';

  const props = defineProps({
    getConfig: {
      type: Function as PropType<() => DrawConfig>,
      required: true,
    },
    setConfig: {
      type: Function as PropType<(config: object | undefined) => void>,
      required: true,
    },
  });
  const config = props.getConfig();
  const localConfig = ref({
    ...getDefaultOptions(),
    ...structuredClone(config),
  });

  const altitudeModes: {
    value: VectorPropertiesOptions['altitudeMode'];
    title: string;
  }[] = [
    'clampToGround',
    'clampToTerrain',
    'clampTo3DTiles',
    'absolute',
    'relativeToGround',
    'relativeToTerrain',
    'relativeTo3DTiles',
  ].map((value) => ({
    value: value as VectorPropertiesOptions['altitudeMode'],
    title: `components.vectorProperties.${value}`,
  }));

  function apply(): void {
    props.setConfig(structuredClone(toRaw(localConfig.value)));
  }
</script>

<template>
  <AbstractConfigEditor v-bind="{ ...$attrs, ...$props }" @submit="apply">
    <VcsFormSection
      v-if="localConfig"
      heading="draw.config.title"
      expandable
      :start-open="true"
    >
      <v-container class="py-0 px-1">
        <v-row no-gutters>
          <v-col>
            <VcsLabel html-for="altitudeModes">
              {{ $t('draw.config.altitudeModes') }}
            </VcsLabel>
          </v-col>
          <v-col>
            <VcsSelect
              v-model="localConfig.altitudeModes"
              :items="altitudeModes"
              multiple
            />
          </v-col>
        </v-row>
      </v-container>
    </VcsFormSection>
  </AbstractConfigEditor>
</template>

<style scoped></style>
