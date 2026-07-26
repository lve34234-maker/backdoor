import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';

// Handles renderer / camera / composer setup, resize handling and the
// quality presets used by the Settings screen.

const GRAIN_SHADER = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAmount: { value: 0.05 },
    uBrightness: { value: 1.0 }
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uAmount;
    uniform float uBrightness;
    varying vec2 vUv;
    float rand(vec2 co) {
      return fract(sin(dot(co.xy, vec2(12.9898,78.233))) * 43758.5453);
    }
    void main() {
      vec4 color = texture2D(tDiffuse, vUv);
      color.rgb *= uBrightness;
      float grain = (rand(vUv * uTime) - 0.5) * uAmount;
      color.rgb += grain;
      float d = distance(vUv, vec2(0.5));
      color.rgb *= smoothstep(0.9, 0.35, d) * 0.5 + 0.5;
      gl_FragColor = color;
    }
  `
};

export class SceneManager {
  constructor(canvas) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x050502);
    this.scene.fog = new THREE.FogExp2(0x2a2410, 0.045);

    this.camera = new THREE.PerspectiveCamera(82, window.innerWidth / window.innerHeight, 0.05, 120);
    this.camera.position.set(0, 1.7, 0);

    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;

    this.composer = new EffectComposer(this.renderer);
    this.renderPass = new RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      0.55, 0.5, 0.85
    );
    this.composer.addPass(this.bloomPass);

    this.grainPass = new ShaderPass(GRAIN_SHADER);
    this.composer.addPass(this.grainPass);

    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);

    window.addEventListener('resize', () => this.onResize());
    this._time = 0;

    this.setGraphicsQuality('high');
  }

  onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloomPass.setSize(w, h);
  }

  setFOV(fov) {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  setBrightness(v) {
    this.grainPass.uniforms.uBrightness.value = v;
  }

  setGraphicsQuality(level) {
    if (level === 'low') {
      this.renderer.shadowMap.enabled = false;
      this.bloomPass.enabled = false;
      this.renderer.setPixelRatio(1);
    } else if (level === 'medium') {
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.35;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    } else {
      this.renderer.shadowMap.enabled = true;
      this.bloomPass.enabled = true;
      this.bloomPass.strength = 0.55;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
  }

  render(dt) {
    this._time += dt;
    this.grainPass.uniforms.uTime.value = this._time * 60.0;
    this.composer.render();
  }
}
