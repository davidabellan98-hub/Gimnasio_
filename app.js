'use strict';
const APP_VERSION = 29; // igual que VERSION en sw.js

/* ============ Estado y almacenamiento ============ */
const KEY = 'gymlog.v1';
const COMMON_EXERCISES = [
  'Press banca', 'Press inclinado mancuernas', 'Press militar', 'Fondos', 'Aperturas',
  'Dominadas', 'Remo con barra', 'Remo en polea', 'Jalón al pecho', 'Face pull',
  'Sentadilla', 'Peso muerto', 'Peso muerto rumano', 'Prensa', 'Zancadas', 'Hip thrust',
  'Extensión de cuádriceps', 'Curl femoral', 'Gemelos', 'Curl bíceps', 'Curl martillo',
  'Extensión tríceps polea', 'Press francés', 'Elevaciones laterales', 'Plancha', 'Crunch en polea'
];

function blankState() {
  return { version: 1, settings: { weeklyGoal: 3 }, routines: [], sessions: [], active: null, reportNotes: {} };
}
function load() {
  try {
    const d = JSON.parse(localStorage.getItem(KEY));
    if (d && d.version) return Object.assign(blankState(), d);
  } catch (e) { /* datos corruptos o sin acceso */ }
  return blankState();
}
let S = load();
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('No se pudo guardar: ' + e.message); }
}
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);

/* ============ Utilidades ============ */
const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isFinite(n) ? n : 0; };
const fmtN = (n) => (Math.round(n * 10) / 10).toLocaleString('es-ES');
const DAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

