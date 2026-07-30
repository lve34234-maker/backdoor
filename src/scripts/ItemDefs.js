// Every item type the player can find, either on the floor or by
// searching a drawer. "key" is the only one placed deliberately (tied to
// locked doors); everything else can turn up as random drawer loot.
// Shared between Game.js (effects/logic) and ui/HUD.js (icons/labels) so
// the two never drift out of sync.
export const ITEM_DEFS = {
  battery: { label: '배터리', icon: '🔋' },
  health: { label: '구급 키트', icon: '✚' },
  bandage: { label: '붕대', icon: '🩹' },
  snack: { label: '에너지바', icon: '🍫' },
  water: { label: '생수', icon: '💧' },
  energy_drink: { label: '에너지 드링크', icon: '🥤' },
  lighter: { label: '라이터', icon: '🔥' },
  key: { label: '열쇠', icon: '🔑' },
  photo: { label: '오래된 사진', icon: '📷', flavor: '누군가의 웃는 얼굴... 여기와는 어울리지 않는다.' },
  cassette: { label: '카세트 테이프', icon: '📼', flavor: '잡음 속에서 희미한 목소리가 들리는 것 같다.' },
  map_fragment: { label: '지도 조각', icon: '🗺️', flavor: '출구로 가는 단서일지도 모른다.' },
  compass: { label: '나침반', icon: '🧭', flavor: '바늘이 미세하게 떨리며 계속 돈다.' }
};

export const DRAWER_LOOT_ITEMS = ['battery', 'health', 'bandage', 'snack', 'water', 'energy_drink', 'lighter', 'photo', 'cassette', 'map_fragment', 'compass'];

// Items that sit in the inventory until the player manually uses them
// from the Tab panel. Everything else (key, collectibles) has no manual
// "use" action - a key is consumed automatically at a locked door, and
// collectibles are just flavour.
export const USABLE_ITEM_TYPES = new Set(['battery', 'health', 'bandage', 'snack', 'water', 'energy_drink', 'lighter']);
