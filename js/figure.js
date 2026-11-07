import * as THREE from 'three';
import { teamLuma } from './data.js';

const S = Math.sin, C = Math.cos, PI = Math.PI;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const ease = t => { t = clamp(t); return t * t * (3 - 2 * t); };
const easeOut = t => 1 - (1 - clamp(t)) ** 2;

// ---------- shared geometry / materials ----------
const G = {
  torso: new THREE.BoxGeometry(0.42, 0.56, 0.24), pelvis: new THREE.BoxGeometry(0.36, 0.16, 0.22),
  uArm: new THREE.CapsuleGeometry(0.052, 0.2, 4, 8), fArm: new THREE.CapsuleGeometry(0.044, 0.2, 4, 8),
  hand: new THREE.SphereGeometry(0.052, 8, 6), glove: new THREE.SphereGeometry(0.08, 8, 6),
  thigh: new THREE.CapsuleGeometry(0.075, 0.24, 4, 8), shorts: new THREE.CylinderGeometry(0.098, 0.108, 0.27, 10),
  shin: new THREE.CapsuleGeometry(0.055, 0.26, 4, 8), foot: new THREE.BoxGeometry(0.1, 0.08, 0.27),
  head: new THREE.SphereGeometry(0.115, 16, 12), hairCap: new THREE.SphereGeometry(0.124, 14, 8, 0, PI * 2, 0, PI * 0.55),
  afro: new THREE.SphereGeometry(0.15, 12, 10), neck: new THREE.CylinderGeometry(0.05, 0.055, 0.09, 8),
  hairBack: new THREE.BoxGeometry(0.2, 0.2, 0.08), collar: new THREE.TorusGeometry(0.06, 0.016, 6, 12),
};
const mats = new Map();
function M(c) { if (!mats.has(c)) mats.set(c, new THREE.MeshStandardMaterial({ color: c, roughness: 0.75, metalness: 0.0 })); return mats.get(c); }
function mesh(g, c, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(g, M(c)); m.position.set(x, y, z); m.castShadow = true; return m; }