function ymd(d) {
  const x = new Date(d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
}
function weekStart(d) {
  const x = new Date(d); x.setHours(0, 0, 0, 0);
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
// Número de semana ISO 8601 (la semana 1 es la que contiene el primer jueves).
// Se calcula en UTC para que el cambio de horario de verano no lo descuadre.
function isoWeek(d) {
  const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  x.setUTCDate(x.getUTCDate() + 3 - ((x.getUTCDay() + 6) % 7)); // jueves de esa semana
  return 1 + Math.floor((x - Date.UTC(x.getUTCFullYear(), 0, 1)) / 864e5 / 7);
}
const hhmm = (d) => { const x = new Date(d); return String(x.getHours()).padStart(2, '0') + ':' + String(x.getMinutes()).padStart(2, '0'); };
// Minutos entre la hora de inicio del entreno y la hora de fin (si la de fin es menor, pasó la medianoche)
function pastDuration(a) {
  if (!a.endTime) return 0;
  const s = new Date(a.date); const [h, m] = a.endTime.split(':').map(Number);
  let mins = h * 60 + m - (s.getHours() * 60 + s.getMinutes());
  if (mins <= 0) mins += 1440;
  return mins;
}
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function fmtDate(d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(d).toLocaleDateString('es-ES', opts);
}
function fmtDur(min) {
  min = Math.round(min || 0);
  return min >= 60 ? Math.floor(min / 60) + ' h ' + (min % 60) + ' min' : min + ' min';
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2200);
}

/* ============ Cálculos ============ */
const sorted = () => [...S.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
function sessionsInWeek(ws) {
  const we = addDays(ws, 7);
  return S.sessions.filter((s) => { const d = new Date(s.date); return d >= ws && d < we; })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}
function daysTrained(list) { return new Set(list.map((s) => ymd(s.date))).size; }
function setVolume(st) { return num(st.w) * num(st.r); }
function exVolume(ex) { return ex.sets.reduce((a, st) => a + setVolume(st), 0); }
function sessVolume(s) { return s.exercises.reduce((a, ex) => a + exVolume(ex), 0); }
function sessSets(s) { return s.exercises.reduce((a, ex) => a + ex.sets.length, 0); }
const e1rm = (w, r) => (r > 0 && w > 0 ? w * (1 + r / 30) : 0);
function bestSet(ex) {
  let best = null;
  for (const st of ex.sets) {
    const v = e1rm(num(st.w), num(st.r));
    if (!best || v > best.v || (v === best.v && num(st.r) > num(best.r))) best = { w: num(st.w), r: num(st.r), v };
  }
  return best;
}
function setsText(ex) {
  return ex.sets.map((st) => (num(st.w) ? fmtN(num(st.w)) + '×' : '') + num(st.r)).join(', ');
}
function lastPerformance(name, beforeDate, excludeId) {
  const n = name.trim().toLowerCase();
  for (const s of sorted()) {
    if (s.id === excludeId) continue;
    if (beforeDate && new Date(s.date) >= new Date(beforeDate)) continue;
    const ex = s.exercises.find((e) => e.name.trim().toLowerCase() === n);
    if (ex && ex.sets.length) return { session: s, ex };
  }
  return null;
}
function streakWeeks() {
  const goal = S.settings.weeklyGoal || 1;
  let ws = weekStart(new Date());
  let count = 0;
  // la semana actual cuenta si ya se cumplió; si no, no rompe la racha
  if (daysTrained(sessionsInWeek(ws)) >= goal) count++;
  ws = addDays(ws, -7);
  while (daysTrained(sessionsInWeek(ws)) >= goal) { count++; ws = addDays(ws, -7); }
  return count;
}
function allExerciseNames() {
  const set = new Set(COMMON_EXERCISES);
  S.routines.forEach((r) => r.exercises.forEach((e) => e.name && set.add(e.name)));
  S.sessions.forEach((s) => s.exercises.forEach((e) => e.name && set.add(e.name)));
  return [...set].sort((a, b) => a.localeCompare(b, 'es'));
}


/* ============ Evolución ============ */
// Una entrada por sesión en la que se hizo el ejercicio, de la más antigua a la más reciente.
function exerciseSeries(name) {
  const n = name.trim().toLowerCase();
  const out = [];
  for (const s of [...S.sessions].sort((a, b) => new Date(a.date) - new Date(b.date))) {
    const exs = s.exercises.filter((e) => e.name.trim().toLowerCase() === n && e.sets.length);
    if (!exs.length) continue;
    const sets = exs.flatMap((e) => e.sets);
    const b = bestSet({ sets });
    out.push({
      date: new Date(s.date),
      e1rm: b ? b.v : 0,
      maxW: Math.max(0, ...sets.map((st) => num(st.w))),
      maxR: Math.max(0, ...sets.map((st) => num(st.r))),
      vol: sets.reduce((a, st) => a + setVolume(st), 0),
      best: b
    });
  }
  return out;
}
// Ejercicios con historial, ordenados por los más usados últimamente.
function trackedExercises() {
  const m = new Map();
  sorted().forEach((s, i) => s.exercises.forEach((e) => {
    const k = e.name.trim().toLowerCase();
    if (!k || !e.sets.length) return;
    const c = m.get(k) || { name: e.name.trim(), n: 0, last: i };
    c.n++; m.set(k, c);
  }));
  return [...m.values()].sort((a, b) => (b.n - a.n) || (a.last - b.last));
}
const METRICS = {
  e1rm: { label: '1RM estimado', unit: 'kg', get: (p) => p.e1rm },
  maxW: { label: 'Peso máximo', unit: 'kg', get: (p) => p.maxW },
  maxR: { label: 'Reps máximas', unit: 'reps', get: (p) => p.maxR },
  vol: { label: 'Volumen', unit: 'kg', get: (p) => p.vol }
};

/* ============ Gráficos (SVG) ============ */
function niceTicks(min, max, n = 4) {
  if (min === max) { min = min > 0 ? min * 0.9 : min - 1; max = max * 1.1 || 1; }
  const raw = (max - min) / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((f) => f * mag).find((x) => x >= raw);
  const lo = Math.floor(min / step) * step;
  const ticks = [];
  for (let v = lo; v <= max + step * 0.001; v += step) ticks.push(+v.toFixed(6));
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}
// points: [{x: Date, y: number}]
function lineChart(points, unit) {
  const W = 340, H = 190, L = 40, R = 12, T = 14, B = 26;
  if (points.length < 2) return '<p class="muted small">Necesitas al menos 2 entrenos con este ejercicio para ver la gráfica.</p>';
  const xs = points.map((p) => +p.x), ys = points.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const y0 = ticks[0], y1 = ticks[ticks.length - 1];
  const X = (v) => L + ((v - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (v) => T + (1 - (v - y0) / (y1 - y0 || 1)) * (H - T - B);
  const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" class="g"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end">${fmtN(t)}</text>`).join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${X(+p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join('');
  const area = `${path}L${X(x1).toFixed(1)},${H - B}L${X(x0).toFixed(1)},${H - B}Z`;
  const maxY = Math.max(...ys);
  const dots = points.map((p) => `<circle cx="${X(+p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="${p.y === maxY ? 4.5 : 3}" class="${p.y === maxY ? 'pr' : 'd'}"><title>${fmtDate(p.x, { day: 'numeric', month: 'short', year: 'numeric' })}: ${fmtN(p.y)} ${unit}</title></circle>`).join('');
  const lab = (d) => fmtDate(d, { day: 'numeric', month: 'short' });
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Evolución">
    ${grid}
    <path d="${area}" class="a"/><path d="${path}" class="l"/>${dots}
    <text x="${L}" y="${H - 6}">${lab(x0)}</text><text x="${W - R}" y="${H - 6}" text-anchor="end">${lab(x1)}</text>
  </svg>`;
}
// bars: [{label, v, hi}]
function barChart(bars, unit) {
  const W = 340, H = 170, L = 40, R = 6, T = 12, B = 22;
  const ticks = niceTicks(0, Math.max(1, ...bars.map((b) => b.v)));
  const y1 = ticks[ticks.length - 1];
  const Y = (v) => T + (1 - v / y1) * (H - T - B);
  const bw = (W - L - R) / bars.length;
  const grid = ticks.map((t) => `<line x1="${L}" x2="${W - R}" y1="${Y(t)}" y2="${Y(t)}" class="g"/><text x="${L - 6}" y="${Y(t) + 4}" text-anchor="end">${t >= 1000 ? fmtN(t / 1000) + 'k' : fmtN(t)}</text>`).join('');
  const rects = bars.map((b, i) => {
    const x = L + i * bw + bw * 0.18, w = bw * 0.64, y = Y(b.v);
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${Math.max(0, H - B - y).toFixed(1)}" rx="3" class="${b.hi ? 'bh' : 'b'}"><title>${b.label}: ${fmtN(b.v)} ${unit}</title></rect>` +
      (i % 2 === bars.length % 2 || bars.length <= 8 ? `<text x="${(x + w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${b.label}</text>` : '');
  }).join('');
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Gráfico de barras">${grid}${rects}</svg>`;
}


/* ============ Importar sesiones del entrenador ============ */
// Ejemplo del formato que se pide al entrenador (también va al final del informe semanal).
const PLAN_EXAMPLE = {
  gymlog: 'sesiones',
  sesiones: [
    { nombre: 'Torso A', notas: 'Semana 3', ejercicios: [
      { nombre: 'Press banca', series: 4, reps: '6-8', kg: 72.5, descanso: 150, notas: 'pausa en el pecho' },
      { nombre: 'Remo con barra', series: 4, reps: '8-10', kg: 62.5, descanso: 120 }
    ] }
  ]
};
// Saca el JSON del texto pegado: acepta el JSON solo, dentro de un bloque ```json``` o rodeado de texto.
function extractPlanJSON(text) {
  const tries = [text];
  const fences = [...text.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)].map((m) => m[1]);
  tries.push(...fences.reverse());
  const a = text.indexOf('{'), b = text.lastIndexOf('}');
  if (a >= 0 && b > a) tries.push(text.slice(a, b + 1));
  for (const t of tries) {
    try { return JSON.parse(t.trim().replace(/[“”]/g, '"')); } catch (e) { /* siguiente intento */ }
  }
  throw new Error('no encuentro el bloque de sesiones. Copia el bloque de código que empieza por {');
}
function parsePlan(text) {
  const d = extractPlanJSON(text);
  let list = Array.isArray(d) ? d : (d.sesiones || d.sessions || d.rutinas || d.routines);
  if (!list && (d.nombre || d.name)) list = [d];
  if (!Array.isArray(list) || !list.length) throw new Error('el bloque no tiene ninguna sesión');
  const str = (v) => (v === undefined || v === null ? '' : String(v).trim());
  const out = list.map((s) => ({
    name: str(s.nombre ?? s.name),
    notes: str(s.notas ?? s.notes ?? s.objetivo),
    exercises: (s.ejercicios || s.exercises || []).map((e) => ({
      name: str(e.nombre ?? e.name ?? e.ejercicio),
      sets: str(e.series ?? e.sets) || '3',
      reps: str(e.reps ?? e.repeticiones),
      weight: num(str(e.kg ?? e.peso ?? e.weight)) ? str(e.kg ?? e.peso ?? e.weight).replace(',', '.') : '',
      rest: str(e.descanso ?? e.rest) || '90',
      notes: str(e.notas ?? e.notes)
    })).filter((e) => e.name)
  })).filter((s) => s.name && s.exercises.length);
  if (!out.length) throw new Error('las sesiones no tienen nombre o ejercicios');
  return out;
}
// Las sesiones con el mismo nombre se actualizan (conservan su historial); las nuevas se añaden.
function applyPlan(plan) {
  const key = (n) => n.trim().toLowerCase();
  for (const s of plan) {
    const i = S.routines.findIndex((r) => key(r.name) === key(s.name));
    if (i >= 0) S.routines[i] = { ...S.routines[i], name: s.name, notes: s.notes || S.routines[i].notes || '', exercises: s.exercises };
    else S.routines.push({ id: uid(), ...s });
  }
  save();
}

/* ============ Navegación ============ */
let tab = S.active ? 'train' : 'home';
let routineDraft = null;
let reportWeek = weekStart(new Date());
let progEx = null;
let progMetric = null;

let prevTab = 'home';
function go(t) {
  // El botón de ajustes funciona como interruptor: si ya estás en Ajustes, vuelve a donde estabas.
  if (t === 'settings') {
    if (tab === 'settings') t = prevTab;
    else prevTab = tab;
  }
  tab = t; render(); window.scrollTo(0, 0);
}

const TITLES = { home: 'Actividad', routines: 'Sesiones', routineEdit: 'Editar sesión', routineImport: 'Importar sesiones', train: 'Entrenar', history: 'Historial', progress: 'Progreso', report: 'Informe semanal', settings: 'Ajustes' };

function render() {
  $('#title').textContent = tab === 'train' && S.active && S.active.past ? (S.active.editingId ? 'Editar entreno' : 'Registrar entrenamiento') : (TITLES[tab] || 'GymLog');
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab || ((tab === 'routineEdit' || tab === 'routineImport') && b.dataset.tab === 'routines'));
  });
  $('.primary-tab').classList.toggle('live', !!S.active);
  $('.topbar .icon-btn').classList.toggle('on', tab === 'settings');
  $('.topbar .icon-btn').setAttribute('aria-label', tab === 'settings' ? 'Cerrar ajustes' : 'Ajustes');
  $('#exnames').innerHTML = allExerciseNames().map((n) => `<option value="${esc(n)}">`).join('');
  const v = { home: viewHome, routines: viewRoutines, routineEdit: viewRoutineEdit, routineImport: viewRoutineImport, train: viewTrain, history: viewHistory, progress: viewProgress, report: viewReport, settings: viewSettings }[tab];
  $('#view').innerHTML = v();
  if (tab === 'report') $('#reportText').textContent = buildReport(reportWeek);
}

