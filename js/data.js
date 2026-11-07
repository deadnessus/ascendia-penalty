// ASCENDIA PENALTYS - game data
// NOTE: Rosters / ratings are approximations for gameplay, NOT official FIFA/EA/UEFA data.
// Use "My Team" and "My Player" to edit squads to match whatever season you like.

export const CELEBRATIONS = [
  { id: 'siu',      name: 'The Siu',      icon: '🦅', desc: 'Sprint, leap, spin and land arms wide.' },
  { id: 'slide',    name: 'Knee Slide',   icon: '🛝', desc: 'Slide on your knees toward the fans.' },
  { id: 'robot',    name: 'The Robot',    icon: '🤖', desc: 'Stiff, snappy robot moves.' },
  { id: 'cradle',   name: 'Baby Cradle',  icon: '👶', desc: 'Rock the baby in your arms.' },
  { id: 'flip',     name: 'Backflip',     icon: '🤸', desc: 'Run and fire off a backflip.' },
  { id: 'griddy',   name: 'The Griddy',   icon: '🕺', desc: 'Wide stance, bouncing knees.' },
  { id: 'plane',    name: 'Airplane',     icon: '✈️', desc: 'Arms out and fly around the pitch.' },
  { id: 'shush',    name: 'Shush',        icon: '🤫', desc: 'Finger to lips for the haters.' },
  { id: 'meditate', name: 'Meditate',     icon: '🧘', desc: 'Sit down, cross legs, find your calm.' },
  { id: 'cross',    name: 'Arms Crossed', icon: '😎', desc: 'Cold stare, arms crossed.' },
];

// speed m/s, err = base aim scatter (m), curve = lateral accel (m/s^2)
export const KICKS = [
  { id: 'place',   key: '1', name: 'Placed',      style: 'normal',  speed: 21,   err: 0.34, curve: 0,  runup: 1.15, desc: 'Inside-foot placement. Most accurate.' },
  { id: 'power',   key: '2', name: 'Power',       style: 'power',   speed: 31,   err: 0.62, curve: 0,  runup: 1.30, desc: 'Laces. Hardest and fastest.' },
  { id: 'finesse', key: '3', name: 'Finesse',     style: 'finesse', speed: 20,   err: 0.42, curve: 6.5, runup: 1.15, desc: 'Curls into the corner.' },
  { id: 'trivela', key: '4', name: 'Trivela',     style: 'trivela', speed: 22,   err: 0.50, curve: -6, runup: 1.15, desc: 'Outside of the boot, bends away.' },
  { id: 'panenka', key: '5', name: 'Panenka',     style: 'panenka', speed: 11.5, err: 0.22, curve: 0,  runup: 1.65, desc: 'Cheeky chip. Beats a diving keeper.' },
  { id: 'knuckle', key: '6', name: 'Knuckleball', style: 'knuckle', speed: 27,   err: 0.55, curve: 0,  runup: 1.20, wob: 0.28, desc: 'Dips and wobbles unpredictably.' },
  { id: 'driven',  key: '7', name: 'Low Driven',  style: 'driven',  speed: 26,   err: 0.42, curve: 0,  runup: 1.10, maxY: 0.8, desc: 'Skidding shot along the grass.' },
  { id: 'rabona',  key: '8', name: 'Rabona',      style: 'rabona',  speed: 21,   err: 0.58, curve: 5,  runup: 1.35, desc: 'Wrap the kicking leg behind. Pure flair.' },
];

export const AI_LEVELS = [
  { name: 'Amateur',      read: 0.16, start: 0.30,  kerr: 1.7 },
  { name: 'Semi-Pro',     read: 0.28, start: 0.18,  kerr: 1.35 },
  { name: 'Professional', read: 0.40, start: 0.08,  kerr: 1.05 },
  { name: 'World Class',  read: 0.54, start: -0.02, kerr: 0.82 },
  { name: 'Legendary',    read: 0.68, start: -0.10, kerr: 0.62 },
];

