// Peer-to-peer online play over WebRTC using PeerJS (public signalling server, no game server needed).
// PeerJS is bundled in vendor/ so the room can be created even when a CDN is slow or blocked;
// the CDN copy is only a fallback if the local file somehow failed to load.

const CDN = ['https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js', 'https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js'];
const PREFIX = 'ascendia-pen-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
// Several STUN servers (find each other's public address) + PeerJS TURN relays (used when a direct path is blocked).
const PEER_OPTS = {
  debug: 0,
  config: {
    iceServers: [
      { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'] },
      { urls: 'stun:stun.cloudflare.com:3478' },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' },
    ],
    sdpSemantics: 'unified-plan',
  },
};
// Errors that are worth retrying (signalling server busy / connection blip).
const RETRY = new Set(['network', 'server-error', 'socket-error', 'socket-closed', 'timeout', 'unavailable-id', 'disconnected']);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const err = (type, msg) => Object.assign(new Error(msg || type), { type });
const randomCode = () => Array.from({ length: 5 }, () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)]).join('');

let loading = null;
function loadScript(src) {
  return new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = src; s.async = true; s.onload = () => res(); s.onerror = () => { s.remove(); rej(err('library')); };
    document.head.appendChild(s);
  });
}
// Make sure window.Peer exists (local copy first, then CDNs).
export function ensurePeer() {
  if (typeof window.Peer === 'function') return Promise.resolve();
  if (!loading) {
    loading = (async () => {
      for (const src of CDN) {
        try { await loadScript(src); if (typeof window.Peer === 'function') return; } catch (e) { /* try next */ }
      }
      loading = null;
      throw err('library', 'PeerJS could not be loaded');
    })();
  }
  return loading;
}