/* ============ Vistas ============ */
function viewHome() {
  const goal = S.settings.weeklyGoal;
  const ws = weekStart(new Date());
  const thisWeek = daysTrained(sessionsInWeek(ws));
  const pct = Math.min(100, Math.round((thisWeek / goal) * 100));
  const monthKey = ymd(new Date()).slice(0, 7);
  const monthDays = new Set(S.sessions.filter((s) => ymd(s.date).startsWith(monthKey)).map((s) => ymd(s.date))).size;

  // Heatmap 16 semanas: fila de meses arriba, días de la semana a la izquierda.
  // Es una ventana móvil: siempre muestra las 16 últimas semanas hasta la actual.
  const trainedDays = {};
  S.sessions.forEach((s) => { const k = ymd(s.date); trainedDays[k] = (trainedDays[k] || 0) + 1; });
  const start = addDays(ws, -7 * 15);
  const today = ymd(new Date());
  const MES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  // Columna en la que empieza cada mes (la del día 1, o la primera columna para el mes inicial)
  const monthAt = [];
  for (let c = 0; c < 16; c++) {
    const days = Array.from({ length: 7 }, (_, r) => addDays(start, c * 7 + r));
    const first = days.find((d) => d.getDate() === 1);
    if (first) monthAt[c] = first;
  }
  // Etiqueta del mes inicial solo si hay sitio antes del siguiente cambio de mes
  if (!monthAt[0] && !monthAt[1] && !monthAt[2]) monthAt[0] = start;
  let grid = '<span></span>';
  for (let c = 0; c < 16; c++) {
    const d = monthAt[c];
    grid += `<span class="hm ${d ? 'on' : ''}">${d ? MES[d.getMonth()] + (d.getMonth() === 0 || c === 0 ? ' ' + String(d.getFullYear()).slice(2) : '') : ''}</span>`;
  }
  // Número de semana del año (ISO 8601: la semana 1 es la que contiene el primer jueves)
  grid += '<span></span>';
  for (let c = 0; c < 16; c++) {
    const wn = isoWeek(addDays(start, c * 7));
    grid += `<span class="hw ${c === 15 ? 'now' : ''}">${wn}</span>`;
  }
  ['L', '', 'X', '', 'V', '', 'D'].forEach((lab, r) => {
    grid += `<span class="hd">${lab}</span>`;
    for (let c = 0; c < 16; c++) {
      const d = addDays(start, c * 7 + r); const k = ymd(d);
      const cls = [trainedDays[k] ? 'l2' : '', k === today ? 'today' : '', d > new Date() ? 'future' : ''].join(' ');
      grid += `<i class="${cls}" data-act="heatDay" data-d="${k}"></i>`;
    }
  });

  // Barras 8 semanas
  const weeks = [];
  for (let i = 7; i >= 0; i--) { const w = addDays(ws, -7 * i); weeks.push({ w, n: daysTrained(sessionsInWeek(w)) }); }
  const maxN = Math.max(goal, ...weeks.map((x) => x.n), 1);
  const bars = weeks.map((x) => `<div class="w ${x.n >= goal ? 'met' : ''}"><span>${x.n}</span><div class="col"><s style="bottom:${(goal / maxN) * 100}%"></s><b style="height:${(x.n / maxN) * 100}%"></b></div><span>${fmtDate(x.w, { day: 'numeric', month: 'numeric' })}</span></div>`).join('');

  const last = sorted()[0];
  return `
    <div class="card">
      <div class="row between"><h3>Esta semana</h3><span class="pill ${thisWeek >= goal ? 'ok' : ''}">${thisWeek}/${goal} días</span></div>
      <div class="bar ${thisWeek >= goal ? 'done' : ''}"><i style="width:${pct}%"></i></div>
      <p class="muted">${thisWeek >= goal ? '¡Objetivo semanal cumplido! 💪' : (goal - thisWeek === 1 ? 'Te falta 1 día para tu objetivo.' : `Te faltan ${goal - thisWeek} días para tu objetivo.`)}</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${streakWeeks()}</b><span>${streakWeeks() === 1 ? 'semana cumpliendo' : 'semanas seguidas cumpliendo'}</span></div>
      <div class="stat"><b>${monthDays}</b><span>${monthDays === 1 ? 'día' : 'días'} este mes</span></div>
      <div class="stat"><b>${S.sessions.length}</b><span>${S.sessions.length === 1 ? 'entreno' : 'entrenos'} en total</span></div>
    </div>
    ${S.active ? `<button class="primary block" style="margin-top:12px" data-act="go" data-tab="train">Continuar entreno en curso</button>`
      : `<button class="primary block" style="margin-top:12px" data-act="go" data-tab="train">Empezar entrenamiento</button>
         <button class="block" style="margin-top:8px" data-act="pastPick">Registrar entrenamiento</button>`}
    <h2>Constancia</h2>
    <div class="card"><div class="heat">${grid}</div></div>
    <h2>Días por semana</h2>
    <div class="card"><div class="weeks">${bars}</div>
      </div>
    ${last ? `<h2>Último entreno</h2><div class="card"><b>${esc(last.routineName || 'Entrenamiento libre')}</b>
      <p class="muted">${fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtDur(last.duration)} · ${sessSets(last)} series</p></div>` : ''}
  `;
}

function viewRoutines() {
  const list = S.routines.map((r) => `
    <div class="card">
      <div class="row between"><h3>${esc(r.name)}</h3><span class="muted small">${r.exercises.length} ${r.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span></div>
      <p class="muted small">${esc(r.exercises.map((e) => e.name).join(' · ') || 'Sin ejercicios')}</p>
      <div class="row" style="margin-top:8px">
        <button class="primary grow" data-act="startRoutine" data-id="${r.id}">Empezar</button>
        <button data-act="editRoutine" data-id="${r.id}">Editar</button>
      </div>
    </div>`).join('');
  return `
    ${list || '<div class="empty">Aún no tienes sesiones.<br>Crea una (p. ej. "Torso", "Pierna", "Full body").</div>'}
    <button class="primary block" data-act="newRoutine">+ Nueva sesión</button>
    <button class="block" style="margin-top:10px" data-act="go" data-tab="routineImport">Importar del entrenador</button>
  `;
}

let planText = '';
function viewRoutineImport() {
  return `
    <div class="card">
      <p class="small">Pide a tu entrenador el plan de la semana y que lo termine con el <b>bloque de sesiones para GymLog</b>. Copia ese bloque (botón de copiar del bloque de código) y pégalo aquí.</p>
      <p class="muted small">Las sesiones con el mismo nombre que una tuya se actualizan y conservan su historial; las nuevas se añaden; el resto no se toca.</p>
    </div>
    <label>Bloque de sesiones</label>
    <textarea id="planText" data-plan="1" style="min-height:180px;font-family:ui-monospace,Menlo,monospace;font-size:13px" placeholder='{ "gymlog": "sesiones", "sesiones": [ … ] }'>${esc(planText)}</textarea>
    <div class="row wrap" style="margin:10px 0">
      <button class="grow" data-act="planPaste">Pegar</button>
      <label class="btn grow" style="text-align:center;margin:0;color:var(--text);font-size:16px">Elegir archivo<input type="file" accept=".json,.txt,.md,application/json,text/plain,text/markdown" id="planFile" hidden></label>
    </div>
    <button class="primary block" data-act="planImport">Importar sesiones</button>
    <details class="card" style="margin-top:16px"><summary><b>Ver formato</b> <span class="muted small">(ya va incluido en el informe semanal)</span></summary>
      <pre class="report" style="margin-top:10px">${esc(JSON.stringify(PLAN_EXAMPLE, null, 2))}</pre></details>
  `;
}