// Goalkeeper moves (zone = world column -1/0/1 and row 0 low / 1 mid / 2 high)
// x,y = where the hands end up; rx,ry = reach ellipse; dur = seconds to complete
export function keeperMove(col, row, shift) {
  const s = shift ? 1 : 0;
  if (col === 0) {
    if (row === 0) return { kind: 'crouch', name: 'Crouch Block',   x: 0, y: 0.5, rx: 1.0, ry: 0.55, dur: 0.30 + 0.1 * s };
    if (row === 1) return { kind: 'spread', name: 'Spread Block',   x: 0, y: 1.0, rx: 1.35, ry: 1.0, dur: 0.30 + 0.1 * s };
    return            { kind: 'jump',   name: 'Jump & Punch',   x: 0, y: 2.0, rx: 0.8 + 0.3 * s, ry: 1.0, dur: 0.45 + 0.1 * s };
  }
  const sg = Math.sign(col);
  if (row === 0) return { kind: 'dive', row, sg, name: shift ? 'Full Stretch Low' : 'Low Dive',       x: sg * (shift ? 2.9 : 2.45), y: 0.45, rx: shift ? 1.25 : 1.0,  ry: 0.55, dur: 0.50 + 0.12 * s };
  if (row === 1) return { kind: 'dive', row, sg, name: shift ? 'Full Stretch'     : 'Mid Dive',       x: sg * (shift ? 3.0 : 2.5),  y: 1.05, rx: shift ? 1.25 : 1.05, ry: 0.85, dur: 0.55 + 0.12 * s };
  return                 { kind: 'dive', row, sg, name: shift ? 'Superman Stretch' : 'Fingertip Dive', x: sg * (shift ? 3.0 : 2.4),  y: 1.85, rx: shift ? 1.2 : 0.95,  ry: 0.8,  dur: 0.65 + 0.12 * s };
}