function numberTexture(name, num, color) {
  const cv = document.createElement('canvas'); cv.width = cv.height = 128;
  const x = cv.getContext('2d'); x.clearRect(0, 0, 128, 128);
  x.fillStyle = color; x.textAlign = 'center';
  x.font = 'bold 22px Arial'; x.fillText((name || '').split(' ').pop().toUpperCase().slice(0, 11), 64, 28);
  x.font = 'bold 82px Arial'; x.fillText(String(num ?? ''), 64, 108);
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

// o: {kit,shorts,socks,skin,hair,hairStyle,boots,num,name,gk,glove}
export function makeFigure(o) {
  const f = { group: new THREE.Group(), base: { x: 0, y: 0, z: 0, yaw: 0 }, rig: {}, opts: o, anim: null };
  const R = f.rig;
  const body = new THREE.Group(); body.position.y = 0.97; f.group.add(body); R.body = body;
  body.add(mesh(G.pelvis, o.shorts, 0, 0.02, 0));
  const torso = new THREE.Group(); body.add(torso); R.torso = torso;
  torso.add(mesh(G.torso, o.kit, 0, 0.31, 0));
  const tc = teamLuma(o.kit) > 0.55 ? '#111' : '#fff';
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.34), new THREE.MeshBasicMaterial({ map: numberTexture(o.name, o.num, tc), transparent: true }));
  plate.position.set(0, 0.32, -0.123); plate.rotation.y = PI; torso.add(plate);
  const neck = mesh(G.neck, o.skin, 0, 0.62, 0); torso.add(neck);
  const head = new THREE.Group(); head.position.set(0, 0.64, 0); torso.add(head); R.head = head;
  head.add(mesh(G.head, o.skin, 0, 0.13, 0));
  const hs = o.hairStyle;
  if (hs === 0 || hs === 3) head.add(mesh(G.hairCap, o.hair, 0, 0.135, -0.005));
  if (hs === 3) head.add(mesh(G.hairBack, o.hair, 0, 0.12, -0.1));
  if (hs === 2) head.add(mesh(G.afro, o.hair, 0, 0.18, -0.015));
  // face hints
  const eyeM = new THREE.MeshBasicMaterial({ color: 0x111111 });
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.012, 6, 6), eyeM); e.position.set(sx * 0.04, 0.15, 0.105); head.add(e); }

  const armColor = o.gk ? o.kit : o.kit;
  function arm(side) {
    const sh = new THREE.Group(); sh.position.set(side * 0.27, 0.5, 0); torso.add(sh);
    sh.add(mesh(G.uArm, armColor, 0, -0.15, 0));
    const el = new THREE.Group(); el.position.set(0, -0.29, 0); sh.add(el);
    el.add(mesh(G.fArm, o.skin, 0, -0.14, 0));
    el.add(mesh(o.gk ? G.glove : G.hand, o.gk ? (o.glove || 0xffffff) : o.skin, 0, -0.31, 0));
    const hand = new THREE.Object3D(); hand.position.set(0, -0.33, 0.05); el.add(hand);
    return { sh, el, hand };
  }
  const aL = arm(1), aR = arm(-1);
  R.shL = aL.sh; R.elL = aL.el; R.shR = aR.sh; R.elR = aR.el; f.handL = aL.hand; f.handR = aR.hand;

  function leg(side) {
    const hp = new THREE.Group(); hp.position.set(side * 0.1, -0.02, 0); body.add(hp);
    hp.add(mesh(G.shorts, o.shorts, 0, -0.12, 0));
    hp.add(mesh(G.thigh, o.skin, 0, -0.27, 0));
    const kn = new THREE.Group(); kn.position.set(0, -0.46, 0); hp.add(kn);
    kn.add(mesh(G.shin, o.socks, 0, -0.22, 0));
    const an = new THREE.Group(); an.position.set(0, -0.44, 0); kn.add(an);
    an.add(mesh(G.foot, o.boots, 0, -0.03, 0.07));
    return { hp, kn, an };
  }
  const lL = leg(1), lR = leg(-1);
  R.hpL = lL.hp; R.knL = lL.kn; R.anL = lL.an; R.hpR = lR.hp; R.knR = lR.kn; R.anR = lR.an;
  setPose(f, {});
  return f;
}

export function setPose(f, p) {
  const R = f.rig, b = f.base;
  f.group.position.set(b.x + (p.ox || 0), b.y + (p.oy || 0), b.z + (p.oz || 0));
  f.group.rotation.y = b.yaw + (p.oyaw || 0);
  R.body.position.y = 0.97 + (p.by || 0);
  R.body.rotation.set(p.flipX || 0, 0, p.rollZ || 0);
  R.torso.rotation.set(p.lean || 0, p.twist || 0, p.tilt || 0);
  R.head.rotation.set(p.head || 0, p.headY || 0, p.headZ || 0);
  const a = p.aL || [0, 0, 0], c = p.aR || [0, 0, 0], l = p.legL || [0, 0, 0], r = p.legR || [0, 0, 0];
  R.shL.rotation.set(-a[0], 0, a[1]); R.elL.rotation.set(-a[2], 0, 0);
  R.shR.rotation.set(-c[0], 0, -c[1]); R.elR.rotation.set(-c[2], 0, 0);
  R.hpL.rotation.set(-l[0], 0, l[1]); R.knL.rotation.x = l[2]; R.anL.rotation.x = p.footL || 0;
  R.hpR.rotation.set(-r[0], 0, -r[1]); R.knR.rotation.x = r[2]; R.anR.rotation.x = p.footR || 0;
}

export function disposeFigure(f) { if (f && f.group.parent) f.group.parent.remove(f.group); }

