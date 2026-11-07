// Online play over WebSocket through the game's own server (Cloudflare Worker at /online).
// Same small interface as before: host(), join(code), send(), take(type), close().
export class Net {
  constructor() { this.ws = null; this.q = {}; this.w = {}; this.open = false; this.onclose = () => {}; this.onconnect = null; }
  get available() { return typeof WebSocket === 'function'; }
  get connected() { return !!(this.ws && this.open); }
  static base() {
    const o = new URLSearchParams(location.search).get('server');   // dev override, e.g. ?server=ws://localhost:8787/online
    if (o) return o.replace(/\/$/, '');
    return (location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/online';
  }
  static httpBase() { return Net.base().replace(/^ws/, 'http'); }
  _connect(code, role, readyType) {
    return new Promise((res, rej) => {
      let done = false;
      const fail = (type) => { if (!done) { done = true; clearTimeout(to); rej(Object.assign(new Error(type), { type })); } };
      const to = setTimeout(() => { fail('timeout'); try { ws.close(); } catch {} }, 12000);
      let ws; try { ws = new WebSocket(`${Net.base()}/${code}?role=${role}`); } catch { return fail('network'); }
      this.ws = ws;
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch { return; } if (!m || !m.t) return;
        if (m.t === readyType && !done) { done = true; clearTimeout(to); this.open = true; res(code); return; }
        if (m.t === 'peer-joined') { this.onconnect && this.onconnect(); return; }
        if (m.t === 'left') { this.onclose(); return; }
        const w = this.w[m.t]; if (w && w.length) w.shift()(m); else (this.q[m.t] ||= []).push(m);
      };
      ws.onclose = (e) => { this.open = false; if (!done) fail(e.reason || 'network'); else this.onclose(); };
      ws.onerror = () => { if (!done) fail('network'); };
    });
  }
  async host() {
    const r = await fetch(Net.httpBase() + '/new', { cache: 'no-store' }).catch(() => null);
    if (!r || !r.ok) throw Object.assign(new Error('network'), { type: 'network' });
    const { code } = await r.json();
    await this._connect(code, 'host', 'created'); return code;
  }
  join(code) { return this._connect(code.trim().toUpperCase(), 'guest', 'joined'); }
  send(o) { if (this.connected) this.ws.send(JSON.stringify(o)); }
  take(type) { const q = this.q[type]; if (q && q.length) return Promise.resolve(q.shift()); return new Promise((r) => (this.w[type] ||= []).push(r)); }
  close() { try { this.ws && (this.ws.onclose = null, this.ws.close()); } catch {} this.ws = null; this.open = false; this.q = {}; this.w = {}; }
}
