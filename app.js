'use strict';

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

/* ============ Navegación ============ */
let tab = S.active ? 'train' : 'home';
let routineDraft = null;
let reportWeek = weekStart(new Date());

function go(t) { tab = t; render(); window.scrollTo(0, 0); }

const TITLES = { home: 'GymLog', routines: 'Rutinas', routineEdit: 'Editar rutina', train: 'Entrenar', history: 'Historial', report: 'Informe semanal', settings: 'Ajustes' };

function render() {
  $('#title').textContent = TITLES[tab] || 'GymLog';
  document.querySelectorAll('.tabbar button').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === tab || (tab === 'routineEdit' && b.dataset.tab === 'routines'));
  });
  $('.primary-tab').classList.toggle('live', !!S.active);
  $('#exnames').innerHTML = allExerciseNames().map((n) => `<option value="${esc(n)}">`).join('');
  const v = { home: viewHome, routines: viewRoutines, routineEdit: viewRoutineEdit, train: viewTrain, history: viewHistory, report: viewReport, settings: viewSettings }[tab];
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

  // Heatmap 16 semanas
  const trainedDays = {};
  S.sessions.forEach((s) => { const k = ymd(s.date); trainedDays[k] = (trainedDays[k] || 0) + 1; });
  const start = addDays(ws, -7 * 15);
  const today = ymd(new Date());
  let cells = '';
  for (let i = 0; i < 16 * 7; i++) {
    const d = addDays(start, i); const k = ymd(d);
    const lvl = trainedDays[k] ? 'l2' : '';
    const cls = [lvl, k === today ? 'today' : '', d > new Date() ? 'future' : ''].join(' ');
    cells += `<i class="${cls}" title="${k}"></i>`;
  }

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
      <p class="muted">${thisWeek >= goal ? '¡Objetivo semanal cumplido! 💪' : `Te faltan ${goal - thisWeek} día${goal - thisWeek === 1 ? '' : 's'} para tu objetivo.`}</p>
    </div>
    <div class="stats">
      <div class="stat"><b>${streakWeeks()}</b><span>semanas seguidas cumpliendo</span></div>
      <div class="stat"><b>${monthDays}</b><span>días este mes</span></div>
      <div class="stat"><b>${S.sessions.length}</b><span>entrenos totales</span></div>
    </div>
    ${S.active ? `<button class="primary block" style="margin-top:12px" data-act="go" data-tab="train">Continuar entreno en curso</button>`
      : `<button class="primary block" style="margin-top:12px" data-act="go" data-tab="train">Empezar entrenamiento</button>`}
    <h2>Constancia (16 semanas)</h2>
    <div class="card"><div class="heat">${cells}</div>
      <p class="muted small">Cada columna es una semana (lunes arriba). Azul = día entrenado.</p></div>
    <h2>Días por semana</h2>
    <div class="card"><div class="weeks">${bars}</div>
      <p class="muted small">Línea discontinua = objetivo (${goal} días). Verde = semana cumplida.</p></div>
    ${last ? `<h2>Último entreno</h2><div class="card"><b>${esc(last.routineName || 'Entreno libre')}</b>
      <p class="muted">${fmtDate(last.date, { weekday: 'long', day: 'numeric', month: 'long' })} · ${fmtDur(last.duration)} · ${sessSets(last)} series</p></div>` : ''}
  `;
}

function viewRoutines() {
  const list = S.routines.map((r) => `
    <div class="card">
      <div class="row between"><h3>${esc(r.name)}</h3><span class="muted small">${r.exercises.length} ejercicios</span></div>
      <p class="muted small">${esc(r.exercises.map((e) => e.name).join(' · ') || 'Sin ejercicios')}</p>
      <div class="row" style="margin-top:8px">
        <button class="primary grow" data-act="startRoutine" data-id="${r.id}">Empezar</button>
        <button data-act="editRoutine" data-id="${r.id}">Editar</button>
      </div>
    </div>`).join('');
  return `
    ${list || '<div class="empty">Aún no tienes rutinas.<br>Crea una (p. ej. "Torso", "Pierna", "Full body").</div>'}
    <button class="primary block" data-act="newRoutine">+ Nueva rutina</button>
  `;
}

function viewRoutineEdit() {
  const r = routineDraft;
  const exs = r.exercises.map((e, i) => `
    <div class="card">
      <div class="row between"><b>${i + 1}.</b>
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
    <label>Nombre de la rutina</label>
    <input data-rbind="rname" value="${esc(r.name)}" placeholder="Ej.: Torso A">
    <label>Objetivo / notas de la rutina</label>
    <input data-rbind="rnotes" value="${esc(r.notes || '')}" placeholder="Ej.: hipertrofia, 4 días/semana">
    <h2>Ejercicios</h2>
    ${exs || '<p class="muted">Añade el primer ejercicio.</p>'}
    <button class="block" data-act="rexAdd">+ Añadir ejercicio</button>
    <div class="row" style="margin-top:16px">
      <button class="primary grow" data-act="routineSave">Guardar</button>
      <button data-act="go" data-tab="routines">Cancelar</button>
    </div>
    ${S.routines.some((x) => x.id === r.id) ? `<button class="danger block" style="margin-top:10px" data-act="routineDelete">Eliminar rutina</button>` : ''}
  `;
}

function viewTrain() {
  if (!S.active) {
    const opts = S.routines.map((r) => `<button class="block" style="margin-bottom:8px;text-align:left" data-act="startRoutine" data-id="${r.id}"><b>${esc(r.name)}</b><br><span class="muted small">${r.exercises.length} ejercicios</span></button>`).join('');
    return `
      <h2>¿Qué toca hoy?</h2>
      ${opts || '<p class="muted">No tienes rutinas aún. Puedes crear una en "Rutinas" o hacer un entreno libre.</p>'}
      <button class="primary block" data-act="startFree">Entreno libre</button>
    `;
  }
  const a = S.active;
  const exs = a.exercises.map((ex, i) => {
    const last = lastPerformance(ex.name, null, a.id);
    const target = ex.target ? `Objetivo: ${esc(ex.target)}` : '';
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
  return `
    <div class="row between" style="margin-bottom:10px">
      <div><b>${esc(a.routineName || 'Entreno libre')}</b><br><span class="muted small">Tiempo: <span id="elapsed" class="elapsed">—</span></span></div>
    </div>
    ${exs}
    <button class="block" data-act="exAdd">+ Añadir ejercicio</button>
    <h2>Terminar</h2>
    <div class="card">
      <label>Fecha y hora de inicio</label>
      <input type="datetime-local" data-wbind="date" value="${startLocal}">
      <label>Duración (min) — vacío = automática</label>
      <input inputmode="numeric" data-wbind="durationManual" value="${esc(a.durationManual || '')}" placeholder="auto">
      <label>Energía / sensaciones (1 = fatal, 5 = genial)</label>
      <select data-wbind="energy">${['', 1, 2, 3, 4, 5].map((n) => `<option ${String(a.energy || '') === String(n) ? 'selected' : ''} value="${n}">${n || '—'}</option>`).join('')}</select>
      <label>Notas (molestias, sueño, qué costó…)</label>
      <textarea data-wbind="notes" placeholder="Ej.: hombro derecho molesta en press; dormí 6 h">${esc(a.notes || '')}</textarea>
      <button class="primary block" style="margin-top:12px" data-act="finish">Terminar y guardar</button>
      <button class="danger block" style="margin-top:8px" data-act="discard">Descartar entreno</button>
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
          <div class="row between"><b>${esc(s.routineName || 'Entreno libre')}</b><span class="muted small">${fmtDate(s.date)}</span></div>
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
    <p class="muted small" style="text-align:center;margin-top:16px">GymLog v1</p>
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
  L.push(`- Sesiones: ${list.length} · Tiempo total: ${fmtDur(mins)}`);
  L.push(`- Series totales: ${sets}${diff(sets, prev.reduce((a, s) => a + sessSets(s), 0))}`);
  L.push(`- Volumen total (kg × reps): ${fmtN(vol)} kg${diff(vol, pvol)}`);
  if (energies.length) L.push(`- Energía media: ${fmtN(energies.reduce((a, b) => a + b, 0) / energies.length)}/5`);
  L.push('');

  L.push('## Sesiones');
  if (!list.length) L.push('_No hubo sesiones esta semana._');
  for (const s of list) {
    const d = new Date(s.date);
    L.push(`### ${DAYS[(d.getDay() + 6) % 7]} ${d.getDate()} — ${s.routineName || 'Entreno libre'}`);
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

  // Rutinas planificadas
  if (S.routines.length) {
    L.push('## Mis rutinas actuales (plan)');
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
        target: `${e.sets || '?'}×${e.reps || '?'}${e.weight ? ' @ ' + e.weight + ' kg' : ''}`,
        sets: Array.from({ length: n }, (_, j) => {
          const ls = last && (last.ex.sets[j] || last.ex.sets[last.ex.sets.length - 1]);
          return { w: '', r: '', pw: e.weight || (ls ? ls.w : ''), pr: reps || (ls ? ls.r : ''), done: false };
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
  const duration = num(a.durationManual) || Math.min(Math.round(auto), 240);
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
  routineSave: () => {
    const r = routineDraft;
    r.name = r.name.trim() || 'Rutina sin nombre';
    r.exercises = r.exercises.filter((e) => e.name.trim());
    const i = S.routines.findIndex((x) => x.id === r.id);
    if (i >= 0) S.routines[i] = r; else S.routines.push(r);
    save(); toast('Rutina guardada'); go('routines');
  },
  routineDelete: () => {
    if (!confirm('¿Eliminar esta rutina? Los entrenos ya guardados no se borran.')) return;
    S.routines = S.routines.filter((x) => x.id !== routineDraft.id); save(); go('routines');
  },
  startRoutine: (el) => {
    if (S.active && !confirm('Ya tienes un entreno en curso. ¿Descartarlo y empezar otro?')) return;
    S.active = newActive(S.routines.find((r) => r.id === el.dataset.id)); save(); go('train');
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
    if (st.done) startRest(ex.rest || 90);
  },
  finish: () => finishWorkout(),
  discard: () => { if (confirm('¿Descartar el entreno en curso? Se perderá lo registrado.')) { S.active = null; save(); stopRest(); go('home'); } },
  sessDel: (el) => { if (confirm('¿Eliminar este entreno del historial?')) { S.sessions = S.sessions.filter((s) => s.id !== el.dataset.id); save(); render(); } },
  sessEdit: (el) => {
    if (S.active && !confirm('Tienes un entreno en curso. ¿Descartarlo para editar este?')) return;
    const s = S.sessions.find((x) => x.id === el.dataset.id);
    S.active = { id: uid(), editingId: s.id, date: s.date, startedAt: null, durationManual: s.duration, routineId: s.routineId, routineName: s.routineName, notes: s.notes, energy: s.energy, exercises: s.exercises.map((e) => ({ name: e.name, rest: 90, sets: e.sets.map((st) => ({ w: st.w, r: st.r, done: true })) })) };
    save(); go('train');
  },
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
    else S.active[f] = t.value;
    save();
  } else if (t.dataset.repnotes !== undefined) {
    S.reportNotes[t.dataset.repnotes] = t.value; save();
    $('#reportText').textContent = buildReport(reportWeek);
  } else if (t.dataset.setting) {
    S.settings[t.dataset.setting] = parseInt(t.value, 10); save();
  }
});

document.addEventListener('change', (e) => {
  if (e.target.id !== 'importFile') return;
  const f = e.target.files[0]; if (!f) return;
  f.text().then((txt) => {
    const d = JSON.parse(txt);
    if (!d || !Array.isArray(d.sessions) || !Array.isArray(d.routines)) throw new Error('formato no válido');
    if (!confirm(`Importar ${d.sessions.length} entrenos y ${d.routines.length} rutinas? Sustituirá los datos actuales.`)) return;
    S = Object.assign(blankState(), d); save(); toast('Copia importada'); go('home');
  }).catch((err) => toast('No se pudo importar: ' + err.message));
});

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

render();
