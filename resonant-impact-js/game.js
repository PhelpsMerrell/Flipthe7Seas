// Resonant Impact — demo engine. One engine, two looks.
// The theme switch only toggles a class on <html> ("theme-fantasy" / "theme-console").
// Console (or reduced motion) also makes text appear instantly.
// Stories are data: stories/manifest.json maps races to story files (shared with the Godot build).
const MANIFEST = await (await fetch('./stories/manifest.json')).json();
const { races: RACES, stat_names: STAT_NAMES } = MANIFEST;
const STORY_CACHE = {};
let STORY = null;   // the story being played
let NODES = {};
async function loadStoryFor(raceId) {
  const key = (MANIFEST.story_by_race || {})[raceId] || MANIFEST.default_story;
  if (!STORY_CACHE[key]) STORY_CACHE[key] = await (await fetch('./stories/' + MANIFEST.stories[key].file)).json();
  STORY = STORY_CACHE[key];
  NODES = STORY.nodes;
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];
const BASE = { worried: 1, happy: 1.15, laugh: 1.3, incredulous: 1.15, sad: 0.6, thoughtful: 0.8, awe: 0.8 };
const TAGF = { shout: 1.7, big: 0.85, whisper: 0.5, cold: 0.65, hot: 1.1, glow: 0.7, fall: 0.8, sad: 0.55, laugh: 1.3, warm: 0.85, forest: 0.75 };
const PLACE = { forest: 'The Eternal Forest', elf: 'Beside the Holy Trove', pit: 'The Holy Trove', path: 'The Perimeter Path',
  clearing: 'The Clearing', beast: 'The Clearing', home: 'Home', night: 'Nightfall' };
const MOODS = ['forest', 'elf', 'pit', 'path', 'clearing', 'beast', 'home', 'night'];
const MONO_COLORS = 4;   // .mono.c0 … .c3 in style.css
const ENDING = { win: 'The End', lose: 'The End · You lose', death: 'Game Over' };

const html = document.documentElement;
const screen = document.getElementById('screen');
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const S = { phase: 'studio', node: null, name: '', race: null, focus: 'human', aff: 0, asked: {}, vars: {}, theme: readTheme(), reduce: readReduce() };
let timers = [];
let finishLine = null;
let typing = false;

function later(fn, ms) { timers.push(setTimeout(fn, ms)); }
function clearTimers() { timers.forEach(clearTimeout); timers = []; }
const isConsole = () => S.theme === 'console';
const instant = () => isConsole() || S.reduce;

