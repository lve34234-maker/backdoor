// Shared difficulty/progression constants used by both room generation
// and hazard selection. The surface run is doors 1-99; clearing door 99
// doesn't end the game - it drops the player into a harder "basement"
// continuation (internal doorIndex 100-199, shown to the player as floors
// -1 through -100) before the real ending.
export const TOTAL_DOORS = 99;
export const TOTAL_BASEMENT_FLOORS = 100;
export const FINAL_DOOR_INDEX = TOTAL_DOORS + TOTAL_BASEMENT_FLOORS;

// Danger scaling saturates at 1.0 across the surface run (same curve as
// before), then keeps climbing well past 1 through the basement so it
// reads as meaningfully harder rather than "the same as late-game".
export function dangerFactor(doorIndex, divisor) {
  if (doorIndex <= TOTAL_DOORS) return Math.min(1, doorIndex / divisor);
  return 1 + (doorIndex - TOTAL_DOORS) / 40;
}

export function isBasement(doorIndex) {
  return doorIndex > TOTAL_DOORS;
}

export function basementFloor(doorIndex) {
  return Math.max(0, doorIndex - TOTAL_DOORS);
}

// The number painted on a door's plate / shown in the HUD: 1-99 on the
// surface, then negative floor numbers (-1 through -100) in the basement.
export function doorDisplayNumber(doorIndex) {
  return doorIndex <= TOTAL_DOORS ? doorIndex : -(doorIndex - TOTAL_DOORS);
}
