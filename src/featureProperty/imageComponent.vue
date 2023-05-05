<template>
  <v-sheet>
    <v-card height="24px" width="32px">
      <!-- <img :href="shapeImage" width="32" height="24"> -->
      <canvas ref="canvas" width="32" height="24" />
    </v-card>
  </v-sheet>
</template>

<script>
  import { onMounted, ref, watch } from 'vue';
  import { Circle, Fill, RegularShape, Stroke } from 'ol/style.js';
  import { VCard, VSheet } from 'vuetify/lib';

  export default {
    name: 'ImageComponent',
    components: {
      VCard,
      VSheet,
    },
    props: {
      styleOptions: {
        type: Object,
        required: true,
      },
    },
    setup(props) {
      const canvas = ref(null);
      const shapeImage = ref();
      async function drawImage() {
        const context = canvas.value.getContext('2d');
        context.clearRect(0, 0, canvas.value.width, canvas.value.height);
        if (props.styleOptions.image) {
          if (typeof props.styleOptions.image === 'string') {
            const img = new Image();
            img.src = props.styleOptions.image;
            await img.decode();
            context.drawImage(img, 4, 0, 24, 24);
          } else {
            let style;
            const { radius } = props.styleOptions.image;
            const options = {
              stroke: new Stroke({
                color: props.styleOptions.stroke.color,
                width: props.styleOptions.stroke.width,
              }),
              fill: new Fill({
                color: props.styleOptions.fill,
              }),
              radius,
            };
            if (props.styleOptions.points) {
              options.radius2 = props.styleOptions.image.radius2;
              options.angle = props.styleOptions.image.angle;
              options.points = props.styleOptions.image.points;
              style = new RegularShape(options);
            } else {
              style = new Circle(options);
            }
            const regularCanvas = style.getImage(1);
            const paddingShare = 2;
            const diameter = radius * 2;
            context.drawImage(
              regularCanvas,
              regularCanvas.width / 2 - radius * paddingShare,
              regularCanvas.height / 2 - radius * paddingShare,
              diameter * paddingShare,
              diameter * paddingShare,
              4, // because the canvas aint no square
              0,
              24,
              24,
            );
            shapeImage.value = regularCanvas.toDataURL(); // TODO: Remove when not needed
          }
        }
      }
      watch(
        () => props.styleOptions,
        () => {
          drawImage();
        },
        { deep: true },
      );
      onMounted(() => drawImage());
      return {
        canvas,
        shapeImage,
      };
    },
  };
</script>
