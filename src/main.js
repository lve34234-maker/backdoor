import { Game } from './scripts/Game.js';

const canvas = document.getElementById('game-canvas');
window.__BACKDOOR__ = new Game(canvas);