// ============================ ANIMATIONS ============================
export function runPose(ph, amp = 1) {
  const s = S(ph), c = C(ph);
  return {
    legL: [0.95 * s * amp, 0.04, Math.max(0, -c) * 1.4 * amp + 0.15],
    legR: [-0.95 * s * amp, 0.04, Math.max(0, c) * 1.4 * amp + 0.15],
    aL: [-0.85 * s * amp, 0.12, 1.2], aR: [0.85 * s * amp, 0.12, 1.2],
    lean: 0.2 * amp, by: -0.03 - 0.03 * Math.abs(c) * amp, twist: 0.12 * s * amp,
  };
}
export function idlePose(t) {
  return { by: 0.004 * S(t * 2), aL: [0.02, 0.1, 0.1], aR: [0.02, 0.1, 0.1], legL: [0, 0.03, 0.02], legR: [0, 0.03, 0.02], head: 0.02 * S(t) };
}
export function standHips(t) { return { aL: [0, 0.35, 0.2], aR: [0, 0.35, 0.2], legL: [0, 0.06, 0.02], legR: [0, 0.06, 0.02], head: 0.08 }; }
export function walkPose(t, spd = 5) { return runPose(t * spd, 0.35); }

// ----- Penalty kick (kicker faces -z). from/to world xz. kt = contact time (s)
export function kickAnim(style, kt, from, plant) {
  const runEnd = kt - 0.4;
  const dx = from.x - plant.x, dz = from.z - plant.z, dl = Math.hypot(dx, dz) || 1;
  const pre = { x: plant.x + dx / dl * 0.85, z: plant.z + dz / dl * 0.85 }; // position at start of plant
  const yawRun = Math.atan2(-dx, -dz); // facing along motion
  const yawDelta = Math.atan2(S(yawRun - PI), C(yawRun - PI)); // relative to base yaw PI
  const big = style === 'power' ? 1.25 : style === 'panenka' ? 0.55 : style === 'driven' ? 1.0 : 1.0;
  return (t) => {
    let p;
    if (t < runEnd) {
      let u = clamp(t / runEnd);
      if (style === 'panenka') { // stutter-step
        const g = u < 0.6 ? u / 0.6 * 0.82 : 0.82 + Math.max(0, S((u - 0.6) / 0.4 * PI * 1.5)) * 0.0 + (u - 0.6) / 0.4 * 0.18;
        u = g;
      }
      const spd = style === 'panenka' && t > runEnd * 0.6 ? 6 : 9.5;
      p = runPose(t * spd, style === 'panenka' && t > runEnd * 0.6 ? 0.45 : 1.0);
      p.ox = lerp(0, pre.x - from.x, easeOut(u) * 0.6 + u * 0.4);
      p.oz = lerp(0, pre.z - from.z, easeOut(u) * 0.6 + u * 0.4);
      p.oyaw = lerp(yawDelta, yawDelta * 0.6, u);
      if (style === 'panenka' && t > runEnd * 0.82) { p.by = -0.02 + 0.06 * S((t - runEnd * 0.82) * 14); }
    } else if (t < kt - 0.1) {
      const u = ease((t - runEnd) / (kt - 0.1 - runEnd));
      const leanBack = style === 'panenka' ? -0.18 : style === 'driven' ? 0.2 : -0.08;
      p = {
        ox: lerp(pre.x - from.x, plant.x - from.x + 0.02, u), oz: lerp(pre.z - from.z, plant.z - from.z, u),
        oyaw: lerp(yawDelta * 0.6, 0, u), lean: leanBack * u, by: -0.06 * u,
        legL: [lerp(0.2, 0.28, u), 0.06, lerp(0.3, 0.55, u)], footL: 0,
        legR: [lerp(-0.4, -1.0 * big, u), 0.05, lerp(0.5, 1.6 * big, u)],
        aL: [0.2, lerp(0.3, 1.0, u), 0.3], aR: [-0.2, lerp(0.3, 0.9, u), 0.3], twist: 0.25 * u, head: 0.25 * u,
      };
      if (style === 'rabona') { p.legR = [lerp(-0.4, 0.2, u), lerp(0.05, -0.9, u), lerp(0.5, 1.9, u)]; p.twist = -0.5 * u; p.oyaw = lerp(yawDelta * 0.6, 0.15, u); }
      if (style === 'finesse') { p.legR[1] = -0.2 * u; }
      if (style === 'trivela') { p.legR[1] = 0.5 * u; }
    } else {
      const u = clamp((t - (kt - 0.1)) / 0.14);          // strike
      const w = clamp((t - kt) / 0.5);                    // follow-through settle
      const fw = style === 'panenka' ? 0.8 : style === 'knuckle' ? 0.9 : style === 'power' ? 1.7 : 1.35;
      const sw = easeOut(u);
      p = {
        ox: plant.x - from.x + 0.02, oz: plant.z - from.z - 0.5 * ease((t - kt + 0.1) / 0.5), oyaw: style === 'rabona' ? lerp(0.15, 0, w) : 0,
        lean: lerp(style === 'panenka' ? -0.18 : -0.08, style === 'panenka' ? -0.1 : 0.22, sw) * (1 - w * 0.6), by: lerp(-0.06, -0.02, sw) + 0.0,
        legL: [0.28, 0.06, 0.5], legR: [lerp(-1.0 * big, fw, sw), style === 'rabona' ? lerp(-0.9, -0.1, sw) : 0, lerp(1.6 * big, style === 'knuckle' ? 0.1 : 0.25, sw)],
        footR: style === 'trivela' ? -0.5 : 0.4 * sw,
        aL: [lerp(0.2, -0.3, sw), 1.0, 0.3], aR: [lerp(-0.2, 0.5, sw), 0.9, 0.3], twist: lerp(0.25, -0.3, sw) * (1 - w * 0.6), head: 0.3 * (1 - w),
      };
      if (style === 'rabona') p.twist = lerp(-0.5, 0.3, sw);
      if (style === 'finesse') p.legR[1] = lerp(-0.2, -0.45, sw);
      if (style === 'trivela') p.legR[1] = lerp(0.5, 0.2, sw);
      if (w > 0.6) { // settle
        const k = (w - 0.6) / 0.4;
        p.legR = [lerp(p.legR[0], 0.15, k), lerp(p.legR[1], 0.04, k), lerp(p.legR[2], 0.3, k)];
      }
    }
    return p;
  };
}

