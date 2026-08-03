// Writing instance matrices straight into the buffer. Composing 60+ Object3Ds
// a frame is the kind of thing that quietly eats a mid-tier Android.

/** Yaw-only rotation + per-axis scale + translation, column-major, in place. */
export function writeMatrix(arr, i, x, y, z, yaw, sx, sy, sz) {
  const o = i * 16;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  arr[o] = c * sx; arr[o + 1] = 0; arr[o + 2] = -s * sx; arr[o + 3] = 0;
  arr[o + 4] = 0; arr[o + 5] = sy; arr[o + 6] = 0; arr[o + 7] = 0;
  arr[o + 8] = s * sz; arr[o + 9] = 0; arr[o + 10] = c * sz; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}

/** Same, plus a lean about X and Z for hats that should not be standing up. */
export function writeLeaningMatrix(arr, i, x, y, z, yaw, lean, leanDir, sx, sy, sz) {
  const o = i * 16;
  const cy = Math.cos(yaw), sy2 = Math.sin(yaw);
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const lx = Math.cos(leanDir), lz = Math.sin(leanDir);

  // Rotate about the horizontal axis (lz, 0, -lx) by `lean`, then yaw.
  const ax = lz, az = -lx;
  const t = 1 - cl;
  // Rodrigues for an axis in the XZ plane.
  const r00 = t * ax * ax + cl, r01 = -sl * az, r02 = t * ax * az;
  const r10 = sl * az, r11 = cl, r12 = -sl * ax;
  const r20 = t * ax * az, r21 = sl * ax, r22 = t * az * az + cl;

  // yaw * lean
  const m00 = cy * r00 + sy2 * r20, m01 = cy * r01 + sy2 * r21, m02 = cy * r02 + sy2 * r22;
  const m10 = r10, m11 = r11, m12 = r12;
  const m20 = -sy2 * r00 + cy * r20, m21 = -sy2 * r01 + cy * r21, m22 = -sy2 * r02 + cy * r22;

  arr[o] = m00 * sx; arr[o + 1] = m10 * sx; arr[o + 2] = m20 * sx; arr[o + 3] = 0;
  arr[o + 4] = m01 * sy; arr[o + 5] = m11 * sy; arr[o + 6] = m21 * sy; arr[o + 7] = 0;
  arr[o + 8] = m02 * sz; arr[o + 9] = m12 * sz; arr[o + 10] = m22 * sz; arr[o + 11] = 0;
  arr[o + 12] = x; arr[o + 13] = y; arr[o + 14] = z; arr[o + 15] = 1;
}
