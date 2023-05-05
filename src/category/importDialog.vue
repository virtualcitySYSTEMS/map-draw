<template>
  <v-dialog :value="true" @input="close" width="300">
    <v-card>
      <vcs-form-section heading="File Selection">
        <vcs-text-field
          v-model="file"
          type="file"
          @change="file = $event"
          clearable
          accept=".geojson,.json,.txt"
        />
      </vcs-form-section>
      <vcs-button @click="run" v-if="file"> Import </vcs-button>
    </v-card>
  </v-dialog>
</template>

<script>
  import { VDialog, VCard } from 'vuetify/lib';
  import {
    VcsFormSection,
    VcsTextField,
    VcsButton,
    NotificationType,
  } from '@vcmap/ui';
  import { inject, ref } from 'vue';
  import { mercatorProjection, parseGeoJSON, VectorLayer } from '@vcmap/core';

  export default {
    name: 'ImportDialog',
    components: {
      VCard,
      VDialog,
      VcsFormSection,
      VcsTextField,
      VcsButton,
    },
    props: {
      windowState: {
        type: Object,
        required: true,
      },
    },
    setup(props) {
      /** @type {VcsUiApp} */
      const app = inject('vcsApp');
      const category = inject('category');
      const file = ref(null);

      const close = () => {
        app.windowManager.remove(props.windowState.id);
      };
      return {
        file,
        close,
        hello(e) {
          // eslint-disable-next-line no-console
          console.log('heelo', e);
        },
        run() {
          if (file.value) {
            const reader = new FileReader();
            reader.onload = (e) => {
              // XXX maybe disable dialgo during import?
              const text = e.target.result;
              try {
                const { features, style, vcsMeta } = parseGeoJSON(text, {
                  dynamicStyle: true,
                });
                const layer = new VectorLayer({
                  projection: mercatorProjection.toJSON(),
                  properties: {
                    title: file.value.filename,
                  },
                });
                layer.addFeatures(features);
                if (style) {
                  layer.setStyle(style);
                }
                layer.setVcsMeta(vcsMeta);
                layer.activate();
                category.collection.add(layer);
                close();
              } catch (err) {
                app.notifier.add({
                  message: err.message,
                  type: NotificationType.ERROR,
                });
                file.value = null;
              }
            };
            reader.readAsText(file.value);
          }
        },
      };
    },
  };
</script>

<style scoped></style>