function viewRoutineEdit() {
  const r = routineDraft;
  const exs = r.exercises.map((e, i) => `
    <div class="card rex">
      <div class="row between"><b class="num-red">${i + 1}.</b>
        <div class="row">
          <button class="sm" data-act="rexMove" data-i="${i}" data-d="-1" aria-label="Subir">↑</button>
          <button class="sm" data-act="rexMove" data-i="${i}" data-d="1" aria-label="Bajar">↓</button>
          <button class="sm danger" data-act="rexDel" data-i="${i}">Quitar</button>
        </div>
      </div>
      <label>Ejercicio</label>
      <input list="exnames" data-rbind="name" data-i="${i}" value="${esc(e.name)}" placeholder="Nombre del ejercicio">
      <div class="row">
        <div class="grow"><label>Series</label><input inputmode="numeric" data-rbind="sets" data-i="${i}" value="${esc(e.sets)}"></div>
        <div class="grow"><label>Reps</label><input inputmode="text" data-rbind="reps" data-i="${i}" value="${esc(e.reps)}" placeholder="8-10"></div>
        <div class="grow"><label>Kg</label><input inputmode="decimal" data-rbind="weight" data-i="${i}" value="${esc(e.weight)}"></div>
        <div class="grow"><label>Desc. (s)</label><input inputmode="numeric" data-rbind="rest" data-i="${i}" value="${esc(e.rest)}"></div>
      </div>
      <label>Notas</label>
      <input data-rbind="notes" data-i="${i}" value="${esc(e.notes)}" placeholder="Técnica, tempo, agarre…">
    </div>`).join('');
  return `
    <label>Nombre de la sesión</label>
    <input data-rbind="rname" value="${esc(r.name)}" placeholder="Ej.: Torso A">
    <label>Objetivo / notas de la sesión</label>
    <input data-rbind="rnotes" value="${esc(r.notes || '')}" placeholder="Ej.: hipertrofia, 4 días/semana">
    <h2>Ejercicios</h2>
    ${exs || '<p class="muted">Añade el primer ejercicio.</p>'}
    <button class="block" data-act="rexAdd">+ Añadir ejercicio</button>
    <div class="row" style="margin-top:16px">
      <button class="primary grow" data-act="routineSave">Guardar</button>
      <button data-act="go" data-tab="routines">Cancelar</button>
    </div>
    ${S.routines.some((x) => x.id === r.id) ? `<button class="danger block" style="margin-top:10px" data-act="routineDelete">Eliminar sesión</button>` : ''}
  `;
}

let pastPicking = false;
function viewTrain() {
  if (!S.active && pastPicking) {
    const opts = S.routines.map((r) => `<button class="block pick" style="margin-bottom:8px;text-align:left" data-act="startPast" data-id="${r.id}"><b>${esc(r.name)}</b><br><span class="muted small">${r.exercises.length} ${r.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span></button>`).join('');
    return `
      <h2>¿Qué sesión hiciste?</h2>
      ${opts}
      <button class="primary block" data-act="startPast" data-id="">Entrenamiento libre</button>
      <button class="block" style="margin-top:10px" data-act="pastCancel">Cancelar</button>
      <p class="muted small" style="margin-top:12px">Después eliges el día y las horas de inicio y fin, y apuntas las series que hiciste.</p>
    `;
  }
  if (!S.active) {
    const opts = S.routines.map((r) => `<button class="block pick" style="margin-bottom:8px;text-align:left" data-act="startRoutine" data-id="${r.id}"><b>${esc(r.name)}</b><br><span class="muted small">${r.exercises.length} ${r.exercises.length === 1 ? "ejercicio" : "ejercicios"}</span></button>`).join('');
    return `
      <h2>¿Qué toca hoy?</h2>
      ${opts || '<p class="muted">No tienes sesiones aún. Puedes crear una en "Sesiones" o hacer un entrenamiento libre.</p>'}
      <button class="primary block" data-act="startFree">Entrenamiento libre</button>
      <h2>¿Ya has entrenado?</h2>
      <button class="block" data-act="pastPick">Registrar entrenamiento</button>
    `;
  }
  const a = S.active;
  const exs = a.exercises.map((ex, i) => {
    const last = lastPerformance(ex.name, a.past ? a.date : null, a.editingId || a.id);
    const target = ex.target ? `<b class="num-red">Objetivo:</b> ${esc(ex.target)}` : '';
    const sets = ex.sets.map((st, j) => `
      <div class="set ${st.done ? 'done' : ''}">
        <span class="idx">${j + 1}</span>
        <input inputmode="decimal" placeholder="${esc(st.pw || 'kg')}" data-wbind="w" data-i="${i}" data-j="${j}" value="${esc(st.w)}">
        <input inputmode="numeric" placeholder="${esc(st.pr || 'reps')}" data-wbind="r" data-i="${i}" data-j="${j}" value="${esc(st.r)}">
        <button class="chk" data-act="setDone" data-i="${i}" data-j="${j}" aria-label="Serie hecha">✓</button>
      </div>`).join('');
    return `
      <div class="card ex-card">
        <h3><input list="exnames" data-wbind="name" data-i="${i}" value="${esc(ex.name)}" placeholder="Ejercicio" style="font-weight:600"></h3>
        ${target ? `<p class="hint">${target}${ex.notes ? ' · ' + esc(ex.notes) : ''}</p>` : ''}
        ${last ? `<p class="hint">Última vez (${fmtDate(last.session.date)}): ${esc(setsText(last.ex))}</p>` : ''}
        <div class="set-head"><span>#</span><span>Kg</span><span>Reps</span><span></span></div>
        ${sets}
        <div class="row" style="margin-top:6px">
          <button class="sm grow" data-act="setAdd" data-i="${i}">+ Serie</button>
          <button class="sm" data-act="setDel" data-i="${i}">− Serie</button>
          <button class="sm danger" data-act="exDel" data-i="${i}">Quitar</button>
        </div>
      </div>`;
  }).join('');
  const startLocal = (() => { const d = new Date(a.date); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); })();
  const head = a.past ? `
    <div class="card ex-card">
      <h3>${esc(a.routineName || 'Entrenamiento libre')}</h3>
      <label>Día</label>
      <input type="date" data-wbind="pdate" value="${ymd(a.date)}" max="${ymd(new Date())}">
      <div class="row">
        <div class="grow"><label>Hora de inicio</label><input type="time" data-wbind="pstart" value="${hhmm(a.date)}"></div>
        <div class="grow"><label>Hora de fin</label><input type="time" data-wbind="pend" value="${esc(a.endTime || '')}"></div>
      </div>
      <p class="muted small" style="margin-top:8px">Duración: <b id="pdur">${fmtDur(pastDuration(a))}</b></p>
    </div>` : `
    <div class="row between" style="margin-bottom:10px">
      <div><b>${esc(a.routineName || 'Entrenamiento libre')}</b><br><span class="muted small">Tiempo: <span id="elapsed" class="elapsed">—</span></span></div>
    </div>`;
  return `
    ${head}
    ${exs}
    <button class="block" data-act="exAdd">+ Añadir ejercicio</button>
    <h2>${a.past ? 'Guardar' : 'Terminar'}</h2>
    <div class="card">
      ${a.past ? '' : `<label>Fecha y hora de inicio</label>
      <input type="datetime-local" data-wbind="date" value="${startLocal}">
      <label>Duración (min) — vacío = automática</label>
      <input inputmode="numeric" data-wbind="durationManual" value="${esc(a.durationManual || '')}" placeholder="auto">`}
      <label>Energía / sensaciones (1 = fatal, 5 = genial)</label>
      <select data-wbind="energy">${['', 1, 2, 3, 4, 5].map((n) => `<option ${String(a.energy || '') === String(n) ? 'selected' : ''} value="${n}">${n || '—'}</option>`).join('')}</select>
      <label>Notas (molestias, sueño, qué costó…)</label>
      <textarea data-wbind="notes" placeholder="Ej.: hombro derecho molesta en press; dormí 6 h">${esc(a.notes || '')}</textarea>
      <button class="primary block" style="margin-top:12px" data-act="finish">${a.past ? 'Guardar entreno' : 'Terminar y guardar'}</button>
      <button class="danger block" style="margin-top:8px" data-act="discard">${a.editingId ? 'Cancelar cambios' : 'Descartar entreno'}</button>
    </div>
  `;
}

