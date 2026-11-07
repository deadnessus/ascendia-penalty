import * as THREE from 'three';

function rng(seed) { let a = seed; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

function pitchTexture() {
  const PX = 20, W = 68, L = 60, z0 = -8;
  const cv = document.createElement('canvas'); cv.width = W * PX; cv.height = L * PX;
  const x = cv.getContext('2d');
  for (let i = 0; i < 12; i++) { x.fillStyle = i % 2 ? '#2f8a3c' : '#379a45'; x.fillRect(0, i * 5 * PX, cv.width, 5 * PX + 1); }
  // grass noise
  const r = rng(7);
  for (let i = 0; i < 9000; i++) { x.fillStyle = `rgba(${r() < .5 ? '0,40,0' : '200,255,180'},${0.025 + r() * 0.03})`; x.fillRect(r() * cv.width, r() * cv.height, 2 + r() * 6, 2); }
  const X = m => (m + 34) * PX, Z = m => (m - z0) * PX;
  x.strokeStyle = '#f2f2f2'; x.lineWidth = 5; x.fillStyle = '#f2f2f2';
  const rect = (x1, z1, x2, z2) => x.strokeRect(X(x1), Z(z1), (x2 - x1) * PX, (z2 - z1) * PX);
  x.beginPath(); x.moveTo(X(-34), Z(0)); x.lineTo(X(34), Z(0)); x.stroke();            // goal line
  rect(-20.16, 0, 20.16, 16.5); rect(-9.16, 0, 9.16, 5.5);
  x.beginPath(); x.arc(X(0), Z(11), 0.28 * PX, 0, 7); x.fill();                        // spot
  x.beginPath(); const a = Math.acos(5.5 / 9.15); x.arc(X(0), Z(11), 9.15 * PX, a, Math.PI - a); x.stroke(); // D
  x.beginPath(); x.moveTo(X(-34), Z(52)); x.lineTo(X(34), Z(52)); x.stroke();
  x.beginPath(); x.arc(X(0), Z(52), 9.15 * PX, Math.PI, Math.PI * 2); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t;
}

function adTexture() {
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 64; const x = cv.getContext('2d');
  const cols = ['#0b1a4a', '#12336e', '#0b1a4a', '#4a0b2e'];
  const labels = ['ASCENDIA PENALTYS', 'CHAMPIONS NIGHT', 'ASCENDIA', 'PENALTY SHOOTOUT'];
  for (let i = 0; i < 4; i++) {
    x.fillStyle = cols[i]; x.fillRect(i * 512, 0, 512, 64);
    x.fillStyle = '#fff'; x.font = 'italic 800 34px Arial'; x.textAlign = 'center'; x.fillText(labels[i], i * 512 + 256, 44);
    x.fillStyle = '#31e0ff'; x.fillRect(i * 512, 58, 512, 6);
  }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}

export function ballTexture() {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128; const x = cv.getContext('2d');
  x.fillStyle = '#fafafa'; x.fillRect(0, 0, 256, 128);
  x.fillStyle = '#1a1a1f';
  const pts = [[32, 24], [96, 24], [160, 24], [224, 24], [64, 64], [128, 64], [192, 64], [0, 64], [32, 104], [96, 104], [160, 104], [224, 104]];
  for (const [px, py] of pts) { x.beginPath(); for (let k = 0; k < 6; k++) { const an = k / 6 * Math.PI * 2; x.lineTo(px + Math.cos(an) * 14, py + Math.sin(an) * 12); } x.fill(); }
  x.strokeStyle = '#31e0ff'; x.lineWidth = 2; x.beginPath(); x.moveTo(0, 44); x.lineTo(256, 44); x.moveTo(0, 84); x.lineTo(256, 84); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function buildStadium(scene, quality = 1) {
  const out = { uni: { uTime: { value: 0 }, uExcite: { value: 0 } } };
  scene.background = new THREE.Color(0x060b1a);
  scene.fog = new THREE.Fog(0x0a1226, 80, 210);

  scene.add(new THREE.HemisphereLight(0xcfe3ff, 0x1d3a22, 0.95));
  const sun = new THREE.DirectionalLight(0xfff6e8, 1.5); sun.position.set(14, 32, 28);
  sun.castShadow = quality > 0; sun.shadow.mapSize.set(quality > 1 ? 4096 : 2048, quality > 1 ? 4096 : 2048);
  const sc = sun.shadow.camera; sc.left = -17; sc.right = 17; sc.top = 17; sc.bottom = -17; sc.near = 5; sc.far = 90; sun.shadow.bias = -0.0004;
  sun.target.position.set(0, 0, 7); scene.add(sun, sun.target);
  const fill = new THREE.DirectionalLight(0x9db8ff, 0.45); fill.position.set(-20, 15, -20); scene.add(fill);

  // ground
  const big = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x0f2414, roughness: 1 }));
  big.rotation.x = -Math.PI / 2; big.position.y = -0.03; scene.add(big);
  const pitch = new THREE.Mesh(new THREE.PlaneGeometry(68, 60), new THREE.MeshStandardMaterial({ map: pitchTexture(), roughness: 0.95 }));
  pitch.rotation.x = -Math.PI / 2; pitch.position.set(0, 0, 22); pitch.receiveShadow = true; scene.add(pitch);

  // goal
  const goal = new THREE.Group(); scene.add(goal); out.goal = goal;
  const white = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.4 });
  const post = (x) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 2.44, 12), white); m.position.set(x, 1.22, 0); m.castShadow = true; goal.add(m); };
  post(-3.66); post(3.66);
  const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 7.44, 12), white); bar.rotation.z = Math.PI / 2; bar.position.set(0, 2.44, 0); bar.castShadow = true; goal.add(bar);
  // net
  const lines = [];
  const D = 2.1, TOPD = 1.9, GW = 3.66;
  const seg = (a, b) => lines.push(...a, ...b);
  for (let x = -GW; x <= GW + 0.01; x += 0.305) { seg([x, 0, -D], [x, TOPD, -D]); seg([x, 2.44, 0], [x, TOPD, -D]); }
  for (let y = 0; y <= TOPD + 0.01; y += 0.305) seg([-GW, y, -D], [GW, y, -D]);
  for (let z = 0; z >= -D; z -= 0.305) seg([-GW, 2.44 - (2.44 - TOPD) * (-z / D), z], [GW, 2.44 - (2.44 - TOPD) * (-z / D), z]);
  for (const sx of [-GW, GW]) {
    for (let y = 0; y <= TOPD + 0.01; y += 0.305) seg([sx, y, 0], [sx, Math.min(y, TOPD), -D]);
    for (let z = 0; z >= -D; z -= 0.305) seg([sx, 0, z], [sx, 2.44 - (2.44 - TOPD) * (-z / D), z]);
  }
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
  out.netMat = new THREE.LineBasicMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.55 });
  goal.add(new THREE.LineSegments(lg, out.netMat));
  // backstays
  const dark = new THREE.MeshStandardMaterial({ color: 0x222831 });
  for (const sx of [-GW, GW]) { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.9, 6), dark); m.position.set(sx, 1.2, -D * 0.5); m.rotation.x = Math.PI / 2.6; goal.add(m); }

  // ad boards
  const adT = adTexture(); out.adTex = adT;
  const ads = (w, x, z, ry) => { const t = adT.clone(); t.needsUpdate = true; t.repeat.set(w / 16, 1); const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9), new THREE.MeshBasicMaterial({ map: t })); m.position.set(x, 0.45, z); m.rotation.y = ry; scene.add(m); (out.adMeshes ||= []).push(t); };
  ads(68, 0, -7, 0); ads(68, 0, 52, Math.PI); ads(60, -34.5, 22, Math.PI / 2); ads(60, 34.5, 22, -Math.PI / 2);

  // stands + crowd
  const dens = quality === 0 ? 1.0 : quality === 1 ? 0.7 : 0.55;
  const body = new THREE.BoxGeometry(0.34, 0.6, 0.26), head = new THREE.SphereGeometry(0.12, 6, 5);
  const crowdMat = (col) => {
    const m = new THREE.MeshLambertMaterial({ color: col });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = out.uni.uTime; sh.uniforms.uExcite = out.uni.uExcite;
      sh.vertexShader = 'uniform float uTime; uniform float uExcite;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        `#include <begin_vertex>
         float ph = instanceMatrix[3].x*0.9 + instanceMatrix[3].z*1.7;
         transformed.y += max(0.0, sin(uTime*(3.0+uExcite*5.0)+ph))*(0.03+uExcite*0.3);`);
    };
    return m;
  };
  const placements = [];
  const stand = (ox, oz, ax, az, bx, bz, len, rows) => { // along (ax,az), away from pitch (bx,bz)
    const rowD = 1.05, rowH = 0.72;
    for (let i = 0; i < rows; i++) {
      const h = (i + 1) * rowH;
      const step = new THREE.Mesh(new THREE.BoxGeometry(Math.abs(ax) * len + Math.abs(bx) * rowD, h, Math.abs(az) * len + Math.abs(bz) * rowD), new THREE.MeshStandardMaterial({ color: 0x3a4152, roughness: 1 }));
      step.position.set(ox + bx * (i * rowD + rowD / 2), h / 2, oz + bz * (i * rowD + rowD / 2)); scene.add(step);
      const r = rng(i * 131 + Math.floor(ox + oz * 3));
      for (let u = -len / 2; u < len / 2; u += 0.62 * (1 / dens) * 0.9) {
        const jx = (r() - .5) * 0.2, jz = (r() - .5) * 0.2;
        placements.push([ox + ax * u + bx * (i * rowD + rowD * 0.5) + jx, h + 0.3, oz + az * u + bz * (i * rowD + rowD * 0.5) + jz]);
      }
    }
    // roof edge glow
  };
  const R = 15;
  stand(0, -8, 1, 0, 0, -1, 74, R);          // behind goal
  stand(0, 53, 1, 0, 0, 1, 74, R);            // behind kicker
  stand(-35, 22, 0, 1, -1, 0, 62, R);
  stand(35, 22, 0, 1, 1, 0, 62, R);
  const n = placements.length;
  const bodies = new THREE.InstancedMesh(body, crowdMat(0xffffff), n), heads = new THREE.InstancedMesh(head, crowdMat(0xffffff), n);
  const dummy = new THREE.Object3D(), r = rng(99);
  const skin = [0xf3d2b3, 0xe5b48c, 0xc98d5f, 0x9a6239, 0x6b4226];
  for (let i = 0; i < n; i++) {
    const p = placements[i]; dummy.position.set(p[0], p[1], p[2]); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
    dummy.position.y += 0.45; dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
    heads.setColorAt(i, new THREE.Color(skin[Math.floor(r() * skin.length)]));
  }
  scene.add(bodies, heads); out.crowd = { bodies, heads, n };
  out.setCrowdColors = (a, b) => {
    const r2 = rng(5), c = new THREE.Color(), pal = [0xffffff, 0x222222, 0x888888, 0xd9c9a0];
    for (let i = 0; i < n; i++) { const q = r2(); c.setHex(q < 0.4 ? a : q < 0.8 ? b : pal[Math.floor(r2() * pal.length)]); bodies.setColorAt(i, c); }
    bodies.instanceColor.needsUpdate = true;
  };
  out.setCrowdColors(0xc8102e, 0x2255cc);

  // floodlight towers
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x2c333f }), lampMat = new THREE.MeshBasicMaterial({ color: 0xfffbe6 });
  for (const [x, z] of [[-48, -18], [48, -18], [-48, 62], [48, 62]]) {
    const t = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.8, 42, 8), towerMat); t.position.set(x, 21, z); scene.add(t);
    const panel = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 0.6), lampMat); panel.position.set(x, 43, z); panel.lookAt(0, 20, 20); scene.add(panel);
  }
  // corner flags
  for (const [x, z] of [[-34, 0], [34, 0]]) { const f = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.5, 6), white); f.position.set(x, 0.75, z); scene.add(f); const fl = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshBasicMaterial({ color: 0xffd400, side: THREE.DoubleSide })); fl.position.set(x + 0.18, 1.35, z); scene.add(fl); }

  // ball
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.11, 24, 16), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.45 }));
  ball.castShadow = true; scene.add(ball); out.ball = ball;

  out.update = (time, excite) => {
    out.uni.uTime.value = time; out.uni.uExcite.value = excite;
    for (const t of out.adMeshes) t.offset.x = (time * 0.04) % 1;
  };
  return out;
}
