// Generic object pool used for entities / decorative props so that moving
// between chunks doesn't constantly allocate and garbage-collect meshes.

export class ObjectPool {
  constructor(factory, reset, initialSize = 0) {
    this.factory = factory;
    this.reset = reset;
    this.free = [];
    for (let i = 0; i < initialSize; i++) this.free.push(factory());
  }

  acquire(...args) {
    const obj = this.free.pop() || this.factory(...args);
    if (this.reset) this.reset(obj, ...args);
    return obj;
  }

  release(obj) {
    this.free.push(obj);
  }

  clear() {
    this.free.length = 0;
  }
}