function viewHistory() {
  const list = sorted();
  if (!list.length) return '<div class="empty">Todavía no hay entrenos guardados.</div>';
  let html = ''; let curWeek = '';
  for (const s of list) {
    const wk = ymd(weekStart(s.date));
    if (wk !== curWeek) {
      curWeek = wk;
      const n = daysTrained(sessionsInWeek(weekStart(s.date)));
      html += `<h2>Semana del ${fmtDate(wk, { day: 'numeric', month: 'long' })} <span class="pill ${n >= S.settings.weeklyGoal ? 'ok' : ''}">${n} días</span></h2>`;
    }
    html += `
      <details class="card">
        <summary>
          <div class="row between"><b>${esc(s.routineName || 'Entrenamiento libre')}</b><span class="muted small">${fmtDate(s.date)}</span></div>
          <p class="muted small">${fmtDur(s.duration)} · ${sessSets(s)} series · ${fmtN(sessVolume(s))} kg volumen${s.energy ? ' · energía ' + s.energy + '/5' : ''}</p>
        </summary>
        <div class="session-sets">
          ${s.exercises.map((ex) => `<div><b>${esc(ex.name)}</b>: ${esc(setsText(ex))}</div>`).join('')}
          ${s.notes ? `<div><i>${esc(s.notes)}</i></div>` : ''}
        </div>
        <div class="row" style="margin-top:10px">
          <button class="sm" data-act="sessEdit" data-id="${s.id}">Editar</button>
          <button class="sm danger" data-act="sessDel" data-id="${s.id}">Eliminar</button>
        </div>
      </details>`;
  }
  return html;
}


function viewProgress() {
  const list = trackedExercises();
  if (!list.length) return '<div class="empty">Aquí verás tu evolución cuando guardes tus primeros entrenos.</div>';
  if (!progEx || !list.some((e) => e.name.toLowerCase() === progEx.toLowerCase())) progEx = list[0].name;
  const series = exerciseSeries(progEx);
  const hasWeight = series.some((p) => p.maxW > 0);
  if (!progMetric || (!hasWeight && progMetric !== 'maxR')) progMetric = hasWeight ? 'e1rm' : 'maxR';
  const M = METRICS[progMetric];
  const pts = series.map((p) => ({ x: p.date, y: M.get(p) }));
  const first = pts[0], last = pts[pts.length - 1];
  const best = pts.reduce((a, p) => (p.y > a.y ? p : a), pts[0]);
  const ch = first.y ? ((last.y - first.y) / first.y) * 100 : 0;
  const metricBtns = Object.entries(METRICS).filter(([k]) => hasWeight || k === 'maxR')
    .map(([k, m]) => `<button class="seg ${k === progMetric ? 'on' : ''}" data-act="progMetric" data-m="${k}">${m.label}</button>`).join('');

  // Volumen y series por semana (12 semanas)
  const ws = weekStart(new Date());
  const weeks = [];
  for (let i = 11; i >= 0; i--) {
    const w = addDays(ws, -7 * i); const l = sessionsInWeek(w);
    weeks.push({ label: fmtDate(w, { day: 'numeric', month: 'numeric' }), v: l.reduce((a, s) => a + sessVolume(s), 0), sets: l.reduce((a, s) => a + sessSets(s), 0), hi: i === 0 });
  }

  // Récords personales
  const prs = list.map((e) => {
    const sr = exerciseSeries(e.name);
    const top = sr.reduce((a, p) => (!a || p.e1rm > a.e1rm || (!p.e1rm && !a.e1rm && p.maxR > a.maxR) ? p : a), null);
    return { name: e.name, top };
  }).filter((x) => x.top && x.top.best);

  return `
    <label>Ejercicio</label>
    <select data-prog="ex">${list.map((e) => `<option ${e.name.toLowerCase() === progEx.toLowerCase() ? 'selected' : ''}>${esc(e.name)}</option>`).join('')}</select>
    <div class="segs">${metricBtns}</div>
    <div class="card">
      <div class="row between"><h3>${esc(M.label)}</h3><span class="muted small">${series.length} entrenos</span></div>
      ${lineChart(pts, M.unit)}
      <div class="stats mini">
        <div class="stat"><b>${fmtN(last.y)}</b><span>último (${M.unit})</span></div>
        <div class="stat"><b class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${ch > 0 ? '+' : ''}${fmtN(ch)}%</b><span>desde el inicio</span></div>
        <div class="stat"><b>${fmtN(best.y)}</b><span>récord · ${fmtDate(best.x, { day: 'numeric', month: 'short' })}</span></div>
      </div>
    </div>
    <h2>Volumen semanal (kg × reps)</h2>
    <div class="card">${barChart(weeks, 'kg')}<p class="muted small">Últimas 12 semanas. La barra resaltada es la semana actual.</p></div>
    <h2>Series por semana</h2>
    <div class="card">${barChart(weeks.map((w) => ({ ...w, v: w.sets })), 'series')}</div>
    <h2>Récords personales</h2>
    <div class="card"><table class="tbl"><thead><tr><th>Ejercicio</th><th>Mejor serie</th><th>1RM est.</th></tr></thead><tbody>
      ${prs.map((p) => `<tr data-act="progPick" data-name="${esc(p.name)}"><td>${esc(p.name)}</td><td>${p.top.best.w ? fmtN(p.top.best.w) + '×' : ''}${p.top.best.r}<br><span class="muted small">${fmtDate(p.top.date, { day: 'numeric', month: 'short', year: '2-digit' })}</span></td><td>${p.top.e1rm ? fmtN(p.top.e1rm) + ' kg' : '—'}</td></tr>`).join('')}
    </tbody></table><p class="muted small">1RM estimado con la fórmula de Epley. Toca un ejercicio para ver su gráfica.</p></div>
  `;
}

function viewReport() {
  const wk = ymd(reportWeek);
  const end = addDays(reportWeek, 6);
  return `
    <div class="row between">
      <button class="sm" data-act="repWeek" data-d="-1">◀</button>
      <b>${fmtDate(reportWeek, { day: 'numeric', month: 'short' })} – ${fmtDate(end, { day: 'numeric', month: 'short', year: 'numeric' })}</b>
      <button class="sm" data-act="repWeek" data-d="1">▶</button>
    </div>
    <label>Comentarios para el entrenador (se incluyen en el informe)</label>
    <textarea data-repnotes="${wk}" placeholder="Ej.: quiero centrarme en espalda; me molesta la rodilla; esta semana dormí poco…">${esc(S.reportNotes[wk] || '')}</textarea>
    <div class="row wrap" style="margin:12px 0">
      <button class="primary grow" data-act="repShare">Compartir / Guardar</button>
      <button class="grow" data-act="repCopy">Copiar texto</button>
    </div>
    <p class="muted small">Sube el archivo <b>.md</b> (o pega el texto) en tu proyecto de entrenador personal en Claude y pídele que lo analice.</p>
    <pre class="report" id="reportText"></pre>
  `;
}

