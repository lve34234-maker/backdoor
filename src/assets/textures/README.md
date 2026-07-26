# textures/

BACKDOOR paints all of its wall/ceiling/carpet/door/metal textures
procedurally on an HTML canvas at runtime (see
`src/scripts/TextureFactory.js`), so no binary image files are checked
into the repository. This folder exists so you can drop in your own
texture images and load them with `THREE.TextureLoader` instead of the
procedural textures if you want a different look.
