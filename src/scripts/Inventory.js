const MAX_SLOTS = 12;

export class Inventory {
  constructor() {
    this.items = []; // { id, type, label, icon }
  }

  add(item) {
    if (this.items.length >= MAX_SLOTS) return false;
    this.items.push(item);
    return true;
  }

  hasKey(keyId) {
    return this.items.some((i) => i.type === 'key' && (keyId ? i.keyId === keyId : true));
  }

  useKey(keyId) {
    const idx = this.items.findIndex((i) => i.type === 'key' && (keyId ? i.keyId === keyId : true));
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  countOf(type) {
    return this.items.filter((i) => i.type === type).length;
  }

  removeOne(type) {
    const idx = this.items.findIndex((i) => i.type === type);
    if (idx === -1) return false;
    this.items.splice(idx, 1);
    return true;
  }

  serialize() {
    return this.items.map((i) => ({ ...i }));
  }

  restore(list) {
    this.items = Array.isArray(list) ? list.map((i) => ({ ...i })) : [];
  }

  clear() { this.items = []; }
}