/* ---------- settings: the one switch ---------- */
function readTheme() {
  const q = new URLSearchParams(location.search).get('theme');
  if (q === 'console' || q === 'fantasy') return q;
  try { return localStorage.getItem('ri.theme') || 'fantasy'; } catch (e) { return 'fantasy'; }
}
function readReduce() {
  try { const v = localStorage.getItem('ri.reduce'); if (v !== null) return v === '1'; } catch (e) {}
  try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; }
}
function setTheme(t) {
  S.theme = t;
  try { localStorage.setItem('ri.theme', t); } catch (e) {}
  applySettings();
  if (instant() && finishLine) finishLine();
}
function setReduce(v) {
  S.reduce = v;
  try { localStorage.setItem('ri.reduce', v ? '1' : '0'); } catch (e) {}
  applySettings();
  if (instant() && finishLine) finishLine();
}
function applySettings() {
  html.classList.toggle('theme-console', isConsole());
  html.classList.toggle('theme-fantasy', !isConsole());
  html.classList.toggle('reduce', S.reduce);
  $$('[data-theme-btn]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.themeBtn === S.theme)));
  $('#motionBtn').setAttribute('aria-pressed', String(S.reduce));
  $('#motionBtn').textContent = S.reduce ? 'Still' : 'Motion';
}
$$('[data-theme-btn]').forEach((b) => b.addEventListener('click', () => setTheme(b.dataset.themeBtn)));
$('#motionBtn').addEventListener('click', () => setReduce(!S.reduce));
$('#restartBtn').addEventListener('click', () => restart());

/* ---------- ambience ---------- */
(function makeSnow() {
  const el = $('#snow');
  for (let i = 0; i < 32; i++) {
    const f = document.createElement('i');
    const s = (1.5 + Math.random() * 2.5).toFixed(1);
    f.style.cssText = `left:${(Math.random() * 100).toFixed(1)}%;width:${s}px;height:${s}px;animation-duration:${(10 + Math.random() * 10).toFixed(1)}s;animation-delay:${(-Math.random() * 20).toFixed(1)}s`;
    el.append(f);
  }
})();
function setScene(s) { html.dataset.scene = MOODS.includes(s) ? s : 'forest'; }
function toast(text) {
  const t = $('#toast');
  t.textContent = '✦ ' + text;
  t.classList.remove('show'); void t.offsetWidth; t.classList.add('show');
}

/* ---------- text ---------- */
function parse(raw) {
  const txt = raw.replace(/\{name\}/g, S.name || 'friend');
  const segs = []; const re = /\[(\w+)\|([^\]]+)\]/g; let m, last = 0;
  while ((m = re.exec(txt))) { if (m.index > last) segs.push({ st: '', t: txt.slice(last, m.index) }); segs.push({ st: m[1], t: m[2] }); last = re.lastIndex; }
  if (last < txt.length) segs.push({ st: '', t: txt.slice(last) });
  const words = [], styles = []; let idx = 0;
  for (const sg of segs) {
    for (const tok of sg.t.split(/(\s+)/)) {
      if (!tok) continue;
      for (let k = 0; k < tok.length; k++) styles.push(sg.st);
      if (/^\s+$/.test(tok)) { idx += tok.length; continue; }
      words.push({ st: sg.st, start: idx, ch: Array.from(tok) });
      idx += tok.length;
    }
  }
  return { words, styles, len: idx, plain: segs.map((s) => s.t).join('') };
}

/* ---------- screens ---------- */
function studio() {
  S.phase = 'studio';
  html.className = html.className.replace(/\bph-\S+/g, '').trim(); html.classList.add('ph-studio');
  setScene('forest');
  screen.innerHTML = `<button class="studio" id="skip" aria-label="Skip intro"><span class="a1">a</span><span class="a2">This Spanks Gaming</span><span class="a3">production</span></button>`;
  $('#skip').onclick = title;
  later(title, instant() ? 1200 : 3800);
}

function phase(p) {
  S.phase = p;
  html.className = html.className.replace(/\bph-\S+/g, '').trim();
  html.classList.add('ph-' + p);
}

function title() {
  clearTimers(); phase('title'); setScene('forest');
  screen.innerHTML = `<section class="title"><p class="kicker">A tale of the Eternal Forest</p><h1>Resonant Impact</h1><p class="orn" aria-hidden="true">❄ ❦ ❄</p></section><nav class="opts menu" id="menu"></nav>`;
  later(() => {
    $('#menu').innerHTML = `<button class="plaque center" id="startBtn">Start Game</button>`;
    $('#startBtn').onclick = menu;
  }, instant() ? 0 : 2400);
}

function menu() {
  phase('menu');
  $('#menu').innerHTML = ['New Game', 'Continue', 'Extras'].map((t, i) =>
    `<button class="plaque center${i ? ' locked' : ''}" data-i="${i}" ${i ? 'aria-disabled="true"' : ''} style="animation-delay:${i * 120}ms">${t}${i ? ' <span class="lock">(locked)</span>' : ''}</button>`).join('');
  $$('#menu .plaque').forEach((b) => b.onclick = () => {
    if (+b.dataset.i === 0) return plunge();
    b.classList.remove('nope'); void b.offsetWidth; b.classList.add('nope');
  });
}

function plunge() {
  phase('plunge');
  later(race, instant() ? 0 : 1800);
}

