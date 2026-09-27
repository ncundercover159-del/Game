// Wire format helpers shared by client and server.

export const TICK_HZ = 20;          // snapshot broadcast rate
export const SIM_HZ = 60;          // physics step rate
export const GRACE_MS = 30000;     // reconnect window
export const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O

const q = (v) => Math.round(v * 1000) / 1000;

// Player state -> compact array: [x,y,z,vx,vy,vz,yaw,flags,sq,ack,ev,land,bx,bz]
export function packPlayer(p, ack, ev) {
  const flags = (p.g ? 1 : 0) | (p.act ? 2 : 0) | (p.sqd ? 4 : 0);
  return [q(p.x), q(p.y), q(p.z), q(p.vx), q(p.vy), q(p.vz), q(p.yaw), flags, q(p.sq), ack, ev, q(p.land || 0), q(p.bx || 0), q(p.bz || 0)];
}

export function unpackPlayer(a, into) {
  into.x = a[0]; into.y = a[1]; into.z = a[2];
  into.vx = a[3]; into.vy = a[4]; into.vz = a[5]; into.yaw = a[6];
  into.g = a[7] & 1; into.act = (a[7] >> 1) & 1; into.sqd = (a[7] >> 2) & 1;
  into.sq = a[8];
  into.ack = a[9];
  into.ev = a[10];
  into.land = a[11];
  into.bx = a[12];
  into.bz = a[13];
  return into;
}
