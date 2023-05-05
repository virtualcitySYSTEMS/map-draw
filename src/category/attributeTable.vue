<template>
  <v-sheet>
    <v-data-table
      dense
      :headers="headers"
      :items="items"
      :show-select="true"
      @item-selected="itemSelected"
    />
  </v-sheet>
</template>

<script>
  import { inject, ref, watch, shallowRef, onUnmounted } from 'vue';
  import { VSheet, VDataTable } from 'vuetify/lib';
  import { unByKey } from 'ol/Observable.js';

  export const defaultAttributeTablePosition = {
    left: '20%',
    right: '20%',
    bottom: '10%',
  };

  // XXX FIXME dummy for show and tell.
  const dummy = {
    dummySet: true,
    foo: 'Foo',
    bar: 'The Bar',
    baz: 1,
  };

  /**
   * @param {import("ol").Feature} feature
   * @returns {{item: Ref<Object<string, *>>, eventKey: import("ol/events").EventsKey }}
   */
  function setupFeature(feature) {
    let item = {
      id: feature.getId(),
    };

    const setupProps = () => {
      let props = feature.getProperties();
      if (!props.dummySet) {
        props = { ...dummy };
        feature.setProperties(props);
      }
      props.id = feature.getId();
      const geometryName = feature.getGeometryName();
      item = Object.fromEntries(
        Object.entries(props).filter(
          ([key]) => !(key.startsWith('olcs') || key === geometryName),
        ),
      ); // how to handle nested properties?
    };
    setupProps();

    const eventKey = feature.on('change', setupProps);

    return {
      item,
      eventKey,
    };
  }

  export default {
    name: 'AttributeTable',
    components: {
      VSheet,
      VDataTable,
    },
    setup() {
      const headers = ref([]);
      const items = shallowRef([]);
      /** @type {import("vue").Ref<Array<import("ol").Feature>>} */
      const features = inject('features', ref([]));
      let featureListeners = [];
      watch(
        features,
        () => {
          unByKey(featureListeners);
          const propertyNames = new Set(['id']);
          featureListeners = new Array(features.value.length);
          items.value = features.value.map((f, index) => {
            const { item, eventKey } = setupFeature(f);
            featureListeners[index] = eventKey;
            Object.keys(item).forEach((n) => {
              propertyNames.add(n);
            });
            return item;
          });
          headers.value = [...propertyNames].map((name) => ({
            text: name,
            value: name,
          }));
        },
        { immediate: true },
      );
      /** @type {import("vue").Ref<Array<import("ol").Feature>>|null} */
      // const selectedFeatures = inject('selectedFeatures', null);
      const itemSelected = inject('itemSelected', () => {});

      onUnmounted(() => {
        unByKey(featureListeners);
      });

      return {
        headers,
        items,
        itemSelected,
      };
    },
  };
</script>

<style scoped></style>