// "Name|number|shooting rating|signature celebration (optional)"
const RAW = [
  { id: 'rma', name: 'Real Madrid', short: 'RMA', kit: 0xf4f4f4, shorts: 0xf4f4f4, trim: 0xd4af37, gk: 'Thibaut Courtois|1|88',
    p: ['Kylian Mbappé|10|94|cross', 'Vinícius Júnior|7|91|griddy', 'Jude Bellingham|5|89|plane', 'Federico Valverde|8|86', 'Rodrygo|11|86|flip', 'Arda Güler|15|85|shush'] },
  { id: 'bar', name: 'FC Barcelona', short: 'BAR', kit: 0xa50044, shorts: 0x004d98, trim: 0xedbb00, gk: 'Marc-André ter Stegen|1|87',
    p: ['Robert Lewandowski|9|93|plane', 'Lamine Yamal|10|90|cross', 'Raphinha|11|88|griddy', 'Pedri|8|85', 'Ferran Torres|7|85|robot', 'Dani Olmo|20|85|shush'] },
  { id: 'mci', name: 'Manchester City', short: 'MCI', kit: 0x6cabdd, shorts: 0xffffff, trim: 0x1c2c5b, gk: 'Gianluigi Donnarumma|25|88',
    p: ['Erling Haaland|9|95|meditate', 'Phil Foden|47|89|shush', 'Bernardo Silva|20|87', 'Jérémy Doku|11|85|griddy', 'Rayan Cherki|10|85|flip', 'Savinho|26|83|robot'] },
  { id: 'liv', name: 'Liverpool', short: 'LIV', kit: 0xc8102e, shorts: 0xc8102e, trim: 0xf6eb61, gk: 'Alisson Becker|1|89',
    p: ['Mohamed Salah|11|92|plane', 'Florian Wirtz|7|88|cradle', 'Alexander Isak|9|88|slide', 'Cody Gakpo|18|85', 'Dominik Szoboszlai|8|86|griddy', 'Virgil van Dijk|4|83|cross'] },
  { id: 'ars', name: 'Arsenal', short: 'ARS', kit: 0xef0107, shorts: 0xffffff, trim: 0x063672, gk: 'David Raya|22|86',
    p: ['Bukayo Saka|7|90|cradle', 'Martin Ødegaard|8|88', 'Gabriel Martinelli|11|85|slide', 'Kai Havertz|29|85', 'Viktor Gyökeres|14|88|cross', 'Declan Rice|41|86|plane'] },
  { id: 'bay', name: 'Bayern München', short: 'BAY', kit: 0xdc052d, shorts: 0xdc052d, trim: 0x0066b2, gk: 'Manuel Neuer|1|85',
    p: ['Harry Kane|9|94|shush', 'Michael Olise|17|88|griddy', 'Jamal Musiala|42|89|flip', 'Luis Díaz|14|86|slide', 'Serge Gnabry|7|85|robot', 'Joshua Kimmich|6|87'] },
  { id: 'psg', name: 'Paris Saint-Germain', short: 'PSG', kit: 0x0c2a5a, shorts: 0x0c2a5a, trim: 0xda291c, gk: 'Lucas Chevalier|30|84',
    p: ['Ousmane Dembélé|10|91|robot', 'Bradley Barcola|29|86|griddy', 'Khvicha Kvaratskhelia|7|88|slide', 'Désiré Doué|14|86|flip', 'Vitinha|17|87', 'Achraf Hakimi|2|85|plane'] },
  { id: 'int', name: 'Inter Milan', short: 'INT', kit: 0x0a3d8f, shorts: 0x111111, trim: 0x111111, gk: 'Yann Sommer|1|83',
    p: ['Lautaro Martínez|10|90|cross', 'Marcus Thuram|9|87|robot', 'Hakan Çalhanoğlu|20|89|shush', 'Nicolò Barella|23|85|griddy', 'Federico Dimarco|32|84', 'Denzel Dumfries|2|82|plane'] },
  { id: 'atm', name: 'Atlético Madrid', short: 'ATM', kit: 0xcb3524, shorts: 0x1c2b5a, trim: 0xffffff, gk: 'Jan Oblak|13|87',
    p: ['Julián Álvarez|19|89|slide', 'Antoine Griezmann|7|89|robot', 'Alexander Sørloth|9|84', 'Koke|6|82', 'Conor Gallagher|4|82|plane', 'Giuliano Simeone|20|80|griddy'] },
  { id: 'bvb', name: 'Borussia Dortmund', short: 'BVB', kit: 0xfde100, shorts: 0x111111, trim: 0x111111, gk: 'Gregor Kobel|1|86',
    p: ['Serhou Guirassy|9|86|plane', 'Karim Adeyemi|27|82|flip', 'Julian Brandt|10|84', 'Maximilian Beier|14|81|griddy', 'Felix Nmecha|8|80', 'Emre Can|23|80|cross'] },
  { id: 'che', name: 'Chelsea', short: 'CHE', kit: 0x034694, shorts: 0x034694, trim: 0xffffff, gk: 'Robert Sánchez|1|80',
    p: ['Cole Palmer|10|92|shush', 'Enzo Fernández|8|85|cradle', 'João Pedro|20|84|slide', 'Pedro Neto|7|83|griddy', 'Moisés Caicedo|25|84', 'Nicolas Jackson|15|80|robot'] },
  { id: 'tot', name: 'Tottenham Hotspur', short: 'TOT', kit: 0xf2f2f2, shorts: 0x132257, trim: 0x132257, gk: 'Guglielmo Vicario|1|82',
    p: ['Dominic Solanke|19|83', 'Mohammed Kudus|20|84|griddy', 'Xavi Simons|7|84|flip', 'James Maddison|10|84|shush', 'Richarlison|9|80|robot', 'Dejan Kulusevski|21|82|cross'] },
  { id: 'nap', name: 'SSC Napoli', short: 'NAP', kit: 0x12a0d7, shorts: 0x12a0d7, trim: 0xffffff, gk: 'Alex Meret|1|80',
    p: ['Kevin De Bruyne|11|90|shush', 'Romelu Lukaku|9|85|slide', 'Scott McTominay|8|85|plane', 'David Neres|7|82|griddy', 'Rasmus Højlund|19|82|robot', 'Matteo Politano|21|80'] },
  { id: 'juv', name: 'Juventus', short: 'JUV', kit: 0xeeeeee, shorts: 0x111111, trim: 0x111111, gk: 'Michele Di Gregorio|29|80',
    p: ['Dušan Vlahović|9|85|slide', 'Kenan Yıldız|10|86|cross', 'Jonathan David|30|84', 'Teun Koopmeiners|8|82', 'Francisco Conceição|7|82|flip', 'Khéphren Thuram|19|80|griddy'] },
  { id: 'ben', name: 'SL Benfica', short: 'BEN', kit: 0xe30613, shorts: 0xffffff, trim: 0xffffff, gk: 'Anatoliy Trubin|1|82',
    p: ['Vangelis Pavlidis|14|83', 'Ángel Di María|11|83|cradle', 'Orkun Kökçü|10|82', 'Kerem Aktürkoğlu|17|82|robot', 'Fredrik Aursnes|8|78', 'Andreas Schjelderup|21|78|flip'] },
  { id: 'avl', name: 'Aston Villa', short: 'AVL', kit: 0x7b0f3a, shorts: 0xffffff, trim: 0x95bfe5, gk: 'Emiliano Martínez|23|86',
    p: ['Ollie Watkins|11|84|plane', 'Morgan Rogers|27|85|griddy', 'Emiliano Buendía|10|80', 'Leon Bailey|31|80|robot', 'John McGinn|7|80|slide', 'Youri Tielemans|8|80'] },
];