function viewSettings() {
  return `
    <div class="card">
      <label>Objetivo de días por semana</label>
      <select data-setting="weeklyGoal">${[1, 2, 3, 4, 5, 6, 7].map((n) => `<option ${S.settings.weeklyGoal === n ? 'selected' : ''}>${n}</option>`).join('')}</select>
    </div>
    <h2>Copia de seguridad</h2>
    <div class="card">
      <p class="muted small">Los datos se guardan solo en este iPhone. Haz una copia de vez en cuando (por ejemplo a iCloud Drive desde "Guardar en Archivos").</p>
      <button class="block" data-act="backup">Exportar copia (.json)</button>
      <label class="btn block" style="text-align:center;margin-top:8px;color:var(--text);font-size:16px">Importar copia<input type="file" accept=".json,application/json" id="importFile" hidden></label>
    </div>
    <h2>Instalar en el iPhone</h2>
    <div class="card"><p class="small">Abre esta página en <b>Safari</b> → botón <b>Compartir</b> → <b>Añadir a pantalla de inicio</b>. Se abrirá como una app y funciona sin conexión.</p></div>
    <button class="danger block" style="margin-top:20px" data-act="wipe">Borrar todos los datos</button>
    <p class="muted small" style="text-align:center;margin-top:16px">GymLog · versión ${APP_VERSION}<br>Pantalla ${Math.min(screen.width, screen.height)} pt · vista ${innerWidth} px${window.__zoomFix > 1.05 ? ' · zoom compensado ×' + fmtN(window.__zoomFix) : ''}</p>
  `;
}

/* ============ Informe semanal (Markdown) ============ */
function buildReport(ws) {
  const goal = S.settings.weeklyGoal;
  const we = addDays(ws, 6);
  const list = sessionsInWeek(ws);
  const prev = sessionsInWeek(addDays(ws, -7));
  const days = daysTrained(list);
  const vol = list.reduce((a, s) => a + sessVolume(s), 0);
  const pvol = prev.reduce((a, s) => a + sessVolume(s), 0);
  const sets = list.reduce((a, s) => a + sessSets(s), 0);
  const mins = list.reduce((a, s) => a + (s.duration || 0), 0);
  const energies = list.filter((s) => s.energy).map((s) => +s.energy);
  const diff = (a, b) => (b ? ` (${a >= b ? '+' : ''}${Math.round(((a - b) / b) * 100)}% vs semana anterior)` : '');

  const hist = [];
  for (let i = 7; i >= 0; i--) hist.push(daysTrained(sessionsInWeek(addDays(ws, -7 * i))));

  const L = [];
  L.push('# Informe semanal de entrenamiento');
  L.push('');
  L.push(`**Semana:** ${fmtDate(ws, { weekday: 'long', day: 'numeric', month: 'long' })} – ${fmtDate(we, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}`);
  L.push(`**Generado:** ${fmtDate(new Date(), { day: 'numeric', month: 'long', year: 'numeric' })} con GymLog`);
  L.push('');
  L.push('## Constancia');
  L.push(`- Días entrenados: **${days} de ${goal}** objetivo ${days >= goal ? '✅' : '❌'}`);
  L.push(`- Racha actual: ${streakWeeks()} semana(s) seguidas cumpliendo el objetivo`);
  L.push(`- Días por semana (últimas 8 semanas, la última es esta): ${hist.join(' · ')}`);
  L.push('');
  L.push('## Resumen de carga');
  L.push(`- Entrenos: ${list.length} · Tiempo total: ${fmtDur(mins)}`);
  L.push(`- Series totales: ${sets}${diff(sets, prev.reduce((a, s) => a + sessSets(s), 0))}`);
  L.push(`- Volumen total (kg × reps): ${fmtN(vol)} kg${diff(vol, pvol)}`);
  if (energies.length) L.push(`- Energía media: ${fmtN(energies.reduce((a, b) => a + b, 0) / energies.length)}/5`);
  L.push('');

  L.push('## Entrenos de la semana');
  if (!list.length) L.push('_No hubo entrenos esta semana._');
  for (const s of list) {
    const d = new Date(s.date);
    L.push(`### ${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} — ${s.routineName || 'Entrenamiento libre'}`);
    L.push(`Duración: ${fmtDur(s.duration)}${s.energy ? ` · Energía: ${s.energy}/5` : ''} · Volumen: ${fmtN(sessVolume(s))} kg`);
    L.push('');
    L.push('| Ejercicio | Series (kg×reps) | Mejor serie | e1RM est. |');
    L.push('|---|---|---|---|');
    for (const ex of s.exercises) {
      const b = bestSet(ex);
      L.push(`| ${ex.name} | ${setsText(ex)} | ${b ? (b.w ? fmtN(b.w) + '×' : '') + b.r : '-'} | ${b && b.v ? fmtN(b.v) + ' kg' : '-'} |`);
    }
    if (s.notes) { L.push(''); L.push(`> Notas: ${s.notes.replace(/\n+/g, ' ')}`); }
    L.push('');
  }

  // Progresión por ejercicio
  const byName = new Map();
  for (const s of list) for (const ex of s.exercises) {
    const k = ex.name.trim().toLowerCase();
    const b = bestSet(ex);
    if (!b) continue;
    const cur = byName.get(k);
    if (!cur || b.v > cur.best.v) byName.set(k, { name: ex.name, best: b });
  }
  if (byName.size) {
    L.push('## Progresión por ejercicio (vs. la última vez antes de esta semana)');
    L.push('| Ejercicio | Esta semana | Anterior | Cambio e1RM |');
    L.push('|---|---|---|---|');
    for (const { name, best } of byName.values()) {
      const p = lastPerformance(name, ws);
      const pb = p ? bestSet(p.ex) : null;
      let ch = 'primera vez';
      if (pb && pb.v && best.v) {
        const pct = ((best.v - pb.v) / pb.v) * 100;
        ch = (pct > 1 ? '⬆️ +' : pct < -1 ? '⬇️ ' : '➡️ ') + fmtN(pct) + '%';
      } else if (pb) ch = '—';
      const f = (b) => (b ? (b.w ? fmtN(b.w) + '×' : '') + b.r : '-');
      L.push(`| ${name} | ${f(best)} | ${pb ? f(pb) + ' (' + fmtDate(p.session.date, { day: 'numeric', month: 'short' }) + ')' : '-'} | ${ch} |`);
    }
    L.push('');
  }


  // Evolución de las últimas 8 semanas (mejor 1RM estimado de cada semana)
  if (byName.size) {
    const wks = []; for (let i = 7; i >= 0; i--) wks.push(addDays(ws, -7 * i));
    L.push('## Evolución últimas 8 semanas (mejor e1RM semanal, kg; "-" = no se hizo)');
    L.push('| Ejercicio | ' + wks.map((w) => fmtDate(w, { day: 'numeric', month: 'numeric' })).join(' | ') + ' |');
    L.push('|---|' + wks.map(() => '---').join('|') + '|');
    for (const { name } of byName.values()) {
      const sr = exerciseSeries(name);
      const cells = wks.map((w) => {
        const we2 = addDays(w, 7);
        const inW = sr.filter((p) => p.date >= w && p.date < we2);
        if (!inW.length) return '-';
        const m = Math.max(...inW.map((p) => p.e1rm));
        return m ? fmtN(m) : Math.max(...inW.map((p) => p.maxR)) + ' reps';
      });
      L.push(`| ${name} | ${cells.join(' | ')} |`);
    }
    const vols = wks.map((w) => fmtN(sessionsInWeek(w).reduce((a, s) => a + sessVolume(s), 0)));
    L.push('');
    L.push(`Volumen semanal (kg): ${vols.join(' · ')}`);
    L.push('');
  }

  // Sesiones planificadas
  if (S.routines.length) {
    L.push('## Mis sesiones planificadas');
    for (const r of S.routines) {
      L.push(`**${r.name}**${r.notes ? ` — ${r.notes}` : ''}`);
      for (const e of r.exercises) {
        L.push(`- ${e.name}: ${e.sets || '?'}×${e.reps || '?'}${e.weight ? ' @ ' + e.weight + ' kg' : ''}${e.rest ? ' · descanso ' + e.rest + ' s' : ''}${e.notes ? ' · ' + e.notes : ''}`);
      }
      L.push('');
    }
  }

  const notes = S.reportNotes[ymd(ws)];
  L.push('## Comentarios del atleta');
  L.push(notes ? notes : '_Sin comentarios._');
  L.push('');
  L.push('## Qué necesito del entrenador');
  L.push('Analiza mi constancia, la progresión de cargas y el volumen por grupo muscular. Dime qué puedo mejorar, si algún ejercicio está estancado y debería cambiarlo o ajustarlo, y propón cambios concretos para la próxima semana.');
  L.push('');
  L.push('## Plan para importar en GymLog');
  L.push('Termina tu respuesta con las sesiones de la próxima semana en un único bloque de código JSON con este formato, para que pueda copiarlo e importarlo en la app. Usa los mismos nombres de sesión que ya tengo si solo cambian ejercicios o cargas (así se actualizan y conservan su historial). "reps" admite rangos ("8-10"), "kg" es el peso orientativo (vacío o 0 si es con peso corporal) y "descanso" va en segundos.');
  L.push('```json');
  L.push(JSON.stringify(PLAN_EXAMPLE, null, 2));
  L.push('```');
  return L.join('\n');
}