function race() {
  phase('race');
  const r = RACES.find((x) => x.id === S.focus);
  screen.innerHTML = `<section class="race"><h2>Who are you?</h2><div class="opts rows">${RACES.map((x) =>
    `<button class="race-row${x.id === S.focus ? ' on' : ''}" data-id="${x.id}" aria-pressed="${x.id === S.focus}">
      <span class="rn">${x.name}</span><span class="rw">${x.where}</span>
      <span class="rs">${x.stats.map((v, i) => `${STAT_NAMES[i]} +${v}`).join(' · ')}</span>
      ${x.id === S.focus ? `<span class="rd">${esc(x.desc)}</span>` : ''}
    </button>`).join('')}</div><button class="plaque center" id="beginBtn">Begin as ${r.name}</button></section>`;
  $$('.race-row').forEach((b) => b.onclick = () => { S.focus = b.dataset.id; race(); $(`.race-row[data-id="${S.focus}"]`).focus(); });
  $('#beginBtn').onclick = wake;
}

async function wake() {
  S.race = S.focus;
  $('#beginBtn').disabled = true;
  await loadStoryFor(S.race);
  resetStoryState();
  const fade = STORY.intro !== 'wake';
  phase(fade ? 'fadein' : 'wake'); setScene((NODES[STORY.start] || {}).scene || 'forest');
  screen.innerHTML = '';
  later(talkStart, instant() ? 0 : fade ? 1800 : 3000);
}
function resetStoryState() {
  S.vars = JSON.parse(JSON.stringify(STORY.vars || {}));
  S.aff = 0; S.asked = {}; S.name = '';
}

/* ---------- talk ---------- */
function talkStart() {
  phase('talk');
  screen.innerHTML = `<section class="talk"><div class="loc" id="loc"></div><div class="log" id="log"></div><div class="opts" id="opts"></div></section>`;
  $('#log').addEventListener('click', () => { if (finishLine) finishLine(); });
  go(STORY.start);
}

function addLog(kind, content, asHtml) {
  const el = document.createElement(kind === 'block' ? 'div' : 'p');
  el.className = kind;
  if (asHtml) el.innerHTML = content; else el.textContent = content;
  $('#log').append(el);
  scrollEnd();
  return el;
}
function scrollEnd() { const l = $('#log'); if (l) l.scrollTop = l.scrollHeight; }

/* ---------- story logic: vars, requirements, effects ---------- */
function meets(req) {
  if (!req) return true;
  const v = (k) => S.vars[k] ?? 0;
  for (const [k, n] of Object.entries(req.min || {})) if (v(k) < n) return false;
  for (const [k, n] of Object.entries(req.max || {})) if (v(k) > n) return false;
  for (const [k, n] of Object.entries(req.eq || {})) if ((S.vars[k] ?? null) !== n) return false;
  return true;
}
function applyFx(fx) {
  if (!fx) return;
  for (const [k, n] of Object.entries(fx.add || {})) S.vars[k] = (S.vars[k] ?? 0) + n;
  for (const [k, n] of Object.entries(fx.set || {})) S.vars[k] = n;
}
const visibleChoices = (n) => (n.choices || []).filter((c) => meets(c.req));

function go(id) {
  let n = NODES[id];
  for (let hop = 0; n && n.redirect && hop < 8; hop++) {
    const r = n.redirect.find((x) => meets(x.when));
    if (!r) break;
    id = r.to; n = NODES[id];
  }
  if (!n) { console.error('Missing story node', id); return; }
  S.node = id;
  setScene(n.scene);
  $('#loc').textContent = (STORY.places || {})[n.scene] || PLACE[n.scene] || '';
  if (n.cap) addLog('cap', fill(n.cap));
  showLine(n);
}
const fill = (s) => s.replace(/\{name\}/g, S.name || 'friend');

// Display name for a line: characters[who]; '' = narration. `reveal` swaps in a name once typed.
function speaker(n, revealedTo, p) {
  const chars = STORY.characters || {};
  if (n.reveal && revealedTo > p.plain.indexOf(n.reveal)) return n.reveal;
  return chars[n.who] ?? n.who ?? '';
}
function monoColor(name) {
  const named = Object.values(STORY.characters || {}).filter((v) => v);
  const i = named.indexOf(name);
  return 'c' + ((i < 0 ? 0 : i) % MONO_COLORS);
}