// ---- Serverless mode: players swap two codes by hand (WhatsApp etc.). No matchmaking server needed.
const ICE = PEER_OPTS.config;
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (t) => Uint8Array.from(atob(t), (c) => c.charCodeAt(0));
async function pack(desc) {
  const json = JSON.stringify({ t: desc.type, s: desc.sdp });
  const raw = new TextEncoder().encode(json);
  if (typeof CompressionStream === 'function') {
    try { const out = await new Response(new Blob([raw]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer(); return 'Z' + b64(new Uint8Array(out)); } catch (e) { /* fall through */ }
  }
  return 'P' + b64(raw);
}
async function unpack(text) {
  const t = String(text || '').replace(/\s+/g, '');
  if (t.length < 20) throw err('bad-code', 'empty code');
  try {
    let raw = unb64(t.slice(1));
    if (t[0] === 'Z') raw = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    else if (t[0] !== 'P') throw 0;
    const o = JSON.parse(new TextDecoder().decode(raw));
    return { type: o.t, sdp: o.s };
  } catch (e) { throw err('bad-code', 'invalid code'); }
}
const gathered = (pc, ms = 5000) => new Promise((res) => {
  if (pc.iceGatheringState === 'complete') return res();
  const done = () => { clearTimeout(to); pc.removeEventListener('icegatheringstatechange', ch); res(); };
  const ch = () => { if (pc.iceGatheringState === 'complete') done(); };
  const to = setTimeout(done, ms);
  pc.addEventListener('icegatheringstatechange', ch);
});
// Looks like a PeerJS DataConnection to Net._attach
class ManualConn {
  constructor(pc, dc) {
    this.pc = pc; this.dc = dc; this.peerConnection = pc; this.h = {};
    dc.onmessage = (e) => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this._e('data', m); };
    dc.onclose = () => this._e('close'); dc.onerror = () => this._e('error');
  }
  get open() { return this.dc.readyState === 'open'; }
  on(ev, f) { (this.h[ev] ||= []).push(f); return this; }
  _e(ev, ...a) { (this.h[ev] || []).slice().forEach((f) => f(...a)); }
  send(o) { this.dc.send(JSON.stringify(o)); }
  close() { try { this.dc.close(); } catch (e) {} try { this.pc.close(); } catch (e) {} }
}

export class Net {
  constructor() { this.peer = null; this.conn = null; this.q = {}; this.w = {}; this.closed = false; this.onclose = () => {}; this.onmsg = () => {}; this.onstatus = () => {}; }
  get available() { return typeof window.Peer === 'function'; }
  get connected() { return !!(this.conn && this.conn.open); }

  _attach(c) {
    if (this.conn && this.conn !== c) { try { c.close(); } catch (e) {} return false; } // room already full
    this.conn = c;
    c.on('data', (m) => { if (!m || !m.t) return; this.onmsg(m); const w = this.w[m.t]; if (w && w.length) w.shift()(m); else (this.q[m.t] ||= []).push(m); });
    let done = false; const down = () => { if (done || this.closed) return; done = true; this.onclose(); };
    c.on('close', down); c.on('error', down);
    // Detect a dead WebRTC link (e.g. the other device lost Wi-Fi) instead of hanging forever.
    const pc = c.peerConnection;
    if (pc) pc.addEventListener('iceconnectionstatechange', () => { if (pc.iceConnectionState === 'failed' || pc.iceConnectionState === 'closed') down(); });
    return true;
  }

  // Keep the signalling connection alive so the friend can still find the room.
  _keepAlive(p) {
    p.on('disconnected', () => {
      if (this.closed || p.destroyed || this.conn) return;
      this.onstatus('reconnecting');
      setTimeout(() => { if (!this.closed && !p.destroyed && p.disconnected) { try { p.reconnect(); } catch (e) {} } }, 1000);
    });
    p.on('open', () => this.onstatus('online'));
  }

  // Open a Peer with the given id (or a random one) and resolve once the signalling server accepts it.
  _open(id, ms) {
    return new Promise((res, rej) => {
      let p;
      // window.ASCENDIA_PEER can point to your own PeerJS server, e.g. { host: 'peer.example.com', port: 443, path: '/', secure: true }
      const opts = { ...PEER_OPTS, ...(window.ASCENDIA_PEER || {}) };
      try { p = id ? new window.Peer(id, opts) : new window.Peer(opts); } catch (e) { return rej(err('browser-incompatible', e.message)); }
      const to = setTimeout(() => { cleanup(); try { p.destroy(); } catch (e) {} rej(err('timeout')); }, ms);
      const onOpen = () => { cleanup(); res(p); };
      const onErr = (e) => { cleanup(); try { p.destroy(); } catch (x) {} rej(e); };
      const cleanup = () => { clearTimeout(to); p.off('open', onOpen); p.off('error', onErr); };
      p.on('open', onOpen); p.on('error', onErr);
    });
  }

  async host(attempts = 6) {
    await ensurePeer();
    let last;
    for (let n = 0; n < attempts && !this.closed; n++) {
      if (n) { this.onstatus('retry', n + 1, attempts); await sleep(Math.min(800 * n, 3000)); }
      const code = randomCode();
      try {
        const p = await this._open(PREFIX + code, 10000);
        if (this.closed) { p.destroy(); break; }
        this.peer = p;
        this._keepAlive(p);
        p.on('connection', (c) => {
          c.on('open', () => { if (this._attach(c)) this.onconnect && this.onconnect(); });
        });
        p.on('error', (e) => { if (e.type === 'network' || e.type === 'server-error' || e.type === 'socket-error') this.onstatus('reconnecting'); });
        return code;
      } catch (e) {
        last = e;
        if (!RETRY.has(e.type)) throw e;
      }
    }
    throw last || err('cancelled');
  }

  async join(code, attempts = 4) {
    await ensurePeer();
    const target = PREFIX + code.trim().toUpperCase();
    let last;
    for (let n = 0; n < attempts && !this.closed; n++) {
      if (n) { this.onstatus('retry', n + 1, attempts); await sleep(Math.min(1200 * n, 3000)); }
      let p;
      try {
        p = await this._open(null, 10000);
        if (this.closed) { p.destroy(); break; }
        this.peer = p;
        await new Promise((res, rej) => {
          const c = p.connect(target, { reliable: true });
          const to = setTimeout(() => rej(err('timeout')), 15000);
          const fail = (e) => { clearTimeout(to); rej(e); };
          p.on('error', fail);
          c.on('error', () => fail(err('peer-unavailable')));
          c.on('open', () => { clearTimeout(to); p.off('error', fail); this._attach(c); res(); });
        });
        return;
      } catch (e) {
        last = e;
        if (p) { try { p.destroy(); } catch (x) {} } this.peer = null; this.conn = null;
        // A wrong code fails fast; retry it only once in case the host was briefly reconnecting.
        if (e.type === 'peer-unavailable' && n >= 1) throw e;
        if (!RETRY.has(e.type) && e.type !== 'peer-unavailable') throw e;
      }
    }
    throw last || err('cancelled');
  }

  // Host: returns the code to send to the friend.
  async hostManual() {
    if (typeof RTCPeerConnection !== 'function') throw err('browser-incompatible');
    const pc = new RTCPeerConnection(ICE); this._pc = pc;
    const dc = pc.createDataChannel('game', { ordered: true });
    const conn = new ManualConn(pc, dc);
    dc.onopen = () => { if (this._attach(conn)) this.onconnect && this.onconnect(); };
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    return pack(pc.localDescription);
  }
  // Host: friend's answer code pasted in.
  async hostAccept(answer) { await this._pc.setRemoteDescription(await unpack(answer)); }
  // Guest: host's code pasted in; returns the answer code to send back.
  async joinManual(offer) {
    if (typeof RTCPeerConnection !== 'function') throw err('browser-incompatible');
    const desc = await unpack(offer);
    const pc = new RTCPeerConnection(ICE); this._pc = pc;
    pc.ondatachannel = (e) => {
      const conn = new ManualConn(pc, e.channel);
      const go = () => { if (this._attach(conn)) this.onconnect && this.onconnect(); };
      if (e.channel.readyState === 'open') go(); else e.channel.onopen = go;
    };
    await pc.setRemoteDescription(desc);
    await pc.setLocalDescription(await pc.createAnswer());
    await gathered(pc);
    return pack(pc.localDescription);
  }

  send(o) { if (this.connected) this.conn.send(o); }
  take(type) { const q = this.q[type]; if (q && q.length) return Promise.resolve(q.shift()); return new Promise((r) => (this.w[type] ||= []).push(r)); }
  close() { this.closed = true; try { this.conn && this.conn.close(); } catch (e) {} try { this.peer && this.peer.destroy(); } catch (e) {} try { this._pc && this._pc.close(); } catch (e) {} this.conn = this.peer = this._pc = null; this.q = {}; this.w = {}; }
}
