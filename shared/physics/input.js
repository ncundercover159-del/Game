// Input frame shared by client, server and AI: { steer: -1..1, btn: bitmask }.
export const BTN = {
  ACCEL: 1,
  BRAKE: 2,
  DRIFT: 4,
  ITEM: 8,
  TRICK: 16,
  LOOK: 32,   // look back (camera) / aim items backward
  REV: 64,    // explicit throttle press (used for the start boost)
  BACK: 128,  // fire item backward
  FWD: 256,   // throw droppable items (peels) forward
};

export const emptyInput = () => ({ steer: 0, btn: 0 });

export function quantizeInput(inp) {
  // steer is sent as an int8 so client prediction and server agree exactly
  const s = Math.max(-127, Math.min(127, Math.round(inp.steer * 127)));
  return { steer: s / 127, btn: inp.btn & 0xffff };
}
