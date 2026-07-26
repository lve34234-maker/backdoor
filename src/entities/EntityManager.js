import { Entity } from './Entity.js';

export class EntityManager {
  constructor(scene) {
    this.scene = scene;
    this.active = [];
  }

  spawnForChunk(chunk, difficulty = {}) {
    this.clear();
    if (!chunk.entitySpawn) return;
    const { type, position } = chunk.entitySpawn;
    const entity = new Entity(type, position, difficulty);
    this.scene.add(entity.mesh);
    this.active.push(entity);
  }

  spawnAt(type, position, difficulty = {}) {
    const entity = new Entity(type, position, difficulty);
    this.scene.add(entity.mesh);
    this.active.push(entity);
    return entity;
  }

  clear() {
    this.active.forEach((e) => this.scene.remove(e.mesh));
    this.active = [];
  }

  update(dt, ctx) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const entity = this.active[i];
      entity.update(dt, ctx);
      if (entity.dead) {
        this.scene.remove(entity.mesh);
        this.active.splice(i, 1);
      }
    }
  }

  get count() { return this.active.length; }
}
