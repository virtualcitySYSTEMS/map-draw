<template>
  <vcs-text-field
    @keypress.enter="close"
    @keydown.esc="reset"
    v-model="title"
    autofocus
  />
</template>

<script>
  import { VcsTextField } from '@vcmap/ui';
  import { computed, getCurrentInstance, inject } from 'vue';

  export default {
    name: 'RenameDialog',
    components: {
      VcsTextField,
    },
    props: {
      windowState: {
        type: Object,
        required: true,
      },
    },
    setup(props) {
      const item = inject('item');
      const setName = inject('setName');
      const app = inject('vcsApp');

      const originalTitle = item.title;
      const instance = getCurrentInstance().proxy;
      const title = computed({
        get() { return instance.$t(item.title); },
        set(newTitle) {
          setName(newTitle);
          item.title = newTitle;
        },
      });

      const close = () => {
        app.windowManager.remove(props.windowState.id);
      };

      return {
        title,
        reset() {
          title.value = originalTitle;
          close();
        },
        close,
      };
    },
  };
</script>

<style scoped>

</style>
