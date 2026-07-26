# audio/

BACKDOOR generates all of its sound effects and ambience procedurally at
runtime via the Web Audio API (see `src/system/AudioManager.js`), so no
binary audio files are checked into the repository. This folder exists so
you can drop in your own `.ogg`/`.mp3` assets and wire them up in
`AudioManager` if you'd rather use recorded sound instead of synthesis.
