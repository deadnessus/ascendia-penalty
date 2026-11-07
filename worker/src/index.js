// Ascendia Penaltys online server (Cloudflare Worker + one Durable Object per room).
// Friends-only: a room is created with a random code, a second player joins with that code.
// Only fixed game messages are accepted (no free text, no chat) and nothing is stored after the match.
import { resolveShot, makeDive } from '../../js/logic.js';
import { KICKS } from '../../js/data.js';
import { clamp } from '../../js/util.js';

const CODE_RE = /^[A-HJ-NP-Z2-9]{5}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const IDLE_MS = 30 * 60 * 1000;
const HUMAN_START = 0.04;

const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...extra } });
function newCode() { const b = crypto.getRandomValues(new Uint8Array(5)); return Array.from(b, x => ALPHABET[x % 32]).join(''); }
function originOk(req, url) {
  const o = req.headers.get('Origin'); if (!o) return false;
  try { const h = new URL(o).hostname; return h === url.hostname || h === 'localhost' || h === '127.0.0.1'; } catch { return false; }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/online\/(new|[A-Za-z0-9]{5})$/);
    if (!m) return new Response('Not found', { status: 404 });
    if (m[1] === 'new') return originOk(req, url) ? json({ code: newCode() }, 200, { 'access-control-allow-origin': req.headers.get('Origin') }) : json({ error: 'forbidden' }, 403);
    if (req.headers.get('Upgrade') !== 'websocket') return new Response('Expected WebSocket', { status: 426 });
    if (!originOk(req, url)) return new Response('Forbidden', { status: 403 });
    const code = m[1].toUpperCase(); if (!CODE_RE.test(code)) return new Response('Bad code', { status: 400 });
    return env.ROOMS.get(env.ROOMS.idFromName(code)).fetch(req);
  },
};

const num = (v, a, b, d) => (typeof v === 'number' && isFinite(v)) ? clamp(v, a, b) : d;
function cleanTeam(t) {
  if (!t || !Array.isArray(t.players) || !t.gk) return null;
  const P = (p) => ({ name: String(p.name || '?').slice(0, 24), num: num(p.num, 0, 99, 0), r: num(p.r, 40, 99, 70), pow: num(p.pow, 40, 99, 70), fin: num(p.fin, 40, 99, 70), acc: num(p.acc, 40, 99, 70) });
  return { players: t.players.slice(0, 8).map(P), gk: P(t.gk) };
}

export class Room {
  constructor(ctx) {
    this.ctx = ctx; this.s = { teams: {}, pending: null };
    ctx.blockConcurrencyWhile(async () => { this.s = (await ctx.storage.get('s')) || this.s; });
  }
  roleOf(ws) { return this.ctx.getTags(ws)[0]; }
  other(role) { return this.ctx.getWebSockets(role === 'host' ? 'guest' : 'host')[0]; }
  async save() { await this.ctx.storage.put('s', this.s); await this.ctx.storage.setAlarm(Date.now() + IDLE_MS); }
  async alarm() { for (const w of this.ctx.getWebSockets()) try { w.close(1000, 'idle'); } catch {} await this.ctx.storage.deleteAll(); }
  async fetch(req) {
    const role = new URL(req.url).searchParams.get('role') === 'host' ? 'host' : 'guest';
    const { 0: client, 1: server } = new WebSocketPair();
    const hasHost = this.ctx.getWebSockets('host').length > 0, hasGuest = this.ctx.getWebSockets('guest').length > 0;
    let err = null;
    if (role === 'host' && hasHost) err = [4409, 'taken']; else if (role === 'guest' && !hasHost) err = [4404, 'no-room']; else if (role === 'guest' && hasGuest) err = [4409, 'full'];
    if (err) { server.accept(); server.close(err[0], err[1]); return new Response(null, { status: 101, webSocket: client }); }
    this.ctx.acceptWebSocket(server, [role]);
    if (role === 'host') { this.s = { teams: {}, pending: null }; await this.save(); server.send(JSON.stringify({ t: 'created' })); }
    else { server.send(JSON.stringify({ t: 'joined' })); const h = this.other('guest'); h && h.send(JSON.stringify({ t: 'peer-joined' })); }
    return new Response(null, { status: 101, webSocket: client });
  }
  async webSocketClose(ws) { const role = this.roleOf(ws); const o = this.other(role); o && o.send(JSON.stringify({ t: 'left' })); if (role === 'host') { try { o && o.close(1000, 'host-left'); } catch {} } }
  async webSocketError(ws) { await this.webSocketClose(ws); }
  async webSocketMessage(ws, raw) {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (typeof raw !== 'string' || raw.length > 20000 || !m || typeof m.t !== 'string') return;
    const role = this.roleOf(ws), other = this.other(role), s = this.s;
    if (m.t === 'hello') {
      const team = cleanTeam(m.team); if (!team) return; s.teams[role] = team;
      other && other.send(JSON.stringify({ t: 'hello', team: m.team, pref: m.pref })); await this.save();
    } else if (m.t === 'start' && role === 'host') {
      other && other.send(JSON.stringify({ t: 'start', shots: num(m.shots, 1, 7, 5) }));
    } else if (m.t === 'shot') {
      if (s.pending || !m.shot || !other) return;
      const k = KICKS.find(x => x.id === m.shot.type); if (!k) return;
      const seed = crypto.getRandomValues(new Uint32Array(1))[0] & 0x7fffffff;
      s.pending = { by: role, kickerIdx: num(m.kickerIdx, 0, 7, 0) | 0, shot: { type: k.id, ax: num(m.shot.ax, -4.6, 4.6, 0), ay: num(m.shot.ay, 0.1, 3.1, 1.2), power: num(m.shot.power, 0, 1, 0.8), errMul: num(m.shot.errMul, 0.9, 1, 1), seed }, dive: null };
      other.send(JSON.stringify({ t: 'shotstart', type: k.id })); await this.save();   // the keeper never sees the aim
    } else if (m.t === 'dive') {
      const p = s.pending; if (!p || p.by === role || p.dive) return;
      p.dive = { col: Math.sign(num(m.col, -1, 1, 0)) | 0, row: num(m.row, 0, 2, 1) | 0, shift: !!m.shift };
      const kt = s.teams[p.by], gt = s.teams[role];
      if (!kt || !gt) { s.pending = null; return; }
      const kicker = kt.players[p.kickerIdx % kt.players.length], dive = makeDive(p.dive.col, p.dive.row, p.dive.shift, HUMAN_START);
      const res = resolveShot(p.shot, dive, kicker, gt.gk);
      const out = JSON.stringify({ t: 'result', shot: p.shot, dive: p.dive, outcome: res.outcome });
      for (const w of this.ctx.getWebSockets()) w.send(out);
      s.pending = null; await this.save();
    }
  }
}