/* ============ Acciones ============ */
function newActive(routine) {
  const a = { id: uid(), date: new Date().toISOString(), startedAt: Date.now(), routineId: routine ? routine.id : null, routineName: routine ? routine.name : '', exercises: [], notes: '', energy: '' };
  if (routine) {
    for (const e of routine.exercises) {
      const n = Math.max(1, parseInt(e.sets, 10) || 3);
      const reps = parseInt(e.reps, 10) || '';
      const last = lastPerformance(e.name);
      a.exercises.push({
        name: e.name, rest: parseInt(e.rest, 10) || 90, notes: e.notes || '',
        target: `${e.sets || '?'}×${e.reps || '?'}${num(e.weight) ? ' @ ' + fmtN(num(e.weight)) + ' kg' : ''}`,
        sets: Array.from({ length: n }, (_, j) => {
          const ls = last && (last.ex.sets[j] || last.ex.sets[last.ex.sets.length - 1]);
          const pw = num(e.weight) || (ls ? num(ls.w) : 0);
          return { w: '', r: '', pw: pw ? fmtN(pw) : '', pr: reps || (ls ? ls.r : ''), done: false };
        })
      });
    }
  }
  return a;
}

function finishWorkout() {
  const a = S.active;
  const exercises = a.exercises
    .map((ex) => ({ name: (ex.name || '').trim(), sets: ex.sets.filter((st) => num(st.r) > 0).map((st) => ({ w: num(st.w !== '' && st.w != null ? st.w : st.pw), r: num(st.r) })) }))
    .filter((ex) => ex.name && ex.sets.length);
  if (!exercises.length) { toast('Registra al menos una serie con repeticiones'); return; }
  const auto = a.startedAt ? (Date.now() - a.startedAt) / 60000 : 0;
  if (a.past && !a.endTime) { toast('Pon la hora de fin del entreno'); return; }
  if (a.past && new Date(a.date) > new Date()) { toast('La hora de inicio no puede ser futura'); return; }
  const duration = a.past ? pastDuration(a) : (num(a.durationManual) || Math.min(Math.round(auto), 240));
  const session = { id: a.editingId || a.id, date: a.date, routineId: a.routineId, routineName: a.routineName, exercises, notes: (a.notes || '').trim(), energy: a.energy || '', duration };
  S.sessions = S.sessions.filter((s) => s.id !== session.id);
  S.sessions.push(session);
  S.active = null;
  save(); stopRest();
  toast('Entreno guardado ✅');
  go('home');
}

const actions = {
  go: (el) => go(el.dataset.tab),
  newRoutine: () => { routineDraft = { id: uid(), name: '', notes: '', exercises: [{ name: '', sets: 3, reps: '8-10', weight: '', rest: 90, notes: '' }] }; go('routineEdit'); },
  editRoutine: (el) => { routineDraft = JSON.parse(JSON.stringify(S.routines.find((r) => r.id === el.dataset.id))); go('routineEdit'); },
  rexAdd: () => { routineDraft.exercises.push({ name: '', sets: 3, reps: '8-10', weight: '', rest: 90, notes: '' }); render(); },
  rexDel: (el) => { routineDraft.exercises.splice(+el.dataset.i, 1); render(); },
  rexMove: (el) => {
    const i = +el.dataset.i, j = i + +el.dataset.d, a = routineDraft.exercises;
    if (j < 0 || j >= a.length) return;
    [a[i], a[j]] = [a[j], a[i]]; render();
  },
  planPaste: async () => {
    try { planText = await navigator.clipboard.readText(); render(); }
    catch (e) { toast('Mantén pulsado el cuadro y elige «Pegar»'); }
  },
  planImport: () => {
    let plan;
    try { plan = parsePlan(planText); } catch (err) { toast('No se pudo leer: ' + err.message); return; }
    const key = (n) => n.trim().toLowerCase();
    const upd = plan.filter((s) => S.routines.some((r) => key(r.name) === key(s.name))).map((s) => s.name);
    const add = plan.filter((s) => !upd.includes(s.name)).map((s) => s.name);
    const msg = [`Se van a importar ${plan.length} ${plan.length === 1 ? 'sesión' : 'sesiones'}:`,
      upd.length ? `• Se actualizan: ${upd.join(', ')}` : '', add.length ? `• Se añaden: ${add.join(', ')}` : '', '', '¿Continuar?'].filter((x) => x !== '').join('\n');
    if (!confirm(msg)) return;
    applyPlan(plan); planText = '';
    toast(`${plan.length} ${plan.length === 1 ? 'sesión importada' : 'sesiones importadas'}`); go('routines');
  },
  routineSave: () => {
    const r = routineDraft;
    r.name = r.name.trim() || 'Sesión sin nombre';
    r.exercises = r.exercises.filter((e) => e.name.trim());
    const i = S.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) S.routines[i] = r; else S.routines.push(r);
    save(); toast('Sesión guardada'); go('routines');
  },
  routineDelete: () => {
    if (!confirm('¿Eliminar esta sesión? Los entrenos ya guardados no se borran.')) return;
    S.routines = S.routines.filter((x) => x.id !== routineDraft.id); save(); go('routines');
  },
  startRoutine: (el) => {
    if (S.active && !confirm('Ya tienes un entreno en curso. ¿Descartarlo y empezar otro?')) return;
    S.active = newActive(S.routines.find((r) => r.id === el.dataset.id)); save(); go('train');
  },
  pastPick: () => {
    if (S.active && !confirm('Tienes un entreno en curso. ¿Descartarlo para registrar otro?')) return;
    S.active = null; save(); pastPicking = true; go('train');
  },
  pastCancel: () => { pastPicking = false; render(); },
  startPast: (el) => {
    const r = el.dataset.id ? S.routines.find((x) => x.id === el.dataset.id) : null;
    const a = newActive(r);
    // Por defecto: terminó ahora (redondeado a 5 min) y duró 1 hora
    const end = new Date(); end.setMinutes(end.getMinutes() - (end.getMinutes() % 5), 0, 0);
    a.date = new Date(end - 60 * 60000).toISOString(); a.endTime = hhmm(end);
    a.past = true; a.startedAt = null;
    if (!r) a.exercises.push({ name: '', rest: 90, sets: [{ w: '', r: '', done: false }] });
    S.active = a; pastPicking = false; save(); go('train');
  },
  startFree: () => { S.active = newActive(null); S.active.exercises.push({ name: '', rest: 90, sets: [{ w: '', r: '', done: false }] }); save(); render(); },
  exAdd: () => { S.active.exercises.push({ name: '', rest: 90, sets: [{ w: '', r: '', done: false }] }); save(); render(); },
  exDel: (el) => { if (confirm('¿Quitar este ejercicio del entreno?')) { S.active.exercises.splice(+el.dataset.i, 1); save(); render(); } },
  setAdd: (el) => {
    const ex = S.active.exercises[+el.dataset.i]; const prev = ex.sets[ex.sets.length - 1];
    ex.sets.push({ w: '', r: '', pw: prev ? (prev.w || prev.pw || '') : '', pr: prev ? (prev.r || prev.pr || '') : '', done: false }); save(); render();
  },
  setDel: (el) => { const ex = S.active.exercises[+el.dataset.i]; if (ex.sets.length > 1) { ex.sets.pop(); save(); render(); } },
  setDone: (el) => {
    const ex = S.active.exercises[+el.dataset.i]; const st = ex.sets[+el.dataset.j];
    st.done = !st.done;
    if (st.done) { if (st.w === '' && st.pw) st.w = st.pw; if (st.r === '' && st.pr) st.r = st.pr; }
    save(); render();
    if (st.done && !S.active.past) startRest(ex.rest || 90);
  },
  finish: () => finishWorkout(),
  discard: () => { if (confirm('¿Descartar el entreno en curso? Se perderá lo registrado.')) { S.active = null; save(); stopRest(); go('home'); } },
  sessDel: (el) => { if (confirm('¿Eliminar este entreno del historial?')) { S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); save(); render(); } },
  sessEdit: (el) => {
    if (S.active && !confirm('Tienes un entreno en curso. ¿Descartarlo para editar este?')) return;
    const s = S.sessions.find((x) => x.id === el.dataset.id);
    S.active = { id: uid(), editingId: s.id, date: s.date, startedAt: null, past: true, endTime: hhmm(new Date(new Date(s.date).getTime() + (s.duration || 60) * 60000)), routineId: s.routineId, routineName: s.routineName, notes: s.notes, energy: s.energy, exercises: s.exercises.map((e) => ({ name: e.name, rest: 90, sets: e.sets.map((st) => ({ w: st.w, r: st.r, done: true })) })) };
    save(); go('train');
  },
  heatDay: (el) => {
    const d = el.dataset.d; const n = S.sessions.filter((s) => ymd(s.date) === d);
    const f = fmtDate(d + 'T12:00', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const wn = isoWeek(new Date(d + 'T12:00'));
    toast(`${f} (semana ${wn}): ` + (n.length ? n.map((s) => s.routineName || 'Entrenamiento libre').join(', ') : 'sin entreno'));
  },
  progMetric: (el) => { progMetric = el.dataset.m; render(); },
  progPick: (el) => { progEx = el.dataset.name; progMetric = null; go('progress'); },
  repWeek: (el) => { reportWeek = addDays(reportWeek, 7 * +el.dataset.d); render(); },
  repCopy: async () => {
    const text = buildReport(reportWeek);
    try { await navigator.clipboard.writeText(text); toast('Informe copiado'); }
    catch (e) { selectReport(); toast('Selecciona y copia el texto'); }
  },
  repShare: async () => {
    const text = buildReport(reportWeek);
    const name = `informe-gym-${ymd(reportWeek)}.md`;
    const file = new File([text], name, { type: 'text/markdown' });
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Informe semanal' }); return; }
      if (navigator.share) { await navigator.share({ title: 'Informe semanal', text }); return; }
    } catch (e) { if (e.name === 'AbortError') return; }
    download(name, text, 'text/markdown');
  },
  backup: async () => {
    const text = JSON.stringify(S, null, 2);
    const name = `gymlog-copia-${ymd(new Date())}.json`;
    const file = new File([text], name, { type: 'application/json' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file] }); return; } }
    catch (e) { if (e.name === 'AbortError') return; }
    download(name, text, 'application/json');
  },
  wipe: () => { if (confirm('¿Borrar TODOS los datos? No se puede deshacer.') && confirm('¿Seguro del todo?')) { S = blankState(); save(); go('home'); } },
  restStop: () => stopRest()
};

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
}
function selectReport() {
  const r = document.createRange(); r.selectNodeContents($('#reportText'));
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(r);
}