export const SKIN_TONES = [0xf3d2b3, 0xe5b48c, 0xc98d5f, 0x9a6239, 0x6b4226, 0x3f2716];
export const HAIR_COLORS = [0x111111, 0x2b1a10, 0x5a3a1e, 0xc9a15a, 0x8b2f1c, 0xe8e0d0];
export const GK_KITS = [0x16c172, 0xf2a900, 0xe84393, 0x7b61ff, 0xff6a1a];

function hash(s) { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));

export function lookFor(name) {
  const h = hash(name);
  return { skin: h % 6, hair: (h >>> 3) % 6, hairStyle: (h >>> 7) % 4, boots: [0x111111, 0xff5a00, 0x00d4ff, 0xffffff, 0xd7ff00][(h >>> 11) % 5] };
}

function parsePlayer(s, tid, i) {
  const [name, num, r, cel] = s.split('|');
  const n = +num, R = +r;
  return { id: tid + ':' + i, name, num: n, r: R,
    pow: clamp(R + ((n * 7) % 9) - 4, 50, 99), fin: clamp(R + ((n * 5) % 9) - 4, 50, 99), acc: R,
    cel: cel || null, look: lookFor(name) };
}

export const TEAMS = RAW.map(t => ({
  id: t.id, name: t.name, short: t.short, kit: t.kit, shorts: t.shorts, trim: t.trim,
  players: t.p.map((s, i) => parsePlayer(s, t.id, i)),
  gk: (() => { const [name, num, r] = t.gk.split('|'); return { id: t.id + ':gk', name, num: +num, r: +r, look: lookFor(name), gk: true }; })(),
}));

export const ALL_PLAYERS = TEAMS.flatMap(t => t.players.map(p => ({ ...p, team: t.short })));
export const ALL_KEEPERS = TEAMS.map(t => ({ ...t.gk, team: t.short }));

export function teamLuma(c) { const r = (c >> 16) & 255, g = (c >> 8) & 255, b = c & 255; return (0.299 * r + 0.587 * g + 0.114 * b) / 255; }