// ----- Goalkeeper
export function keeperReady(t) {
  return { by: -0.2 + 0.015 * S(t * 4), ox: 0.18 * S(t * 2.2), lean: 0.28, head: -0.2,
    legL: [0.35, 0.28, 0.9], legR: [0.35, 0.28, 0.9], aL: [0.6, 0.75, 0.7], aR: [0.6, 0.75, 0.7] };
}
// tc = seconds since contact; dive = {mv, start}
export function keeperDive(dive, tc) {
  const mv = dive.mv, p = clamp((tc - dive.start) / mv.dur), e = easeOut(p);
  if (tc < dive.start) return keeperReady(tc + 5);
  const base = keeperReady(0);
  if (mv.kind === 'dive') {
    const sg = mv.sg;
    const thMax = mv.row === 0 ? 1.38 : mv.row === 1 ? 1.15 : 0.85;
    const hxF = mv.x - sg * 1.12 * S(thMax), hyF = Math.max(0.3, mv.y - 1.12 * C(thMax));
    const th = thMax * e;
    // landing after the dive finishes
    const q = clamp((tc - dive.start - mv.dur) / 0.35);
    const hy = lerp(0.97 - 0.2, hyF, e) + (mv.row === 2 ? 0.28 * S(PI * p) : 0.12 * S(PI * p));
    const hyEnd = lerp(hy, 0.27, ease(q));
    const thEnd = lerp(th, Math.min(PI / 2 - 0.05, thMax + 0.3), ease(q));
    return {
      ox: e * hxF, by: hyEnd - 0.97, rollZ: -sg * thEnd, lean: lerp(0.28, 0, e), head: -0.2,
      aL: [lerp(0.6, 2.95, e), 0.15, 0.1], aR: [lerp(0.6, 2.95, e), 0.15, 0.1],
      legL: [lerp(0.35, -0.25, e), lerp(0.28, 0.2, e), lerp(0.9, 0.3, e)], legR: [lerp(0.35, -0.35, e), lerp(0.28, 0.1, e), lerp(0.9, 0.5, e)],
    };
  }
  if (mv.kind === 'jump') {
    return { ...base, by: lerp(-0.2, 0, e) + 0.75 * S(PI * p), lean: lerp(0.28, 0, e), aL: [lerp(0.6, 3.0, e), 0.2, 0.1], aR: [lerp(0.6, 3.0, e), 0.2, 0.1],
      legL: [0.1, 0.12, lerp(0.9, 1.0, e)], legR: [0.1, 0.12, lerp(0.9, 1.0, e)] };
  }
  if (mv.kind === 'crouch') {
    return { ...base, by: lerp(-0.2, -0.5, e), lean: 0.35, aL: [lerp(0.6, 0.2, e), lerp(0.75, 1.0, e), 0.2], aR: [lerp(0.6, 0.2, e), lerp(0.75, 1.0, e), 0.2],
      legL: [1.1, 0.5, 1.9], legR: [1.1, 0.5, 1.9] };
  }
  // spread
  return { ...base, ox: 0.0, by: lerp(-0.2, -0.1, e) + 0.12 * S(PI * p), lean: 0.1, aL: [0.2, lerp(0.75, 1.5, e), 0.1], aR: [0.2, lerp(0.75, 1.5, e), 0.1],
    legL: [0.1, lerp(0.28, 0.55, e), 0.5], legR: [0.1, lerp(0.28, 0.55, e), 0.5] };
}
export function keeperCheer(t) {
  const b = Math.abs(S(t * 6));
  return { by: 0.08 * b - 0.05, lean: -0.1, head: -0.3, aL: [2.3, 0.5, 1.9], aR: [1.2 + 0.6 * S(t * 6), 0.4, 2.3], legL: [0.1, 0.2, 0.2], legR: [0.1, 0.2, 0.2], oyaw: 0.2 * S(t * 2) };
}
export function sadPose(t) {
  return { by: -0.04, lean: 0.3, head: 0.45, aL: [2.5, 0.35, 2.3], aR: [2.5, 0.35, 2.3], legL: [0, 0.08, 0.1], legR: [0, 0.08, 0.1], twist: 0.12 * S(t * 1.3) };
}
export function hipsPose(t) {
  return { lean: 0.22, head: 0.4, aL: [0.1, 0.6, 1.9], aR: [0.1, 0.6, 1.9], legL: [0, 0.08, 0.1], legR: [0, 0.08, 0.1] };
}
export function refPose(t) {
  return { aL: [0.1, 0.1, 0.2], aR: [1.0 + 0.04 * S(t), 0.2, 1.3], head: 0.05, legL: [0, 0.05, 0.02], legR: [0, 0.05, 0.02] };
}

