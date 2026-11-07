// Peer-to-peer online play over WebRTC using PeerJS (public signalling server, no game server needed)
export class Net {
  constructor() { this.peer = null; this.conn = null; this.q = {}; this.w = {}; this.onclose = () => {}; this.onmsg = () => {}; }
  get available() { return typeof window.Peer === 'function'; }
  get connected() { return !!(this.conn && this.conn.open); }
  _attach(c) {
    this.conn = c;
    c.on('data', (m) => { if (!m || !m.t) return; this.onmsg(m); const w = this.w[m.t]; if (w && w.length) w.shift()(m); else (this.q[m.t] ||= []).push(m); });
    c.on('close', () => this.onclose()); c.on('error', () => this.onclose());
  }
  host() {
    return new Promise((res, rej) => {
      const to = setTimeout(() => rej(Object.assign(new Error('timeout'), { type: 'timeout' })), 12000);
      const tryOnce = (n) => {
        const code = Array.from({ length: 5 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('');
        const p = new window.Peer('ascendia-pen-' + code);
        p.on('open', () => { this.peer = p; p.on('connection', (c) => { c.on('open', () => { this._attach(c); this.onconnect && this.onconnect(); }); }); clearTimeout(to); res(code); });
        p.on('error', (e) => { if (e.type === 'unavailable-id' && n < 4) tryOnce(n + 1); else { clearTimeout(to); rej(e); } });
      };
      tryOnce(0);
    });
  }
  join(code) {
    return new Promise((res, rej) => {
      const p = new window.Peer(); this.peer = p;
      const to = setTimeout(() => rej(new Error('timeout')), 15000);
      p.on('open', () => { const c = p.connect('ascendia-pen-' + code.trim().toUpperCase(), { reliable: true }); c.on('open', () => { clearTimeout(to); this._attach(c); res(); }); });
      p.on('error', (e) => { clearTimeout(to); rej(e); });
    });
  }
  send(o) { if (this.connected) this.conn.send(o); }
  take(type) { const q = this.q[type]; if (q && q.length) return Promise.resolve(q.shift()); return new Promise((r) => (this.w[type] ||= []).push(r)); }
  close() { try { this.conn && this.conn.close(); this.peer && this.peer.destroy(); } catch (e) {} this.conn = this.peer = null; this.q = {}; this.w = {}; }
}