/* ============ Temporizadores ============ */
let restEnd = 0;
function startRest(sec) { restEnd = Date.now() + sec * 1000; tick(); }
function stopRest() { restEnd = 0; $('#rest').classList.add('hidden'); }
function tick() {
  const el = $('#elapsed');
  if (el && S.active) {
    if (S.active.startedAt) {
      const s = Math.floor((Date.now() - S.active.startedAt) / 1000);
      el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
    } else el.textContent = 'edición';
  }
  const r = $('#rest');
  if (restEnd) {
    const left = Math.round((restEnd - Date.now()) / 1000);
    r.classList.remove('hidden');
    r.classList.toggle('over', left <= 0);
    const t = Math.abs(left);
    r.innerHTML = `<span>${left > 0 ? 'Descanso' : '¡A por la siguiente serie!'}</span><span>${left > 0 ? '' : '+'}${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')} ✕</span>`;
    if (left < -60) stopRest();
  }
}
setInterval(tick, 1000);

/* ============ Eventos ============ */
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (fn) { e.preventDefault(); fn(el); }
});

document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.dataset.rbind !== undefined) {
    const f = t.dataset.rbind;
    if (f === 'rname') routineDraft.name = t.value;
    else if (f === 'rnotes') routineDraft.notes = t.value;
    else routineDraft.exercises[+t.dataset.i][f] = t.value;
  } else if (t.dataset.wbind !== undefined && S.active) {
    const f = t.dataset.wbind;
    if (t.dataset.j !== undefined) S.active.exercises[+t.dataset.i].sets[+t.dataset.j][f] = t.value;
    else if (t.dataset.i !== undefined) S.active.exercises[+t.dataset.i][f] = t.value;
    else if (f === 'date') { if (t.value) S.active.date = new Date(t.value).toISOString(); }
    else if (f === 'pdate' || f === 'pstart') {
      const a = S.active; const day = f === 'pdate' ? t.value : ymd(a.date); const time = f === 'pstart' ? t.value : hhmm(a.date);
      if (day && time) a.date = new Date(`${day}T${time}`).toISOString();
      const el = $('#pdur'); if (el) el.textContent = fmtDur(pastDuration(a));
    } else if (f === 'pend') {
      S.active.endTime = t.value; const el = $('#pdur'); if (el) el.textContent = fmtDur(pastDuration(S.active));
    }
    else S.active[f] = t.value;
    save();
  } else if (t.dataset.repnotes !== undefined) {
    S.reportNotes[t.dataset.repnotes] = t.value; save();
    $('#reportText').textContent = buildReport(reportWeek);
  } else if (t.dataset.plan) {
    planText = t.value;
  } else if (t.dataset.prog === 'ex') {
    progEx = t.value; progMetric = null; render();
  } else if (t.dataset.setting) {
    S.settings[t.dataset.setting] = parseInt(t.value, 10); save();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id === 'planFile') {
    const f = e.target.files[0]; if (!f) return;
    f.text().then((txt) => { planText = txt; render(); toast('Archivo cargado: pulsa «Importar sesiones»'); }).catch((err) => toast('No se pudo leer el archivo: ' + err.message));
    return;
  }
  if (e.target.id !== 'importFile') return;
  const f = e.target.files[0]; if (!f) return;
  f.text().then((txt) => {
    const d = JSON.parse(txt);
    if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.routines)) throw new Error('formato no válido');
    if (!confirm(`Importar ${d.sessions.length} entrenos y ${d.routines.length} sesiones? Sustituirá los datos actuales.`)) return;
    S = Object.assign(blankState(), d); save(); toast('Copia importada'); go('home');
  }).catch((err) => toast('No se pudo importar: ' + err.message));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((reg) => {
    // Busca versión nueva cada vez que se vuelve a la app
    document.addEventListener('visibilitychange', () => { if (!document.hidden) reg.update().catch(() => {}); });
  }).catch(() => {});
  // Cuando se instala una versión nueva, recarga una vez para mostrarla. Los datos se guardan al escribir,
  // así que no se pierde nada; solo se evita recargar mientras se edita una sesión sin guardar.
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (hadController && !reloaded && tab !== 'routineEdit') { reloaded = true; location.reload(); }
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

render();