// ----- Celebrations. t seconds. Figure faces +z (toward the cutscene camera). Offsets are world.
function leadRun(t, dur, dist, amp = 1.1) {
  const u = clamp(t / dur);
  const p = runPose(t * 10, amp * (1 - 0.35 * ease((u - 0.7) / 0.3)));
  p.oz = dist * (1 - (1 - u) ** 1.6); return p;
}
export const CEL = {
  siu(t) {
    if (t < 1.2) return leadRun(t, 1.2, 5.2);
    const jt = (t - 1.2) / 0.75;
    if (jt < 1) {
      const p = runPose(10 * 1.2, 0.5);
      return { ...p, oz: 5.2 + jt * 0.6, oy: 1.15 * S(PI * jt), oyaw: ease(jt) * PI * 2, aL: [0.3, 1.0, 0.4], aR: [0.3, 1.0, 0.4], legL: [0.5, 0.2, 1.1], legR: [-0.3, 0.2, 1.3], lean: 0, by: 0 };
    }
    const k = clamp((t - 1.95) / 0.25), b = t > 2.4 ? 0.02 * S((t - 2.4) * 7) : 0;
    return { oz: 5.8, by: -0.05 * (1 - k) - b, lean: -0.15, head: -0.3, aL: [0.0, lerp(0.5, 0.55, k), 0.15], aR: [0.0, lerp(0.5, 0.55, k), 0.15], legL: [0, 0.4, 0.12], legR: [0, 0.4, 0.12], oy: 0 };
  },
  slide(t) {
    if (t < 1.0) return leadRun(t, 1.0, 3.5);
    const u = clamp((t - 1.0) / 0.9), sl = easeOut(u);
    if (u < 1 || t < 2.0) {
      return { oz: 3.5 + 3.4 * sl, by: lerp(-0.03, -0.52, ease(u * 3)), lean: lerp(0.2, -0.38, ease(u * 2)), head: -0.25,
        aL: [0.1, 1.45, 0.15], aR: [0.1, 1.45, 0.15], legL: [0.1, 0.12, 2.65], legR: [0.1, 0.12, 2.65] };
    }
    const f = S((t - 2.0) * 7);
    return { oz: 6.9, by: -0.52, lean: -0.35, head: -0.3, aL: [0.1, 1.45, 0.15], aR: [0.5 + 1.4 * Math.max(0, f), 0.5, 2.0], legL: [0.1, 0.12, 2.65], legR: [0.1, 0.12, 2.65] };
  },
  robot(t) {
    const q = (x, n) => Math.round(x * n) / n;
    const step = Math.floor(t * 3.2) % 4, hold = q(t, 6);
    const ph = step * PI / 2;
    const a = [[1.55, 0.1, 0.0], [0.0, 1.5, 0.0], [1.55, 0.6, 1.55], [2.6, 0.2, 0.0]];
    const A = a[step], B = a[(step + 2) % 4];
    const marching = Math.floor(t * 6.4) % 2;
    return { oz: 1.6 + 0.4 * S(hold * 1.4), by: -0.04, ox: 0.4 * q(S(hold * 1.1), 3), head: 0, headY: [0.6, 0, -0.6, 0][step], twist: [0.3, 0, -0.3, 0][step],
      aL: A, aR: B, legL: [marching ? 0.5 : 0, 0.1, marching ? 0.6 : 0.05], legR: [marching ? 0 : 0.5, 0.1, marching ? 0.05 : 0.6], lean: 0.05 };
  },
  cradle(t) {
    if (t < 1.1) return leadRun(t, 1.1, 3.8, 0.9);
    const r = S((t - 1.1) * 3);
    return { oz: 3.8, ox: 0.08 * r, tilt: 0.09 * r, by: -0.04 + 0.01 * S(t * 6), lean: 0.12, head: 0.45, headZ: 0.25 * r,
      aL: [0.9, -0.15, 1.95], aR: [0.8, -0.25, 2.1], legL: [0, 0.14, 0.12], legR: [0, 0.14, 0.12] };
  },
  flip(t) {
    if (t < 0.9) return leadRun(t, 0.9, 3.2);
    const jt = (t - 0.9) / 0.95;
    if (jt < 1) {
      const tuck = S(PI * clamp(jt * 1.1));
      return { oz: 3.2 - 1.0 * jt, oy: 1.35 * S(PI * jt), flipX: -2 * PI * ease(jt), by: 0.0, aL: [lerp(0.5, 1.8, tuck), 0.1, 0.4], aR: [lerp(0.5, 1.8, tuck), 0.1, 0.4],
        legL: [1.5 * tuck, 0.1, 2.0 * tuck], legR: [1.5 * tuck, 0.1, 2.0 * tuck] };
    }
    const k = clamp((t - 1.85) / 0.3);
    const f = S((t - 2.2) * 6);
    return { oz: 2.2, by: -0.12 * (1 - k) - 0.0, lean: -0.1, head: -0.3, aL: [0.0, 1.3 + 0.1 * f, 0.1], aR: [0.0, 1.3 - 0.1 * f, 0.1], legL: [0, 0.3, 0.1], legR: [0, 0.3, 0.1] };
  },
  griddy(t) {
    const ph = t * 8.5, s = S(ph), s2 = S(ph + PI);
    const r = clamp(t / 0.6);
    return { oz: 2.2 * ease(r), ox: 0.18 * S(ph / 2), by: -0.12 - 0.04 * Math.abs(s), lean: 0.08, tilt: 0.06 * s, twist: 0.2 * S(ph / 2), head: -0.1,
      legL: [0.1 * s, 0.38 + 0.08 * s, 0.7 + 0.55 * Math.max(0, s)], legR: [0.1 * s2, 0.38 + 0.08 * s2, 0.7 + 0.55 * Math.max(0, s2)],
      aL: [0.6 + 0.3 * s, 1.1, 0.7 + 0.5 * s2], aR: [0.6 + 0.3 * s2, 1.1, 0.7 + 0.5 * s] };
  },
  plane(t) {
    const w = t * 0.9;
    const ox = 3.4 * S(w), oz = 3.0 + 1.8 * (1 - C(w * 2)) * 0.5;
    const vx = 3.4 * 0.9 * C(w);
    const yaw = Math.atan2(vx, 1.5);
    const p = runPose(t * 9, 0.7);
    return { ...p, ox, oz, oyaw: yaw, rollZ: -0.38 * C(w) * 0.9, aL: [0, 1.5, 0.05], aR: [0, 1.5, 0.05], lean: 0.12, head: -0.05, headZ: 0 };
  },
  shush(t) {
    if (t < 1.0) return leadRun(t, 1.0, 3.6, 0.95);
    const s = S((t - 1.0) * 1.1);
    return { oz: 3.6, by: -0.06 + 0.005 * S(t * 3), lean: -0.1, head: -0.12, headY: 0.55 * s, aR: [1.85, 0.0, 2.55], aL: [0.2, 0.55, 1.9],
      legL: [0, 0.16, 0.08], legR: [0, 0.16, 0.08], twist: -0.1 * s };
  },
  meditate(t) {
    if (t < 0.9) return leadRun(t, 0.9, 3.4, 0.9);
    const u = ease((t - 0.9) / 0.8), br = S(t * 1.6);
    return { oz: 3.4, by: lerp(-0.03, -0.74, u) + 0.006 * br, lean: lerp(0.15, 0.02, u), head: lerp(0, 0.12, u), headZ: 0,
      aL: [lerp(0, 0.85, u), lerp(0.1, 0.35, u), lerp(0.1, 0.35, u)], aR: [lerp(0, 0.85, u), lerp(0.1, 0.35, u), lerp(0.1, 0.35, u)],
      legL: [lerp(0, 1.45, u), lerp(0.05, 0.8, u), lerp(0.1, 2.35, u)], legR: [lerp(0, 1.45, u), lerp(0.05, 0.8, u), lerp(0.1, 2.35, u)] };
  },
  cross(t) {
    if (t < 1.0) return leadRun(t, 1.0, 3.6, 1.0);
    return { oz: 3.6, by: -0.03, lean: -0.12, head: -0.28, headY: 0.12 * S(t * 0.8),
      aL: [0.85, -0.55, 2.35], aR: [0.95, -0.55, 2.35], legL: [0, 0.16, 0.05], legR: [0, 0.16, 0.05] };
  },
};
export const CEL_DUR = { siu: 4.6, slide: 4.4, robot: 4.4, cradle: 4.6, flip: 4.4, griddy: 4.4, plane: 5.2, shush: 4.4, meditate: 5.0, cross: 4.4 };
