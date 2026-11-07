import { KICKS, AI_LEVELS, keeperMove } from './data.js';
import { clamp, lerp } from './util.js';

export const SPOT = { x: 0, y: 0.11, z: 11 };
export const GOAL_W = 3.66, GOAL_H = 2.44, BALL_R = 0.11;
export const kickOf = (id) => KICKS.find(k => k.id === id) || KICKS[0];

export function mulberry32(a) { return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Which goal-zone a point belongs to (world col -1/0/1, row 0/1/2)
export function zoneOf(x, y) { return { col: x < -1.3 ? -1 : x > 1.3 ? 1 : 0, row: y < 0.8 ? 0 : y < 1.7 ? 1 : 2 }; }

export function makeDive(col, row, shift, start) {
  const mv = keeperMove(col, row, shift);
  return { col, row, shift: !!shift, mv, start };
}

// Pure + deterministic from (shot, dive, kicker, gk): both online clients compute the same result.
export function resolveShot(shot, dive, kicker, gk) {
  const K = kickOf(shot.type), rnd = mulberry32(shot.seed | 0);
  const gauss = () => { let u = 0; for (let i = 0; i < 4; i++) u += rnd(); return (u - 2) * 1.73; };
  const p = clamp(shot.power, 0, 1), skill = (kicker.acc || 80) / 100;
  let sig = K.err * (1.45 - 0.75 * skill) * (shot.errMul || 1);
  if (p >= 0.72 && p <= 0.9) sig *= 0.6; else if (p < 0.72) sig *= 1 + (0.72 - p) * 0.9; else sig *= 1 + (p - 0.9) * 14;
  let ay = shot.ay; if (K.maxY) ay = Math.min(ay, K.maxY);
  const tx = shot.ax + gauss() * sig, ty = ay + gauss() * sig * 0.8 + (p > 0.9 ? (p - 0.9) * 6 : 0);
  const speed = K.speed * (0.62 + 0.38 * Math.min(1, p / 0.88)) * (K.id === 'panenka' ? 1 : (0.94 + 0.12 * (kicker.pow || 80) / 100));
  const dx = tx - SPOT.x, dy = ty - SPOT.y, dz = -SPOT.z;
  const T = Math.hypot(dx, dy, dz) / speed;
  const side = Math.sign(tx) || 1;
  const ax = K.curve * side * (0.6 + 0.5 * (kicker.fin || 80) / 100);
  const v0 = { x: dx / T - 0.5 * ax * T, y: dy / T + 4.9 * T, z: dz / T };
  const res = { K, tx, ty, T, ax, v0, speed, wob: K.wob || 0, ph: rnd() * 6.28 };

  const inside = Math.abs(tx) < GOAL_W - 0.07 && ty > 0.05 && ty < GOAL_H - 0.07;
  const nearPost = Math.abs(Math.abs(tx) - GOAL_W) < 0.17 && ty < GOAL_H + 0.17 && ty > 0;
  const nearBar = Math.abs(ty - GOAL_H) < 0.17 && Math.abs(tx) < GOAL_W;

  // keeper reach at the moment the ball crosses the line
  const mv = dive.mv, pr = clamp((T - dive.start) / mv.dur), e = 1 - (1 - pr) ** 2;
  const gks = 0.9 + ((gk.r || 80) - 70) * 0.006;
  const cx = lerp(0, mv.x, e), cy = lerp(1.0, mv.y, e);
  const rx = lerp(0.55, mv.rx, e) * gks, ry = lerp(0.95, mv.ry, e) * gks;
  const d = ((tx - cx) / rx) ** 2 + ((ty - cy) / ry) ** 2;
  let saved = false;
  const roll = rnd(), roll2 = rnd(), roll3 = rnd();
  if (d < 0.7) saved = true; else if (d < 1) saved = roll < (1 - d) / 0.3;
  res.d = d; res.keeperAt = { x: cx, y: cy };
  if (inside || nearPost || nearBar) {
    if (saved) res.outcome = (res.speed < 22 && d < 0.5 && roll2 < 0.8) ? 'catch' : 'parry';
    else if (!inside && nearPost) res.outcome = roll3 < 0.28 ? 'goal' : 'post';
    else if (!inside && nearBar) res.outcome = roll3 < 0.28 ? 'goal' : 'bar';
    else res.outcome = 'goal';
  } else res.outcome = Math.abs(tx) > GOAL_W ? 'wide' : 'over';
  res.rnd = [rnd(), rnd(), rnd(), rnd()];
  return res;
}

// ---- AI
export function aiShot(kicker, level) {
  const L = AI_LEVELS[level], r = Math.random;
  const pool = ['place', 'place', 'power', 'power', 'finesse', 'trivela', 'knuckle', 'driven', 'rabona', 'panenka'];
  const w = pool[Math.floor(r() * pool.length)];
  const side = r() < 0.5 ? -1 : 1;
  const corner = r() < 0.7;
  let ax = corner ? side * (2.4 + r() * 0.9) : (r() - 0.5) * 2.4;
  let ay = r() < 0.55 ? 0.25 + r() * 0.5 : 1.55 + r() * 0.65;
  if (w === 'panenka') { ax = (r() - 0.5) * 0.6; ay = 1.6 + r() * 0.4; }
  return { type: w, ax, ay, power: 0.76 + r() * 0.12, seed: (r() * 2 ** 31) | 0, errMul: L.kerr, kickerIdx: 0 };
}

export function aiDive(shot, level) {
  const L = AI_LEVELS[level], r = Math.random;
  const K = kickOf(shot.type);
  let read = L.read * (K.id === 'panenka' ? 0.35 : K.id === 'knuckle' ? 0.8 : 1);
  let col, row;
  if (r() < read) {
    const z = zoneOf(shot.ax, shot.ay); col = z.col; row = z.row;
    if (r() < 0.2) row = clamp(row + (r() < 0.5 ? -1 : 1), 0, 2);
  } else {
    const q = r(); col = q < 0.4 ? -1 : q < 0.6 ? 0 : 1;
    const q2 = r(); row = q2 < 0.45 ? 0 : q2 < 0.8 ? 1 : 2;
    if (K.id === 'panenka' && r() < 0.8) col = r() < 0.5 ? -1 : 1;
  }
  const shift = r() < 0.2 + (level * 0.04);
  return makeDive(col, row, shift, L.start + (r() - 0.5) * 0.06);
}
