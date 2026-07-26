import * as THREE from 'three';

// Procedurally paints canvas textures for the Backrooms aesthetic so the
// project ships with zero binary image assets. Results are cached because
// generating canvases is comparatively expensive.

const cache = new Map();

function withCache(key, builder) {
  if (cache.has(key)) return cache.get(key);
  const tex = builder();
  cache.set(key, tex);
  return tex;
}

function noise(ctx, w, h, amount, alphaBase = 255) {
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] = clamp(d[i] + n);
    d[i + 1] = clamp(d[i + 1] + n);
    d[i + 2] = clamp(d[i + 2] + n);
  }
  ctx.putImageData(imgData, 0, 0);
}

function clamp(v) { return Math.max(0, Math.min(255, v)); }

export function wallTexture(seed = 1) {
  return withCache(`wall_${seed}`, () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#c9b64a';
    ctx.fillRect(0, 0, size, size);

    // Vertical wallpaper seams
    ctx.strokeStyle = 'rgba(120,105,20,0.35)';
    ctx.lineWidth = 2;
    for (let x = 0; x < size; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }

    // Random water stains
    for (let i = 0; i < 6; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      const r = 20 + Math.random() * 60;
      const grad = ctx.createRadialGradient(rx, ry, 0, rx, ry, r);
      grad.addColorStop(0, 'rgba(90,80,20,0.25)');
      grad.addColorStop(1, 'rgba(90,80,20,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(rx, ry, r, 0, Math.PI * 2);
      ctx.fill();
    }

    noise(ctx, size, size, 14);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function ceilingTexture() {
  return withCache('ceiling', () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#cfcfc2';
    ctx.fillRect(0, 0, size, size);

    const tiles = 4;
    const tileSize = size / tiles;
    ctx.strokeStyle = 'rgba(60,60,50,0.5)';
    ctx.lineWidth = 3;
    for (let i = 0; i <= tiles; i++) {
      ctx.beginPath();
      ctx.moveTo(i * tileSize, 0);
      ctx.lineTo(i * tileSize, size);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * tileSize);
      ctx.lineTo(size, i * tileSize);
      ctx.stroke();
    }

    // Fluorescent panel hint in a random tile
    const tx = Math.floor(Math.random() * tiles) * tileSize;
    const ty = Math.floor(Math.random() * tiles) * tileSize;
    ctx.fillStyle = 'rgba(255,250,210,0.9)';
    ctx.fillRect(tx + tileSize * 0.15, ty + tileSize * 0.35, tileSize * 0.7, tileSize * 0.3);

    noise(ctx, size, size, 8);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function carpetTexture(seed = 1) {
  return withCache(`carpet_${seed}`, () => {
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5b3b32';
    ctx.fillRect(0, 0, size, size);

    ctx.strokeStyle = 'rgba(30,15,10,0.4)';
    for (let i = 0; i < 40; i++) {
      ctx.lineWidth = 1 + Math.random() * 2;
      ctx.beginPath();
      const x = Math.random() * size;
      ctx.moveTo(x, 0);
      ctx.lineTo(x + (Math.random() - 0.5) * 30, size);
      ctx.stroke();
    }

    // Diamond pattern typical of Backrooms carpet
    ctx.strokeStyle = 'rgba(120,80,40,0.25)';
    ctx.lineWidth = 3;
    const step = 64;
    for (let y = -step; y < size + step; y += step) {
      for (let x = -step; x < size + step; x += step) {
        ctx.beginPath();
        ctx.moveTo(x, y + step / 2);
        ctx.lineTo(x + step / 2, y);
        ctx.lineTo(x + step, y + step / 2);
        ctx.lineTo(x + step / 2, y + step);
        ctx.closePath();
        ctx.stroke();
      }
    }

    noise(ctx, size, size, 18);

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  });
}

export function metalTexture() {
  return withCache('metal', () => {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#5a5c5f';
    ctx.fillRect(0, 0, size, size);
    for (let y = 0; y < size; y += 8) {
      ctx.fillStyle = `rgba(255,255,255,${0.02 + Math.random() * 0.03})`;
      ctx.fillRect(0, y, size, 2);
    }
    noise(ctx, size, size, 20);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    return tex;
  });
}

export function doorTexture(color = '#7a5a2e') {
  return withCache(`door_${color}`, () => {
    const w = 256, h = 512;
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 6;
    ctx.strokeRect(20, 30, w - 40, h * 0.4);
    ctx.strokeRect(20, h * 0.45, w - 40, h * 0.48);
    ctx.fillStyle = 'rgba(210,190,140,0.9)';
    ctx.beginPath();
    ctx.arc(w - 40, h / 2, 8, 0, Math.PI * 2);
    ctx.fill();
    noise(ctx, w, h, 10);
    const tex = new THREE.CanvasTexture(canvas);
    return tex;
  });
}
