# models/

BACKDOOR builds every entity and prop from procedural Three.js primitive
geometry (see `src/entities/EntityDefinitions.js` and
`src/rooms/HidingSpots.js`), so no `.glb`/`.gltf`/`.fbx` model files are
checked into the repository. This folder exists so you can drop in your
own 3D models and load them with `GLTFLoader` if you want higher-fidelity
visuals than the primitive-based look.