function showLine(n) {
  const p = parse(n.text);  // parse() fills {name}
  const block = document.createElement('div');
  block.className = 'line now';
  block.innerHTML = `<span class="mono" aria-hidden="true"></span><span class="who"></span><p class="say em-${n.emo}"></p>`;
  $('#log').append(block);
  const say = $('.say', block), who = $('.who', block), mono = $('.mono', block);
  const words = p.words.map((w) => {
    const el = document.createElement('span');
    el.className = 'w' + (w.st ? ' s-' + w.st : '');
    say.append(el);
    return { ...w, el, shown: 0 };
  });
  let current = null;
  const setWho = (to) => {
    const name = speaker(n, to, p);
    if (name === current) return;
    const wasSet = current !== null;
    current = name;
    block.classList.toggle('narr', !name);
    who.textContent = name;
    mono.textContent = !name ? '' : /^unknown$/i.test(name) ? '?' : name[0].toUpperCase();
    mono.className = 'mono ' + monoColor(name);
    if (wasSet && name) { who.classList.add('named'); mono.classList.add('named'); }
  };
  const revealTo = (target) => {
    for (const w of words) {
      while (w.shown < w.ch.length && w.start + w.shown < target) {
        const i = w.start + w.shown;
        const l = document.createElement('span');
        l.className = 'l' + (i % 3 === 0 ? ' sp' : '');
        const d = (w.st === 'fall' || w.st === 'big' || w.st === 'shout') ? 0 : (i * 0.07) % 2.2;
        l.style.animationDelay = `0s, ${d.toFixed(2)}s`;
        l.textContent = w.ch[w.shown++];
        w.el.append(l);
      }
    }
    setWho(target);
    scrollEnd();
  };
  let pos = 0, hold = 0, last = performance.now(), done = false;
  const finish = () => {
    if (done) return;
    done = true; typing = false; finishLine = null;
    revealTo(p.len + 1);
    block.classList.remove('typing');
    if (n.end) ending(n); else showChoices(n);
  };
  setWho(0);
  if (instant()) { finish(); return; }
  typing = true; finishLine = finish;
  block.classList.add('typing');
  const frame = (now) => {
    if (done) return;
    const dt = Math.min(0.1, (now - last) / 1000); last = now;
    if (hold > 0) hold -= dt;
    else {
      const from = Math.floor(pos);
      pos += dt * 33 * (BASE[n.emo] || 1) * (TAGF[p.styles[from]] || 1);
      for (let k = from; k < Math.floor(pos) && k < p.len; k++) {
        const ch = p.plain[k];
        const pause = ch === '…' ? 0.5 : ('.!?'.includes(ch) && p.plain[k + 1] === ' ') ? 0.27 : (ch === ',' || ch === '—') ? 0.15 : 0;
        if (pause) { hold = pause; pos = k + 1; break; }
      }
      revealTo(pos);
    }
    if (pos >= p.len) finish(); else requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

function showChoices(n) {
  const opts = $('#opts');
  const list = visibleChoices(n);
  opts.classList.toggle('many', list.length > 3);
  opts.innerHTML = list.map((c, i) =>
    `<button class="plaque${c.death ? ' death' : ''}" data-i="${i}" style="animation-delay:${80 + i * 90}ms"><span class="num" aria-hidden="true">${ROMAN[i]}</span><span class="ct">${esc(c.t)}</span>${c.death ? '<span class="tag">Certain Death</span>' : ''}${c.q && S.asked[c.q] ? '<span class="tag">asked</span>' : ''}</button>`).join('');
  $$('.plaque', opts).forEach((b) => b.onclick = () => choose(+b.dataset.i));
}

function settleLine(said) {
  $$('#log .line.now').forEach((el) => { el.classList.remove('now'); el.classList.add('old'); });
  if (said) addLog('you', said);
}

function choose(i) {
  const n = NODES[S.node], c = visibleChoices(n)[i];
  if (!c) return;
  if (c.input) return askName(c);
  const opts = $('#opts');
  $$('.plaque', opts).forEach((b, k) => { b.disabled = true; b.classList.add(k === i ? 'picked' : 'dim'); });
  later(() => {
    opts.innerHTML = '';
    settleLine(fill(c.say || c.t));
    applyFx(c.fx);
    if (c.aff) {
      S.aff += c.aff;
      if (STORY.show_affinity) {
        const who = STORY.affinity_name;
        const label = `+${c.aff} ` + (S.name && who ? `${who} Affinity` : 'Affinity');
        if (isConsole()) addLog('note', `(${label})`); else toast(label);
      }
    }
    if (c.q) S.asked[c.q] = true;
    go(c.to);
  }, instant() ? 0 : 450);
}

function askName(c) {
  const opts = $('#opts');
  opts.classList.remove('many');
  opts.innerHTML = `<form class="namebox" id="nameForm" autocomplete="off">
    <label for="nameInput">What is your name?</label>
    <div class="row"><input id="nameInput" name="name" maxlength="18" placeholder="Your name" enterkeyhint="done"><button class="plaque" type="submit">That’s me</button></div>
  </form>`;
  const input = $('#nameInput');
  input.focus();
  $('#nameForm').addEventListener('submit', (e) => {
    e.preventDefault();
    S.name = input.value.trim().slice(0, 18) || 'Wren';
    opts.innerHTML = '';
    settleLine(c.say ? fill(c.say) : `I’m ${S.name}.`);
    go(c.to);
  });
}

// End nodes: the line plays, then this card. Try again = node.rewind (vars kept) or the start (fresh).
function ending(n) {
  const kind = n.end in ENDING ? n.end : 'win';
  const race = RACES.find((r) => r.id === S.race);
  const rows = [];
  if (S.name) rows.push(['Name', S.name]);
  rows.push(['Race', race ? race.name : '—'], ['Story', STORY.title || '—'], ['Ending', { win: 'Victory', lose: 'Defeat', death: 'Death' }[kind]]);
  if (STORY.show_affinity) {
    rows.push([(STORY.affinity_name ? STORY.affinity_name + ' affinity' : 'Affinity'), '+' + S.aff]);
    const qs = new Set(); Object.values(NODES).forEach((x) => (x.choices || []).forEach((c) => c.q && qs.add(c.q)));
    if (qs.size) rows.push(['Questions asked', Object.keys(S.asked).length + ' of ' + qs.size]);
  }
  const head = kind === 'death'
    ? `<p class="go">Game Over</p>${n.end_title ? `<p class="cd">${esc(n.end_title)}</p>` : ''}`
    : `<h2>${esc(n.end_title || ENDING[kind])}</h2>`;
  addLog('block', `${head}<dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`, true).classList.add('endcard', 'end-' + kind);
  const opts = $('#opts');
  opts.classList.remove('many');
  const again = n.rewind ? 'Rewind the moment' : kind === 'win' ? 'Play again' : 'Try again';
  opts.innerHTML = `<button class="plaque center" id="againBtn">${again}</button><button class="plaque center" id="titleBtn">Return to title</button>`;
  $('#againBtn').onclick = () => {
    opts.innerHTML = '';
    if (n.rewind) { settleLine(); return go(n.rewind); }
    resetStoryState();
    $('#log').innerHTML = '';
    go(STORY.start);
  };
  $('#titleBtn').onclick = restart;
}

function restart() {
  clearTimers(); finishLine = null; typing = false;
  Object.assign(S, { node: null, name: '', race: null, focus: 'human', aff: 0, asked: {}, vars: {} });
  title();
}

/* ---------- keyboard: Enter/Space finishes a line, 1–5 picks a choice ---------- */
document.addEventListener('keydown', (e) => {
  if (e.target.closest && e.target.closest('input, textarea')) return;
  if ((e.key === 'Enter' || e.key === ' ') && finishLine) { e.preventDefault(); finishLine(); return; }
  const k = parseInt(e.key, 10);
  if (k >= 1 && k <= 5) { const b = $$('#opts .plaque, #menu .plaque')[k - 1]; if (b && !b.disabled) b.click(); }
});

applySettings();
studio();
