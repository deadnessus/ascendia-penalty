import * as THREE from 'three';
import { TEAMS, ALL_PLAYERS, ALL_KEEPERS, KICKS, CELEBRATIONS, AI_LEVELS, SKIN_TONES, HAIR_COLORS, GK_KITS, lookFor, keeperMove, teamLuma } from './data.js';
import { makeFigure, setPose, disposeFigure, idlePose, standHips, keeperReady, keeperDive, keeperCheer, sadPose, hipsPose, refPose, kickAnim, CEL, CEL_DUR, clamp, lerp, ease } from './figure.js';
import { buildStadium } from './stadium.js';
import { Sound } from './audio.js';
import { Net } from './net.js';
import { SPOT, kickOf, resolveShot, aiShot, aiDive, makeDive } from './logic.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const V3 = THREE.Vector3;
const hex = (c) => '#' + c.toString(16).padStart(6, '0');
const unhex = (s) => parseInt(s.slice(1), 16);
const store = {
  get(k, d) { try { const v = localStorage.getItem('ascendia.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('ascendia.' + k, JSON.stringify(v)); } catch {} },
};
const ABORT = Symbol('abort');
const DEBUG = { force: null }; // dev hook used by automated tests

// ---------------------------------------------------------------- state
let opts = { music: 50, ai: 2, shots: 5, gfx: 1, vol: 70, crowd: true, assist: true, shake: true, skip: true, ...store.get('opts', {}) };
let sel = { a: 'rma', b: 'mci', cel: 'siu', sig: true, ...store.get('sel', {}) };
let myPlayers = store.get('players', []);
let myTeams = store.get('teams', []);
let assign = store.get('assign', {});
const saveAll = () => { store.set('opts', opts); store.set('sel', sel); store.set('players', myPlayers); store.set('teams', myTeams); store.set('assign', assign); };

// ---------------------------------------------------------------- three setup
const canvas = $('#gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 500);
const stadium = buildStadium(scene, opts.gfx);
const ball = { mesh: stadium.ball, pos: new V3(SPOT.x, SPOT.y, SPOT.z), vel: new V3(), mode: 'rest', flight: null, res: null, holder: null, inGoal: false };
stadium.ball.position.copy(ball.pos);
const sound = new Sound(); sound.vol = opts.vol / 100; sound.crowdOn = opts.crowd; sound.musicVol = opts.music / 100;

function applyGfx() {
  const pr = opts.gfx === 0 ? 1 : Math.min(window.devicePixelRatio || 1, opts.gfx === 1 ? 1.5 : 2);
  renderer.setPixelRatio(pr); resize();
}
function resize() { renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize);

// ---------------------------------------------------------------- clock + helpers
let T = 0, paused = false, excite = 0;
let match = null;
const figs = [];
function play(f, fn, t0 = T) { f.anim = { fn, t0 }; }
function addFig(f) { scene.add(f.group); figs.push(f); return f; }
function dropFig(f) { if (!f) return; disposeFigure(f); const i = figs.indexOf(f); if (i >= 0) figs.splice(i, 1); }
const nextFrame = () => new Promise(r => requestAnimationFrame(r));
async function sleep(s) { const end = T + s; while (T < end) { await nextFrame(); if (match && match.dead) throw ABORT; } }
let skipFlag = false;
async function skippable(s, minWait = 0.9) { const t0 = T; skipFlag = false; while (T - t0 < s) { await nextFrame(); if (match && match.dead) throw ABORT; if (skipFlag && opts.skip && T - t0 > minWait) break; } skipFlag = false; }

// ---------------------------------------------------------------- camera rig
const cam = { pos: new V3(0, 6, 30), look: new V3(0, 1, 0), fov: 45, fn: null, k: 3.5, tp: new V3(0, 6, 30), tl: new V3(0, 1, 0), tf: 45, shake: 0 };
function camCut() { cam.fn && cam.fn(0.016); cam.pos.copy(cam.tp); cam.look.copy(cam.tl); cam.fov = cam.tf; }
function updateCam(dt) {
  if (cam.fn) cam.fn(dt);
  const a = 1 - Math.exp(-cam.k * dt);
  cam.pos.lerp(cam.tp, a); cam.look.lerp(cam.tl, a); cam.fov += (cam.tf - cam.fov) * a;
  camera.position.copy(cam.pos);
  if (cam.shake > 0 && opts.shake) { camera.position.x += (Math.random() - .5) * cam.shake; camera.position.y += (Math.random() - .5) * cam.shake; }
  cam.shake = Math.max(0, cam.shake - dt * 1.4);
  camera.lookAt(cam.look);
  const asp = innerWidth / innerHeight;
  camera.fov = asp < 1.5 ? cam.fov * (1 + (1.5 - asp) * 0.5) : cam.fov;
  camera.updateProjectionMatrix();
}

// ---------------------------------------------------------------- teams / players
function findPlayer(id) { return ALL_PLAYERS.find(p => p.id === id) || myPlayers.find(p => p.id === id); }
function findGK(id) { return ALL_KEEPERS.find(p => p.id === id); }
function buildTeam(id) {
  const t = TEAMS.find(x => x.id === id);
  if (t) { const extra = (assign[id] || []).map(findPlayer).filter(Boolean); return { id: t.id, name: t.name, short: t.short, kit: t.kit, shorts: t.shorts, trim: t.trim, players: [...extra, ...t.players].slice(0, 8), gk: t.gk }; }
  const c = myTeams.find(x => x.id === id);
  if (c) { const ps = c.pids.map(findPlayer).filter(Boolean); return { id: c.id, name: c.name, short: c.short, kit: c.kit, shorts: c.shorts, trim: c.trim, players: ps.length ? ps : TEAMS[0].players.slice(0, 5), gk: findGK(c.gkId) || TEAMS[0].gk, custom: true }; }
  return buildTeam('rma');
}
const allTeamIds = () => [...myTeams.map(t => t.id), ...TEAMS.map(t => t.id)];
function figOpts(team, pl, isGk) {
  const look = pl.look || lookFor(pl.name);
  const gk = GK_KITS[(team.short.charCodeAt(0) + team.short.charCodeAt(team.short.length - 1)) % GK_KITS.length];
  return { kit: isGk ? gk : team.kit, shorts: isGk ? 0x151515 : team.shorts, socks: isGk ? 0x151515 : team.trim, skin: SKIN_TONES[look.skin ?? 0], hair: HAIR_COLORS[look.hair ?? 0], hairStyle: look.hairStyle ?? 0, boots: look.boots ?? 0x111111, num: pl.num, name: pl.name, gk: isGk, glove: 0xffffff };
}
function crestHTML(t, big) {
  const dark = teamLuma(t.kit) < 0.5;
  return `<div class="crest ${big ? 'big' : ''}" style="background:${hex(t.kit)};border-color:${hex(t.trim === t.kit ? t.shorts : t.trim)};color:${dark ? '#fff' : '#111'}">${t.short}</div>`;
}

// ---------------------------------------------------------------- showcase (menu 3D)
let show = null, menuCamMode = 'main';
function setShowcase(team, pl, celId) {
  if (show) dropFig(show.fig);
  if (!team) { show = null; return; }
  const fig = makeFigure(figOpts(team, pl, false)); fig.base = { x: 0, y: 0, z: 4.5, yaw: 0 }; addFig(fig);
  show = { fig, celId, t0: T };
}
function refreshShowcase() {
  const team = buildTeam(sel.a), pl = (assign[sel.a] && findPlayer(assign[sel.a][0])) || myPlayers[0] || team.players[0];
  setShowcase(team, pl, sel.cel);
}
function menuCam() {
  cam.k = 2.2;
  cam.fn = () => {
    const tt = T - (show ? show.t0 : 0);
    if (menuCamMode === 'player') {
      const a = Math.sin(T * 0.3) * 0.7, R = 4.4;
      cam.tp.set(Math.sin(a) * R, 1.3, 4.5 + Math.cos(a) * R);
      cam.tl.set(0, 1.0, 4.5).addScaledVector(new V3(Math.cos(a), 0, -Math.sin(a)), -1.15); cam.tf = 38;
    } else {
      const a = 0.35 + 0.35 * Math.sin(T * 0.22);
      const R = 7.4, cx = 0, cz = 8.2;
      cam.tp.set(cx + Math.sin(a) * R, 1.5, cz + Math.cos(a) * R);
      const right = new V3(Math.cos(a), 0, -Math.sin(a));
      cam.tl.set(cx, 1.1, cz).addScaledVector(right, -1.5); cam.tf = 38;
    }
  };
}

// ---------------------------------------------------------------- UI: screens
function showScreen(id) {
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 'screen-' + id));
  $('#hud').classList.add('hidden');
  if (id === 'main') { menuCamMode = 'main'; refreshShowcase(); renderCelGrid(); }
  else if (id === 'player') { menuCamMode = 'player'; renderPlayerForm(); renderSavedPlayers(); }
  else { menuCamMode = 'main'; if (show) { dropFig(show.fig); show = null; } }
  if (id === 'team') renderTeamSelect();
  if (id === 'builder') { renderBuilder(); renderSavedTeams(); }
  if (id === 'online') { $('#online-team').textContent = buildTeam(sel.a).name; onlineStep('choose'); }
  menuCam();
  if (id === 'main' || id === 'player') camCut();
}
document.addEventListener('click', (e) => {
  const g = e.target.closest('[data-go]'); if (g) { e.preventDefault(); sound.init(); sound.click(); showScreen(g.dataset.go); }
  const a = e.target.closest('[data-act]'); if (a && a.dataset.act === 'options') { sound.init(); openOptions(); }
});

function renderCelGrid() {
  $('#cel-grid').innerHTML = CELEBRATIONS.map((c, i) => `<div class="cel ${c.id === sel.cel ? 'sel' : ''}" data-id="${c.id}" title="${c.desc}"><span class="n">${i + 1}</span><div class="ic">${c.icon}</div><div class="nm">${c.name}</div><div class="ds">${c.desc}</div></div>`).join('');
  $$('#cel-grid .cel').forEach(el => el.onclick = () => { sound.init(); sound.click(); sel.cel = el.dataset.id; saveAll(); renderCelGrid(); refreshShowcase(); });
  $('#sig-toggle').checked = sel.sig;
  $('#main-note').innerHTML = `Rosters &amp; ratings are approximations (not official FIFA/EA/UEFA data) — edit in My Team / My Player.`;
}
$('#sig-toggle').onchange = (e) => { sel.sig = e.target.checked; saveAll(); };

function renderTeamSelect() {
  const lists = { a: $('#tl-a'), b: $('#tl-b') };
  for (const k of ['a', 'b']) {
    lists[k].innerHTML = allTeamIds().map(id => { const t = buildTeam(id); return `<div class="team ${sel[k] === id ? 'sel' : ''}" data-id="${id}">${crestHTML(t)}<div class="nm">${t.custom ? '★ ' : ''}${t.name}</div></div>`; }).join('');
    $$('.team', lists[k]).forEach(el => el.onclick = () => { sound.click(); sel[k] = el.dataset.id; saveAll(); renderTeamSelect(); });
  }
  const A = buildTeam(sel.a), B = buildTeam(sel.b);
  const sq = (t) => `<div class="squad"><b>Kick order</b><br>${t.players.slice(0, 5).map((p, i) => `${i + 1}. #${p.num} ${p.name} <small>(${p.r})</small>`).join('<br>')}<br><small>GK ${t.gk.name}</small></div>`;
  $('#team-preview').innerHTML = `<div>${crestHTML(A, true)}${sq(A)}</div><div class="vs">VS</div><div>${crestHTML(B, true)}${sq(B)}</div>`;
  $('#team-ai').textContent = `AI: ${AI_LEVELS[opts.ai].name} · ${opts.shots} shots`;
}
$('#team-opt-link').onclick = (e) => { e.preventDefault(); openOptions(); };
$('#btn-kickoff').onclick = () => {
  sound.init();
  const A = buildTeam(sel.a), B = buildTeam(sel.b);
  A.celPref = { sel: sel.cel, sig: sel.sig };
  B.celPref = { sel: CELEBRATIONS[Math.floor(Math.random() * CELEBRATIONS.length)].id, sig: true };
  startMatch({ teams: [A, B], mode: 'cpu', mySide: 0, shots: opts.shots });
};

// ---- options
function seg(el, items, cur, pick) {
  el.innerHTML = items.map((n, i) => `<button class="${i === cur ? 'sel' : ''}" data-i="${i}">${n}</button>`).join('');
  $$('button', el).forEach(b => b.onclick = () => { sound.click(); pick(+b.dataset.i); seg(el, items, +b.dataset.i, pick); });
}
function openOptions() {
  seg($('#opt-ai'), AI_LEVELS.map(l => l.name), opts.ai, i => { opts.ai = i; saveAll(); });
  seg($('#opt-shots'), ['3', '5', '7'], [3, 5, 7].indexOf(opts.shots), i => { opts.shots = [3, 5, 7][i]; saveAll(); });
  seg($('#opt-gfx'), ['Low', 'Medium', 'High'], opts.gfx, i => { opts.gfx = i; saveAll(); applyGfx(); });
  $('#opt-vol').value = opts.vol; $('#opt-music').value = opts.music; $('#opt-crowd').checked = opts.crowd; $('#opt-assist').checked = opts.assist; $('#opt-shake').checked = opts.shake; $('#opt-skip').checked = opts.skip;
  $('#options').classList.remove('hidden');
}
$('#opt-music').oninput = (e) => { opts.music = +e.target.value; sound.setMusicVol(opts.music / 100); saveAll(); };
$('#opt-vol').oninput = (e) => { opts.vol = +e.target.value; sound.setVol(opts.vol / 100); saveAll(); };
$('#opt-crowd').onchange = (e) => { opts.crowd = e.target.checked; sound.setCrowd(opts.crowd); saveAll(); };
$('#opt-assist').onchange = (e) => { opts.assist = e.target.checked; saveAll(); updatePowerUI(); };
$('#opt-shake').onchange = (e) => { opts.shake = e.target.checked; saveAll(); };
$('#opt-skip').onchange = (e) => { opts.skip = e.target.checked; saveAll(); };
$('#opt-close').onclick = () => { $('#options').classList.add('hidden'); if ($('#screen-team').classList.contains('active')) renderTeamSelect(); };

// ---- create a player
let draft = null;
function newDraft() { return { id: null, name: '', num: 99, skin: 1, hair: 1, hairStyle: 0, boots: 0xff5a00, pow: 82, fin: 82, acc: 82, cel: 'siu', team: 'none' }; }
const BUDGET = 255;
function renderPlayerForm() {
  draft ||= newDraft();
  const d = draft;
  const teamOpts = `<option value="none">Free agent (use in My Team)</option>` + allTeamIds().map(id => `<option value="${id}" ${d.team === id ? 'selected' : ''}>${buildTeam(id).name}</option>`).join('');
  const stat = (k, n) => `<div class="stat"><span>${n}</span><input type="range" min="50" max="99" value="${d[k]}" data-k="${k}"><b id="v-${k}">${d[k]}</b></div>`;
  $('#player-form').innerHTML = `
    <div class="rowflex"><div style="flex:2;min-width:160px"><label class="l">NAME</label><input type="text" id="pf-name" maxlength="22" value="${d.name.replace(/"/g, '&quot;')}" placeholder="Your player"></div>
    <div style="flex:1;min-width:80px"><label class="l">NUMBER</label><input type="number" id="pf-num" min="1" max="99" value="${d.num}"></div></div>
    <label class="l">SKIN</label><div class="swatches" id="pf-skin">${SKIN_TONES.map((c, i) => `<div class="sw ${d.skin === i ? 'sel' : ''}" data-i="${i}" style="background:${hex(c)}"></div>`).join('')}</div>
    <label class="l">HAIR STYLE</label><div class="rowflex" id="pf-hs">${['Short', 'Shaved', 'Afro', 'Long'].map((n, i) => `<span class="chip ${d.hairStyle === i ? 'sel' : ''}" data-i="${i}">${n}</span>`).join('')}</div>
    <label class="l">HAIR COLOUR</label><div class="swatches" id="pf-hair">${HAIR_COLORS.map((c, i) => `<div class="sw ${d.hair === i ? 'sel' : ''}" data-i="${i}" style="background:${hex(c)}"></div>`).join('')}</div>
    <label class="l">BOOTS</label><input type="color" id="pf-boots" value="${hex(d.boots)}">
    <label class="l">ATTRIBUTES <small id="pf-left"></small></label>${stat('pow', 'Power')}${stat('fin', 'Finesse')}${stat('acc', 'Accuracy')}
    <label class="l">SIGNATURE CELEBRATION</label><select id="pf-cel">${CELEBRATIONS.map(c => `<option value="${c.id}" ${d.cel === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}</select>
    <label class="l">ADD TO TEAM</label><select id="pf-team">${teamOpts}</select>
    <div class="rowflex" style="margin-top:16px"><button class="btn primary" id="pf-save">${d.id ? 'Update player' : 'Save player'}</button><button class="btn" id="pf-new">New</button></div>`;
  const left = () => { $('#pf-left').textContent = `(${BUDGET - d.pow - d.fin - d.acc} points left)`; }; left();
  $('#pf-name').oninput = e => { d.name = e.target.value; };
  $('#pf-num').oninput = e => { d.num = clamp(+e.target.value || 1, 1, 99); };
  $$('#pf-skin .sw').forEach(el => el.onclick = () => { d.skin = +el.dataset.i; previewDraft(); renderPlayerForm(); });
  $$('#pf-hair .sw').forEach(el => el.onclick = () => { d.hair = +el.dataset.i; previewDraft(); renderPlayerForm(); });
  $$('#pf-hs .chip').forEach(el => el.onclick = () => { d.hairStyle = +el.dataset.i; previewDraft(); renderPlayerForm(); });
  $('#pf-boots').oninput = e => { d.boots = unhex(e.target.value); previewDraft(); };
  $$('#player-form input[type=range]').forEach(el => el.oninput = () => {
    const k = el.dataset.k; let v = +el.value; const others = ['pow', 'fin', 'acc'].filter(x => x !== k).reduce((s, x) => s + d[x], 0);
    v = Math.min(v, BUDGET - others); v = Math.max(50, v); el.value = v; d[k] = v; $('#v-' + k).textContent = v; left();
  });
  $('#pf-cel').onchange = e => { d.cel = e.target.value; };
  $('#pf-team').onchange = e => { d.team = e.target.value; previewDraft(); };
  $('#pf-new').onclick = () => { draft = newDraft(); previewDraft(); renderPlayerForm(); };
  $('#pf-save').onclick = () => {
    if (!d.name.trim()) { $('#pf-name').focus(); return; }
    const p = { id: d.id || 'c' + Date.now(), name: d.name.trim(), num: d.num, pow: d.pow, fin: d.fin, acc: d.acc, r: Math.round((d.pow + d.fin + d.acc) / 3), cel: d.cel, custom: true, look: { skin: d.skin, hair: d.hair, hairStyle: d.hairStyle, boots: d.boots } };
    const i = myPlayers.findIndex(x => x.id === p.id); if (i >= 0) myPlayers[i] = p; else myPlayers.push(p);
    for (const k of Object.keys(assign)) assign[k] = assign[k].filter(x => x !== p.id);
    if (d.team !== 'none') { if (TEAMS.find(t => t.id === d.team)) (assign[d.team] ||= []).unshift(p.id); else { const ct = myTeams.find(t => t.id === d.team); if (ct && !ct.pids.includes(p.id)) ct.pids.unshift(p.id); } }
    d.id = p.id; saveAll(); renderSavedPlayers(); renderPlayerForm(); sound.init(); sound.tick();
  };
  previewDraft();
}
function previewDraft() {
  const d = draft; if (!d) return;
  const tid = d.team !== 'none' ? d.team : sel.a; const team = buildTeam(tid);
  if (show) dropFig(show.fig);
  const fig = makeFigure(figOpts(team, { name: d.name || 'YOU', num: d.num, look: { skin: d.skin, hair: d.hair, hairStyle: d.hairStyle, boots: d.boots } }, false));
  fig.base = { x: 0, y: 0, z: 4.5, yaw: 0 }; addFig(fig); show = { fig, celId: null, t0: T };
}
function playerTeamOf(id) { for (const k of Object.keys(assign)) if (assign[k].includes(id)) return k; const c = myTeams.find(t => t.pids.includes(id)); return c ? c.id : 'none'; }
function renderSavedPlayers() {
  const el = $('#player-saved');
  el.innerHTML = myPlayers.length ? myPlayers.map(p => `<div class="item"><span data-load="${p.id}" style="cursor:pointer"><b>#${p.num} ${p.name}</b><br><small>PWR ${p.pow} · FIN ${p.fin} · ACC ${p.acc} → ${buildTeam(playerTeamOf(p.id)).short || ''}</small></span><span class="x" data-del="${p.id}">✕</span></div>`).join('') : '<div class="note">No custom players yet. Build one and add them to any team!</div>';
  $$('[data-load]', el).forEach(b => b.onclick = () => { const p = myPlayers.find(x => x.id === b.dataset.load); draft = { id: p.id, name: p.name, num: p.num, skin: p.look.skin, hair: p.look.hair, hairStyle: p.look.hairStyle, boots: p.look.boots, pow: p.pow, fin: p.fin, acc: p.acc, cel: p.cel || 'siu', team: playerTeamOf(p.id) }; renderPlayerForm(); });
  $$('[data-del]', el).forEach(b => b.onclick = () => { const id = b.dataset.del; myPlayers = myPlayers.filter(p => p.id !== id); for (const k of Object.keys(assign)) assign[k] = assign[k].filter(x => x !== id); myTeams.forEach(t => t.pids = t.pids.filter(x => x !== id)); saveAll(); renderSavedPlayers(); });
}

// ---- team builder
let tb = null;
function newTB() { return { id: null, name: 'My Dream XI', short: 'MDX', kit: 0x7b5cff, shorts: 0x1a1a2e, trim: 0x31e0ff, pids: [], gkId: 'rma:gk', q: '' }; }
function renderBuilder() {
  tb ||= newTB(); const d = tb;
  const pool = [...myPlayers.map(p => ({ ...p, team: '★' })), ...ALL_PLAYERS].filter(p => p.name.toLowerCase().includes(d.q.toLowerCase()) || (p.team || '').toLowerCase().includes(d.q.toLowerCase()));
  $('#builder-form').innerHTML = `
    <div class="rowflex"><div style="flex:2;min-width:160px"><label class="l">TEAM NAME</label><input type="text" id="tb-name" maxlength="24" value="${d.name}"></div>
    <div style="flex:1;min-width:80px"><label class="l">SHORT</label><input type="text" id="tb-short" maxlength="3" value="${d.short}"></div></div>
    <div class="rowflex"><div><label class="l">SHIRT</label><input type="color" id="tb-kit" value="${hex(d.kit)}"></div><div><label class="l">SHORTS</label><input type="color" id="tb-shorts" value="${hex(d.shorts)}"></div><div><label class="l">TRIM / SOCKS</label><input type="color" id="tb-trim" value="${hex(d.trim)}"></div></div>
    <label class="l">GOALKEEPER</label><select id="tb-gk">${ALL_KEEPERS.map(g => `<option value="${g.id}" ${g.id === d.gkId ? 'selected' : ''}>${g.name} (${g.team}) — ${g.r}</option>`).join('')}</select>
    <label class="l">SQUAD — kick order (${d.pids.length}/8, min 5)</label>
    <div class="rowflex" id="tb-sel">${d.pids.map((id, i) => { const p = findPlayer(id); return p ? `<span class="chip sel" data-id="${id}">${i + 1}. ${p.name} ✕</span>` : ''; }).join('') || '<span class="note">Pick players below</span>'}</div>
    <label class="l">ADD REAL PLAYERS (search name or club)</label><input type="text" id="tb-q" placeholder="e.g. Haaland, ARS…" value="${d.q}">
    <div class="plist" id="tb-pool">${pool.slice(0, 80).map(p => `<div class="pi ${d.pids.includes(p.id) ? 'sel' : ''}" data-id="${p.id}"><span>#${p.num} ${p.name}</span><small>${p.team} · ${p.r}</small></div>`).join('')}</div>
    <div class="rowflex" style="margin-top:16px"><button class="btn primary" id="tb-save">${d.id ? 'Update team' : 'Save team'}</button><button class="btn" id="tb-new">New</button></div>`;
  $('#tb-name').oninput = e => { d.name = e.target.value; }; $('#tb-short').oninput = e => { d.short = e.target.value.toUpperCase(); };
  $('#tb-kit').oninput = e => { d.kit = unhex(e.target.value); }; $('#tb-shorts').oninput = e => { d.shorts = unhex(e.target.value); }; $('#tb-trim').oninput = e => { d.trim = unhex(e.target.value); };
  $('#tb-gk').onchange = e => { d.gkId = e.target.value; };
  $('#tb-q').oninput = e => { d.q = e.target.value; const pos = e.target.selectionStart; renderBuilder(); const q = $('#tb-q'); q.focus(); q.setSelectionRange(pos, pos); };
  const toggle = (id) => { const i = d.pids.indexOf(id); if (i >= 0) d.pids.splice(i, 1); else if (d.pids.length < 8) d.pids.push(id); renderBuilder(); };
  $$('#tb-pool .pi').forEach(el => el.onclick = () => toggle(el.dataset.id));
  $$('#tb-sel .chip').forEach(el => el.onclick = () => toggle(el.dataset.id));
  $('#tb-new').onclick = () => { tb = newTB(); renderBuilder(); };
  $('#tb-save').onclick = () => {
    if (d.pids.length < 5) { alert('Pick at least 5 players for the shootout.'); return; }
    const t = { id: d.id || 't' + Date.now(), name: d.name.trim() || 'My Team', short: (d.short || 'MYT').slice(0, 3).padEnd(3, 'X'), kit: d.kit, shorts: d.shorts, trim: d.trim, pids: [...d.pids], gkId: d.gkId };
    const i = myTeams.findIndex(x => x.id === t.id); if (i >= 0) myTeams[i] = t; else myTeams.push(t);
    d.id = t.id; saveAll(); renderSavedTeams(); renderBuilder(); sound.init(); sound.tick();
  };
}
function renderSavedTeams() {
  const el = $('#builder-saved');
  el.innerHTML = myTeams.length ? myTeams.map(t => `<div class="item"><span data-load="${t.id}" style="cursor:pointer">${crestHTML(t)}</span><span data-load="${t.id}" style="cursor:pointer;flex:1"><b>${t.name}</b><br><small>${t.pids.length} players</small></span><span class="x" data-del="${t.id}">✕</span></div>`).join('') : '<div class="note">No teams yet. Build a real-player dream team or a made-up club.</div>';
  $$('[data-load]', el).forEach(b => b.onclick = () => { const t = myTeams.find(x => x.id === b.dataset.load); tb = { ...t, pids: [...t.pids], q: '' }; renderBuilder(); });
  $$('[data-del]', el).forEach(b => b.onclick = () => { myTeams = myTeams.filter(t => t.id !== b.dataset.del); if (sel.a === b.dataset.del) sel.a = 'rma'; if (sel.b === b.dataset.del) sel.b = 'mci'; saveAll(); renderSavedTeams(); });
}

// ---------------------------------------------------------------- online
let net = null;
const setOnlineStatus = (h) => { $('#online-status').innerHTML = h; };
function serializeTeam(t) { return JSON.parse(JSON.stringify({ id: t.id, name: t.name, short: t.short, kit: t.kit, shorts: t.shorts, trim: t.trim, players: t.players, gk: t.gk })); }
function sendHello() { net.send({ t: 'hello', team: serializeTeam(buildTeam(sel.a)), pref: { sel: sel.cel, sig: sel.sig } }); }
function onlineDown() { if (match && !match.dead && match.mode === 'online') { alert('Opponent disconnected.'); quitMatch(); } else setOnlineStatus('Connection closed.'); }
function onlineStep(n) {
  for (const id of ['choose', 'host', 'join']) $('#on-' + id).classList.toggle('hidden', id !== n);
  $('#on-steps').textContent = n === 'choose' ? 'STEP 1 OF 3 · CHOOSE' : n === 'host' ? 'STEP 2 OF 3 · SHARE YOUR CODE' : 'STEP 2 OF 3 · ENTER THE CODE';
  setOnlineStatus('');
}
function onlineHelp(what, e) {
  const t = (e && (e.type || e.message)) || 'unknown';
  if (t === 'no-room') return '⚠ Room not found. Check the code, and ask your friend to keep their screen open.';
  if (t === 'full') return '⚠ This room already has two players.';
  return `⚠ Could not ${what} (${t}). The online server may not be available yet, or your connection dropped. Try again in a moment.`;
}
const mark = (ids, active) => ids.forEach((id, i) => { const el = $('#' + id); el.className = i < active ? 'done' : i === active ? 'on' : ''; });
$('#online-back').onclick = () => { if (net) { net.close(); net = null; } if (!$('#on-choose').classList.contains('hidden')) showScreen('main'); else onlineStep('choose'); };
$('#btn-join-step').onclick = () => { sound.init(); onlineStep('join'); mark(['j1', 'j2', 'j3'], -1); $('#join-code').focus(); };
$('#btn-copy').onclick = async () => { const c = $('#host-code').textContent; try { await navigator.clipboard.writeText(c); setOnlineStatus('Code copied!'); } catch { setOnlineStatus('Select the code and copy it.'); } };
$('#btn-host').onclick = async () => {
  sound.init(); onlineStep('host'); $('#host-code').textContent = '·····'; mark(['h1', 'h2', 'h3'], 0);
  if (net) net.close(); net = new Net(); net.onclose = onlineDown;
  if (!net.available) return setOnlineStatus('⚠ This browser does not support online play.');
  setOnlineStatus('Creating your room…');
  try {
    const code = await net.host();
    $('#host-code').textContent = code; mark(['h1', 'h2', 'h3'], 1);
    setOnlineStatus('Waiting for your friend to enter the code…');
    net.onconnect = async () => {
      mark(['h1', 'h2', 'h3'], 2); setOnlineStatus('Friend connected! Starting…'); sendHello();
      const h = await net.take('hello');
      const mine = buildTeam(sel.a); mine.celPref = { sel: sel.cel, sig: sel.sig };
      const theirs = h.team; theirs.celPref = h.pref;
      net.send({ t: 'start', shots: opts.shots });
      startMatch({ teams: [mine, theirs], mode: 'online', mySide: 0, shots: opts.shots });
    };
  } catch (e) { setOnlineStatus(onlineHelp('create a room', e)); }
};
$('#btn-join').onclick = async () => {
  sound.init();
  const code = $('#join-code').value.trim(); if (code.length < 4) return setOnlineStatus('Enter the code from your friend.');
  if (net) net.close(); net = new Net(); net.onclose = onlineDown;
  if (!net.available) return setOnlineStatus('⚠ This browser does not support online play.');
  mark(['j1', 'j2', 'j3'], 0); setOnlineStatus('Looking for the room…');
  try {
    await net.join(code); mark(['j1', 'j2', 'j3'], 1); sendHello(); setOnlineStatus('Connected! Waiting for the host to start…');
    const h = await net.take('hello'); const s = await net.take('start'); mark(['j1', 'j2', 'j3'], 2);
    const mine = buildTeam(sel.a); mine.celPref = { sel: sel.cel, sig: sel.sig };
    const theirs = h.team; theirs.celPref = h.pref;
    startMatch({ teams: [theirs, mine], mode: 'online', mySide: 1, shots: s.shots });
  } catch (e) { mark(['j1', 'j2', 'j3'], -1); setOnlineStatus(onlineHelp('join', e)); }
};
$('#join-code').oninput = (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''); };

// ---------------------------------------------------------------- HUD helpers
const hud = { banner: $('#banner'), lower: $('#lower'), reticle: $('#reticle'), zones: $('#zones'), kickbar: $('#kickbar'), power: $('#powerwrap'), hint: $('#hint') };
function banner(text, cls = '') { const b = hud.banner; b.className = ''; void b.offsetWidth; b.textContent = text; b.className = 'show ' + cls; }
function lowerThird(num, name, sub, ms = 2400) { hud.lower.innerHTML = `<div class="num">${num}</div><div class="info"><div class="nm">${name}</div><div class="sub">${sub}</div></div>`; hud.lower.classList.add('show'); setTimeout(() => hud.lower.classList.remove('show'), ms); }
function buildScoreboard() {
  const m = match;
  $('#scoreboard').innerHTML = [0, 1].map(i => {
    const t = m.teams[i], n = Math.max(m.shots, m.marks[i].length + (m.taken[i] === m.marks[i].length && m.taken[0] + m.taken[1] >= 2 * m.shots ? 1 : 0));
    const dots = Array.from({ length: n }, (_, k) => `<span class="dot ${m.marks[i][k] === 1 ? 'g' : m.marks[i][k] === 0 ? 'm' : ''}"></span>`).join('');
    return `<div class="sb ${i === m.mySide ? 'me' : ''}" style="border-color:${hex(t.kit)}"><span class="tn">${t.short}</span><span class="dots">${dots}</span><span class="sc">${m.score[i]}</span></div>`;
  }).join('');
  const sd = Math.max(...m.taken) >= m.shots && m.taken[0] === m.taken[1] && m.taken[0] >= m.shots;
  $('#round-badge').textContent = sd ? 'SUDDEN DEATH' : `PENALTY SHOOTOUT · KICK ${Math.min(m.round + 1, m.shots)} / ${m.shots}`;
}
function setHint(h) { hud.hint.innerHTML = h; hud.hint.style.display = h ? '' : 'none'; }
function toScreen(v) { const p = v.clone().project(camera); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight, vis: p.z < 1 }; }

// ---------------------------------------------------------------- input
const input = { mode: null, type: 0, aim: new V3(1.2, 1.5, 0), charging: false, t0: 0, power: 0, res: null, rej: null, sel: null, shift: false };
const raycastPlane = new THREE.Raycaster(); const planeZ0 = new THREE.Plane(new V3(0, 0, 1), 0);
function aimFromPointer(e) {
  const nd = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  raycastPlane.setFromCamera(nd, camera); const pt = new V3();
  if (raycastPlane.ray.intersectPlane(planeZ0, pt)) { input.aim.x = clamp(pt.x, -4.6, 4.6); input.aim.y = clamp(pt.y, 0.12, 3.1); }
}
canvas.addEventListener('pointermove', e => { if (input.mode === 'kick' && !input.charging) aimFromPointer(e); else if (input.mode === 'kick') aimFromPointer(e); });
canvas.addEventListener('pointerdown', e => { sound.init(); if (document.body.classList.contains('cut')) { skipFlag = true; return; } if (input.mode === 'kick') { aimFromPointer(e); startCharge(); } });
addEventListener('pointerup', () => { if (input.mode === 'kick' && input.charging) fireShot(); });
function startCharge() { if (input.charging) return; input.charging = true; input.t0 = T; input.power = 0; sound.tick(); }
function fireShot() {
  input.charging = false; const k = KICKS[input.type];
  const shot = { type: k.id, ax: input.aim.x, ay: input.aim.y, power: Math.max(0.12, input.power), seed: (Math.random() * 2 ** 31) | 0, errMul: opts.assist ? 0.9 : 1 };
  input.mode = null; showKickUI(false); input.res && input.res(shot);
}
function updatePowerUI() { $('#sweet').style.display = opts.assist ? '' : 'none'; }
function pickType(i) { input.type = i; $$('.kb', hud.kickbar).forEach((b, j) => b.classList.toggle('sel', j === i)); if (match) setHint(`<b>${KICKS[i].name}</b> — ${KICKS[i].desc}`); sound.tick(); }
hud.kickbar.innerHTML = KICKS.map((k, i) => `<button class="kb" data-i="${i}" title="${k.desc}"><b>${k.key}</b>${k.name}</button>`).join('');
$$('.kb', hud.kickbar).forEach(b => b.onclick = () => { if (input.mode === 'kick') pickType(+b.dataset.i); });
function showKickUI(on) {
  hud.kickbar.style.display = on ? 'flex' : 'none'; hud.power.style.display = on ? 'block' : 'none'; hud.reticle.style.display = on ? 'block' : 'none';
  if (!on) { $('#powerfill').style.width = '0'; }
}
function getHumanShot() {
  return new Promise((res, rej) => {
    input.mode = 'kick'; input.res = res; input.rej = rej; input.charging = false; input.power = 0; input.aim.set(Math.random() < .5 ? -1.6 : 1.6, 1.5, 0);
    showKickUI(true); pickType(input.type); updatePowerUI();
    setHint(`<b>${KICKS[input.type].name}</b> — move the mouse to aim · hold click / SPACE to charge · release to shoot · keys 1-8 change kick`);
  });
}
// keeper input
const ZKEYS = ['q', 'w', 'e', 'a', 's', 'd', 'z', 'x', 'c'];
function buildZones() {
  const rows = [2, 1, 0], cols = [1, 0, -1]; // screen-left = world +x for the keeper camera
  hud.zones.innerHTML = '';
  for (const r of rows) for (const c of cols) {
    const d = document.createElement('div'); d.dataset.col = c; d.dataset.row = r;
    d.textContent = keeperMove(c, r, false).name.replace(' Dive', '');
    d.onclick = () => chooseZone(c, r); hud.zones.appendChild(d);
  }
}
function chooseZone(c, r) { if (input.mode !== 'keeper') return; input.sel = { col: c, row: r }; sound.tick(); refreshZones(); }
function refreshZones() {
  $$('div', hud.zones).forEach(d => d.classList.toggle('sel', !!input.sel && +d.dataset.col === input.sel.col && +d.dataset.row === input.sel.row));
  const s = input.sel; setHint(s ? `Diving: <b>${keeperMove(s.col, s.row, input.shift).name}</b> (hold SHIFT for full stretch)` : 'Pick where to dive: click a zone or use Q W E / A S D / Z X C · SHIFT = full stretch');
}
function placeZones() {
  const pts = [[-3.66, 0], [3.66, 0], [-3.66, 2.44], [3.66, 2.44]].map(([x, y]) => toScreen(new V3(x, y, 0)));
  const x0 = Math.min(...pts.map(p => p.x)), x1 = Math.max(...pts.map(p => p.x)), y0 = Math.min(...pts.map(p => p.y)), y1 = Math.max(...pts.map(p => p.y));
  Object.assign(hud.zones.style, { left: x0 + 'px', top: y0 + 'px', width: (x1 - x0) + 'px', height: (y1 - y0) + 'px' });
}
addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (k === 'escape' && match && !match.dead) { togglePause(); return; }
  if (k === 'shift') { input.shift = true; if (input.mode === 'keeper') refreshZones(); }
  if (document.body.classList.contains('cut') && (k === ' ' || k === 'enter')) { skipFlag = true; e.preventDefault(); return; }
  if (input.mode === 'kick') {
    const n = parseInt(k); if (n >= 1 && n <= 8) pickType(n - 1);
    if (k === ' ' && !e.repeat) { e.preventDefault(); startCharge(); }
    const st = 0.18; if (k === 'arrowleft') input.aim.x = clamp(input.aim.x - st, -4.6, 4.6); if (k === 'arrowright') input.aim.x = clamp(input.aim.x + st, -4.6, 4.6);
    if (k === 'arrowup') input.aim.y = clamp(input.aim.y + st, 0.12, 3.1); if (k === 'arrowdown') input.aim.y = clamp(input.aim.y - st, 0.12, 3.1);
  } else if (input.mode === 'keeper') {
    const i = ZKEYS.indexOf(k); if (i >= 0) { const r = [2, 1, 0][Math.floor(i / 3)], c = [1, 0, -1][i % 3]; chooseZone(c, r); }
  }
});
addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (k === 'shift') { input.shift = false; if (input.mode === 'keeper') refreshZones(); } if (k === ' ' && input.mode === 'kick' && input.charging) fireShot(); });

function togglePause() {
  const p = $('#pause'); const open = p.classList.contains('hidden');
  p.classList.toggle('hidden', !open); if (match && match.mode === 'cpu') paused = open;
}
$('#btn-pause').onclick = (e) => { e.stopPropagation(); togglePause(); };
$('#pause-resume').onclick = togglePause;
$('#pause-opt').onclick = openOptions;
$('#pause-quit').onclick = () => { $('#pause').classList.add('hidden'); paused = false; quitMatch(); };

// ---------------------------------------------------------------- match engine
function startMatch(cfg) {
  if (match) match.dead = true;
  match = { ...cfg, score: [0, 0], taken: [0, 0], marks: [[], []], round: 0, dead: false, finished: false };
  $$('.screen').forEach(s => s.classList.remove('active'));
  $('#hud').classList.remove('hidden'); $('#screen-result').classList.remove('active');
  if (show) { dropFig(show.fig); show = null; }
  stadium.setCrowdColors(match.teams[0].kit, match.teams[1].kit);
  buildZones(); updatePowerUI();
  sound.init(); sound.setVol(opts.vol / 100); sound.setCrowd(opts.crowd); sound.setMusicMode('match');
  const m = match;
  runShootout().catch(e => { if (e !== ABORT) { console.error(e); } });
  return m;
}
function quitMatch() {
  if (match) { match.dead = true; } paused = false;
  if (net) { net.close(); net = null; }
  if (input.rej) { input.mode = null; }
  input.mode = null; showKickUI(false); hud.zones.style.display = 'none'; hud.lower.classList.remove('show'); document.body.classList.remove('cut');
  clearActors(); resetBall(); sound.setMusicMode('menu'); showScreen('main'); match = null;
}
let kf = null, gf = null, rf = null;
function clearActors() { dropFig(kf); dropFig(gf); dropFig(rf); kf = gf = rf = null; }
function resetBall() { ball.mode = 'rest'; ball.pos.set(SPOT.x, SPOT.y, SPOT.z); ball.vel.set(0, 0, 0); ball.inGoal = false; ball.holder = null; ball.flight = null; stadium.ball.position.copy(ball.pos); }
function celFor(team, kicker) { const c = team.celPref || { sel: 'siu', sig: true }; return (c.sig && kicker.cel && CEL[kicker.cel]) ? kicker.cel : (CEL[c.sel] ? c.sel : 'siu'); }
const HUMAN_START = 0.04;

async function runShootout() {
  const m = match; buildScoreboard(); await sleep(0.2);
  for (let r = 0; ; r++) {
    for (const s of [0, 1]) {
      m.round = r; await takeKick(s, r);
      const w = decided(); if (w !== null) { await finish(w); return; }
    }
  }
}
function decided() {
  const m = match, N = m.shots, [ta, tb] = m.taken, [sa, sb] = m.score;
  if (Math.max(ta, tb) <= N) { if (sa > sb + (N - tb)) return 0; if (sb > sa + (N - ta)) return 1; return null; }
  if (ta === tb && sa !== sb) return sa > sb ? 0 : 1; return null;
}
async function finish(w) {
  const m = match; m.finished = true; await sleep(1.0);
  document.body.classList.remove('cut'); showKickUI(false);
  const me = m.mode === 'cpu' ? 0 : m.mySide, won = w === me;
  $('#res-title').textContent = won ? 'YOU WIN THE SHOOTOUT!' : 'SHOOTOUT LOST';
  $('#res-score').textContent = `${m.teams[0].short} ${m.score[0]} – ${m.score[1]} ${m.teams[1].short}`;
  $('#res-sub').textContent = `${m.teams[w].name} win on penalties.`;
  $('#btn-rematch').style.display = m.mode === 'cpu' ? '' : 'none';
  $('#hud').classList.add('hidden'); $('#screen-result').classList.add('active'); sound.setMusicMode('menu');
  sound.roar(won ? 1.3 : 0.5);
  // show a trophy-moment on the 3D stage: winners celebrate
  clearActors(); resetBall();
  const wt = m.teams[w], pl = wt.players[0];
  const fig = makeFigure(figOpts(wt, pl, false)); fig.base = { x: 0, y: 0, z: 4.5, yaw: 0 }; addFig(fig); show = { fig, celId: celFor(wt, pl), t0: T }; menuCamMode = 'main'; menuCam(); camCut();
}
$('#btn-rematch').onclick = () => { const m = match; if (!m) return; if (show) { dropFig(show.fig); show = null; } startMatch({ teams: m.teams, mode: m.mode, mySide: m.mySide, shots: m.shots }); };
$('#btn-menu').onclick = () => { if (show) { dropFig(show.fig); show = null; } quitMatch(); };

async function takeKick(side, round) {
  const m = match, KT = m.teams[side], GT = m.teams[1 - side];
  const kicker = KT.players[m.taken[side] % KT.players.length], gk = GT.gk;
  const kCtl = m.mode === 'cpu' ? (side === 0 ? 'human' : 'ai') : (side === m.mySide ? 'human' : 'remote');
  const gCtl = m.mode === 'cpu' ? (side === 0 ? 'ai' : 'human') : (side === m.mySide ? 'remote' : 'human');
  clearActors(); resetBall(); input.sel = null; stadium.netMat.opacity = 0.55;
  kf = addFig(makeFigure(figOpts(KT, kicker, false))); kf.base = { x: 2.6, y: 0, z: 15, yaw: Math.PI };
  gf = addFig(makeFigure(figOpts(GT, gk, true))); gf.base = { x: 0, y: 0, z: 0.2, yaw: 0 };
  rf = addFig(makeFigure({ kit: 0xf2e200, shorts: 0x111111, socks: 0x111111, skin: SKIN_TONES[1], hair: HAIR_COLORS[0], hairStyle: 0, boots: 0x111111, num: '', name: '' }));
  rf.base = { x: -8, y: 0, z: 8, yaw: Math.atan2(8, 3) }; play(rf, refPose);
  play(kf, standHips); play(gf, keeperReady);
  buildScoreboard();
  hud.zones.style.display = 'none'; showKickUI(false);

  // intro: side view then role camera
  const tIntro = T;
  cam.k = 1.6;
  cam.fn = () => { const tt = T - tIntro; cam.tp.set(15 - tt * 0.8, 3.2, 12 + tt * 0.4); cam.tl.set(0.5, 1.1, 7); cam.tf = 40; };
  camCut();
  lowerThird(kicker.num, kicker.name, `${KT.name} · SHOOTING ${kicker.r}`, 2800);
  const keeperRole = gCtl === 'human';
  sound.whistle();
  await sleep(1.9);
  if (keeperRole) setKeeperCam(); else setKickerCam();
  cam.k = 2.6;
  await sleep(0.7);

  // ----- get the shot
  let shot;
  if (kCtl === 'human') { setHint(''); shot = await getHumanShot(); if (m.mode === 'online') net.send({ t: 'shot', shot, kickerIdx: m.taken[side] % KT.players.length }); }
  else if (kCtl === 'ai') {
    if (keeperRole) { input.mode = 'keeper'; hud.zones.style.display = 'grid'; placeZones(); refreshZones(); }
    await sleep(2.6); shot = aiShot(kicker, opts.ai);
  } else {
    if (keeperRole) { input.mode = 'keeper'; hud.zones.style.display = 'grid'; placeZones(); refreshZones(); }
    setHint('Waiting for the opponent to shoot…'); const ss = await net.take('shotstart'); shot = { type: ss.type, ax: 0, ay: 1.2, power: 0.8, seed: 0 }; // aim stays hidden until the result
  }
  if (keeperRole) { input.mode = 'keeper'; hud.zones.style.display = 'grid'; placeZones(); refreshZones(); }
  setHint(keeperRole ? hud.hint.innerHTML : '');

  // ----- run-up
  const K = kickOf(shot.type), tStart = T, tContact = T + K.runup;
  const plant = { x: -0.1, z: 11.85 };
  play(kf, kickAnim(K.style, K.runup, { x: 2.6, z: 15 }, plant), tStart);
  let dive = null;
  if (gCtl === 'ai') {
    dive = aiDive(shot, opts.ai);
    play(gf, (tc) => keeperDive(dive, tc), tContact);
  }
  sound.whistle();
  await sleep(K.runup);

  // ----- contact
  let serverOutcome = null;
  if (m.mode === 'online') {
    if (gCtl === 'human') { const s = input.sel; const d0 = s ? { col: s.col, row: s.row, shift: input.shift } : { col: 0, row: 1, shift: false }; net.send({ t: 'dive', ...d0 }); dive = makeDive(d0.col, d0.row, d0.shift, HUMAN_START); play(gf, (tc) => keeperDive(dive, tc), T); }
    const r = await net.take('result');      // the server reveals both choices at the same moment
    shot = r.shot; serverOutcome = r.outcome; dive = makeDive(r.dive.col, r.dive.row, r.dive.shift, HUMAN_START);
    if (gCtl !== 'human') play(gf, (tc) => keeperDive(dive, tc), T);
  } else if (gCtl === 'human') {
    const s = input.sel; dive = s ? makeDive(s.col, s.row, input.shift, HUMAN_START) : makeDive(0, 1, false, 0.05);
    play(gf, (tc) => keeperDive(dive, tc), T);
  }
  input.mode = null; hud.zones.style.display = 'none'; setHint('');
  const res = resolveShot(shot, dive, kicker, gk);
  if (serverOutcome) res.outcome = serverOutcome;
  if (DEBUG.force) res.outcome = DEBUG.force;
  launch(res, shot);
  setFollowCam(keeperRole, res);
  await sleep(res.T + 0.25);

  // ----- outcome
  const goal = res.outcome === 'goal';
  m.taken[side]++; m.marks[side].push(goal ? 1 : 0); if (goal) m.score[side]++;
  buildScoreboard();
  excite = Math.max(excite, goal ? 1 : 0.3);
  if (goal) {
    banner('GOAL!', 'goal'); cam.shake = 0.35;
    await sleep(0.8);
    await goalCutscene(KT, kicker, side, round);
  } else {
    if (res.outcome === 'catch' || res.outcome === 'parry') {
      banner('SAVED!', 'bad'); sound.groan();
      gf.base.x = gf.group.position.x; gf.base.y = 0;
      await sleep(0.7);
      gf.base.x = gf.group.position.x; gf.base.y = 0;
      play(gf, keeperCheer);
      kf.base.x = kf.group.position.x; kf.base.z = kf.group.position.z; kf.base.yaw = Math.PI; play(kf, sadPose);
      keeperSaveCam();
      lowerThird(gk.num, gk.name, `${GT.name} · GOALKEEPER`, 2000);
    } else {
      banner(res.outcome === 'post' ? 'OFF THE POST!' : res.outcome === 'bar' ? 'HITS THE BAR!' : res.outcome === 'wide' ? 'WIDE!' : 'OVER THE BAR!', 'bad');
      sound.groan(); kf.base.x = kf.group.position.x; kf.base.z = kf.group.position.z; kf.base.yaw = Math.PI; play(kf, sadPose);
      play(gf, hipsPose);
    }
    await sleep(2.3);
  }
  buildScoreboard();
}

// ---------------------------------------------------------------- cameras for the kick
function setKickerCam() {
  cam.fn = () => { cam.tp.set(-1.9, 2.2, 19.2); cam.tl.set(0.2 + input.aim.x * 0.1, 1.1, 3); cam.tf = 40; };
}
function setKeeperCam() {
  stadium.netMat.opacity = 0.2;
  cam.fn = () => { cam.tp.set(0, 2.5, -5.6); cam.tl.set(0, 1.0, 9); cam.tf = 55; };
}
function setFollowCam(keeperRole, res) {
  if (keeperRole) { cam.fn = () => { cam.tp.set(0, 2.4, -5.6); cam.tl.set(ball.pos.x * 0.5, 1.0 + Math.min(ball.pos.y, 2) * 0.3, Math.max(1, ball.pos.z * 0.6)); cam.tf = 52; }; return; }
  cam.k = 2.2;
  cam.fn = () => { const bz = ball.pos.z; cam.tp.set(-1.9 + ball.pos.x * 0.3, 2.1 - Math.min(0.6, (11 - bz) * 0.05), Math.min(19.2, Math.max(11, bz + 8))); cam.tl.set(ball.pos.x * 0.7, Math.max(0.9, ball.pos.y), Math.max(-2, bz - 3)); cam.tf = 42; };
}
function keeperSaveCam() {
  const t0 = T; cam.k = 3;
  cam.fn = () => { const p = gf.group.position; const tt = T - t0; cam.tp.set(p.x - 2.6 + tt * 0.25, 1.4, p.z + 4.2 - tt * 0.3); cam.tl.set(p.x, 1.0, p.z); cam.tf = 36; };
}

// ---------------------------------------------------------------- goal cutscene
async function goalCutscene(KT, kicker, side, round) {
  const id = celFor(KT, kicker), cel = CELEBRATIONS.find(c => c.id === id);
  document.body.classList.add('cut'); showKickUI(false); hud.zones.style.display = 'none'; setHint('');
  kf.base = { x: (round % 2 ? -1 : 1) * 0.8, y: 0, z: 5.5, yaw: 0 };
  play(kf, (t) => CEL[id](t));
  play(gf, hipsPose);
  sound.roar(1.2);
  const t0 = T, v = (round + side) % 3;
  lowerThird(kicker.num, kicker.name, `${KT.name} · ${cel.icon} ${cel.name.toUpperCase()}`, 3600);
  cam.k = 4.2;
  cam.fn = () => {
    const tt = T - t0, p = kf.group.position;
    const tgt = new V3(p.x, 1.15 + p.y * 0.6, p.z);
    let a, R, h;
    if (v === 0) { a = -0.65 + tt * 0.16; R = lerp(11.5, 6.0, ease(tt / 1.6)); h = 1.0; }
    else if (v === 1) { a = 0.6 - tt * 0.13; R = lerp(10, 5.4, ease(tt / 1.4)); h = 0.7; }
    else { a = 0.35 * Math.sin(tt * 0.5); R = lerp(12.5, 7, ease(tt / 2)); h = 2.1; }
    cam.tp.set(tgt.x + Math.sin(a) * R, h, tgt.z + Math.cos(a) * R); cam.tl.copy(tgt); cam.tf = 34;
  };
  camCut();
  await skippable(CEL_DUR[id]);
  document.body.classList.remove('cut'); hud.lower.classList.remove('show');
}

// ---------------------------------------------------------------- ball
function launch(res, shot) {
  ball.res = res; ball.flight = { t0: T, res }; ball.mode = 'flight'; ball.inGoal = false;
  sound.kick(shot.power);
}
function flightPos(t, out) {
  const r = ball.flight.res, v = r.v0;
  out.set(SPOT.x + v.x * t + 0.5 * r.ax * t * t, SPOT.y + v.y * t - 4.9 * t * t, SPOT.z + v.z * t);
  if (r.wob) { const k = clamp(t / r.T), env = Math.sin(Math.PI * k); out.x += r.wob * Math.sin(t * 38 + r.ph) * env; out.y += r.wob * 0.7 * Math.sin(t * 31 + r.ph * 2) * env; }
  return out;
}
function finishFlight() {
  const r = ball.res, t = r.T, v = r.v0;
  flightPos(t, ball.pos);
  ball.vel.set(v.x + r.ax * t, v.y - 9.8 * t, v.z);
  const q = r.rnd; ball.mode = 'free'; ball.flight = null;
  switch (r.outcome) {
    case 'goal': ball.inGoal = true; ball.vel.multiplyScalar(0.55); sound.net(); sound.roar(1.1); break;
    case 'catch': ball.mode = 'held'; ball.holder = gf; sound.save(); break;
    case 'parry': ball.vel.set((q[0] - 0.5) * 9, 2.5 + q[1] * 3, 4 + q[2] * 5); sound.save(); break;
    case 'post': case 'bar': ball.vel.set(-Math.sign(r.tx) * (1 + q[0] * 3), r.outcome === 'bar' ? -2 : 1 + q[1] * 2, 3 + q[2] * 4); sound.post(); break;
    default: ball.vel.multiplyScalar(0.8); break;
  }
}
const tmpV = new V3();
function updateBall(dt) {
  if (ball.mode === 'flight') {
    const t = T - ball.flight.t0;
    if (t >= ball.res.T) finishFlight(); else { flightPos(t, ball.pos); ball.mesh.rotation.x -= dt * 14; }
  }
  if (ball.mode === 'free') {
    const n = Math.ceil(dt / 0.008), h = dt / n;
    for (let i = 0; i < n; i++) {
      const p = ball.pos, v = ball.vel;
      v.y -= 9.8 * h; p.addScaledVector(v, h);
      if (p.y < 0.11) { p.y = 0.11; if (v.y < 0) v.y = -v.y * (ball.inGoal ? 0.3 : 0.55); v.x *= 1 - 1.2 * h; v.z *= 1 - 1.2 * h; if (Math.abs(v.y) < 0.9) v.y = 0; }
      if (ball.inGoal) {
        if (p.z < -1.95) { p.z = -1.95; v.z *= -0.22; v.x *= 0.5; }
        if (Math.abs(p.x) > 3.55) { p.x = Math.sign(p.x) * 3.55; v.x *= -0.25; }
        if (p.y > 2.3) { p.y = 2.3; v.y *= -0.2; }
        v.x *= 1 - 2 * h; v.z *= 1 - 2 * h;
      } else {
        if (p.z < -6.4) { p.z = -6.4; v.z *= -0.3; }
        if (Math.abs(p.x) > 33) { p.x = Math.sign(p.x) * 33; v.x *= -0.3; }
      }
    }
    ball.mesh.rotation.x -= ball.vel.z * dt / 0.11 * 0.6; ball.mesh.rotation.z += ball.vel.x * dt / 0.11 * 0.6;
    if (ball.vel.lengthSq() < 0.01 && ball.pos.y <= 0.12) { ball.vel.set(0, 0, 0); ball.mode = 'rest'; }
  }
  if (ball.mode === 'held' && ball.holder) {
    ball.holder.handR.getWorldPosition(tmpV); ball.pos.copy(tmpV); ball.pos.y = Math.max(0.15, ball.pos.y);
  }
  ball.mesh.position.copy(ball.pos);
}

// ---------------------------------------------------------------- power bar
function updateInput(dt) {
  if (input.mode === 'kick') {
    if (input.charging) { input.power = Math.min(1, (T - input.t0) * 0.9); }
    $('#powerfill').style.width = (input.power * 100) + '%';
    const s = toScreen(input.aim); hud.reticle.style.left = s.x + 'px'; hud.reticle.style.top = s.y + 'px';
    hud.reticle.style.borderColor = input.power > 0.9 ? '#ff4d6d' : input.power >= 0.72 ? '#2ee59d' : '#ffd23f';
  }
  if (input.mode === 'keeper') placeZones();
}

// ---------------------------------------------------------------- main loop
let last = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); last = now;
  if (!paused) T += dt;
  const gdt = paused ? 0 : dt;
  if (show) {
    const f = show.fig;
    if (show.celId) { const dur = CEL_DUR[show.celId] + 0.8, t = (T - show.t0) % dur; setPose(f, CEL[show.celId](Math.min(t, CEL_DUR[show.celId]))); }
    else { setPose(f, { ...idlePose(T), oyaw: T * 0.5 }); }
  }
  for (const f of figs) { if (f.anim && f !== (show && show.fig)) setPose(f, f.anim.fn(T - f.anim.t0)); }
  ball.mesh.visible = !!match && !match.finished;
  updateBall(gdt);
  excite = Math.max(0, excite - gdt * 0.18);
  stadium.update(T, excite);
  updateCam(dt);
  updateInput(gdt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

addEventListener('pointerdown', () => sound.init(), { once: true });
addEventListener('keydown', () => sound.init(), { once: true });
// ---------------------------------------------------------------- boot
applyGfx(); menuCam(); showScreen('main'); camCut();
requestAnimationFrame(frame);
$('#loading').style.display = 'none';
window.__ascendia = { DEBUG, startMatch, get match() { return match; }, buildTeam, sel, opts, input, T: () => T, ball, camera, scene };
