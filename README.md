# draw

The draw plugin utilizes the editor of the @vcmap/core to allow users to create simple geometries in the cesium, the openlayers and the oblique map.
In the cesium map, surface geometries can be extruded into 3D volumes.
The user can modify the style, the properties and the geometry.
It also supports the import and export of GeoJSON files.
All geometries are listed in "My Workspace", where they can be renamed, deleted, edited and exported.
Furthermore the context menu allows to perform different actions on the geometries.

## Configuration

This plugin provides the following configurations

| Key             | Type     | Default                                                             | Description                                                                                                    |
| --------------- | -------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `altitudeModes` | string[] | `['clampToGround', 'clampToTerrain', 'clampTo3DTiles', 'absolute']` | The altitude modes to provide to the user. May be any value given to `VectorPropertiesOptions['altitudeMode']` |
