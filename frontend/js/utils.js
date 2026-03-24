// ── UTILS ─────────────────────────────────────────────────────────────────────

const BANCAS_PADRAO = [
  'CESPE / CEBRASPE', 'FGV', 'FCC', 'VUNESP', 'QUADRIX',
  'IBFC', 'IADES', 'FEPESE', 'FUNDATEC', 'NC-UFPR',
];

const PROVAS_OPCOES = ['P1', 'P2', 'P3', 'P4'];
const DIAS_SEMANA = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

function todayISO() {
  // Usa horário local (não UTC) para evitar problema de fuso horário
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

function diasFaltando(iso) {
  if (!iso) return null;
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const prova = new Date(iso + 'T00:00:00');
  return Math.ceil((prova - hoje) / (1000 * 60 * 60 * 24));
}

function semanasRestantes(iso) {
  const dias = diasFaltando(iso);
  if (dias === null) return null;
  return Math.ceil(dias / 7);
}

function semanasPassadas(dataInicioISO) {
  if (!dataInicioISO) return 0;
  const inicio = new Date(dataInicioISO + 'T00:00:00');
  const hoje = new Date(); hoje.setHours(0,0,0,0);
  const dias = Math.ceil((hoje - inicio) / (1000 * 60 * 60 * 24));
  return Math.max(0, Math.ceil(dias / 7));
}

function formatTempo(minutos) {
  if (!minutos) return '—';
  if (minutos < 60) return `${minutos}min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

function acertoClass(pct) {
  if (pct === null || pct === undefined || pct === '') return 'acerto-none';
  const v = parseFloat(pct);
  if (v < 50) return 'acerto-red';
  if (v < 75) return 'acerto-yellow';
  if (v < 90) return 'acerto-green';
  return 'acerto-green-dark';
}

function acertoBadge(pct) {
  if (pct === null || pct === undefined || pct === '') return '<span class="acerto-badge acerto-none">—</span>';
  return `<span class="acerto-badge ${acertoClass(pct)}">${parseFloat(pct).toFixed(1)}%</span>`;
}

function showToast(msg, type = '') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type}`;
  t.classList.remove('hidden');
  setTimeout(() => t.classList.add('hidden'), 2800);
}

function openModal(title, bodyHTML) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHTML;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.getElementById('modal-body').innerHTML = '';
}

function qs(sel, ctx = document) { return ctx.querySelector(sel); }
function qsa(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function el(tag, attrs = {}, ...children) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') e.className = v;
    else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v);
  }
  for (const c of children) {
    if (typeof c === 'string') e.appendChild(document.createTextNode(c));
    else if (c) e.appendChild(c);
  }
  return e;
}

function qs_params(obj) {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) {
    if (v !== null && v !== undefined && v !== '') p.set(k, v);
  }
  const s = p.toString();
  return s ? '?' + s : '';
}

// Semana
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getMondayOf(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function dateToLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function getCurrentWeekMonday() {
  return dateToLocalISO(getMondayOf(new Date()));
}

function getSundayOf(mondayISO) {
  const d = new Date(mondayISO + 'T00:00:00');
  d.setDate(d.getDate() + 6);
  return dateToLocalISO(d);
}

function getWeekDates(mondayISO) {
  const dates = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(mondayISO + 'T00:00:00');
    d.setDate(d.getDate() + i);
    dates.push(dateToLocalISO(d));
  }
  return dates;
}

function prevWeek(mondayISO) {
  const d = new Date(mondayISO + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return dateToLocalISO(d);
}

function nextWeek(mondayISO) {
  const d = new Date(mondayISO + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return dateToLocalISO(d);
}

// Cores de provas
const PROVA_COLORS = ['#4F46E5','#EC4899','#F59E0B','#10B981','#8B5CF6','#EF4444','#06B6D4'];
const provaColorMap = {};

function getProvaColor(provaName) {
  if (!provaName) return '#9CA3AF';
  if (!provaColorMap[provaName]) {
    const idx = Object.keys(provaColorMap).length % PROVA_COLORS.length;
    provaColorMap[provaName] = PROVA_COLORS[idx];
  }
  return provaColorMap[provaName];
}

function resetProvaColors() {
  Object.keys(provaColorMap).forEach(k => delete provaColorMap[k]);
}

function provaTag(nome) {
  if (!nome) return '';
  const cor = getProvaColor(nome);
  return `<span class="prova-tag" style="background:${cor}">${nome}</span>`;
}

// Plano alvo (retorna plan_id)
async function getConcursoAlvo() {
  try {
    const r = await api.get('/api/config/plano_alvo');
    return r.value ? r.value : null;
  } catch { return null; }
}

// Retorna o concurso_id do planejamento ativo (para selects de concurso)
async function getConcursoIdDoPlanoAtivo() {
  try {
    const planId = await getConcursoAlvo();
    if (!planId) return null;
    const plan = await api.get('/api/planejamentos/' + planId);
    return plan.concurso_id || null;
  } catch { return null; }
}

async function setConcursoAlvo(id) {
  await api.post('/api/config/plano_alvo', { value: String(id) });
}

// Multi-select de assuntos
function buildAssuntosMultiSelect(assuntos, selectedIds = [], containerId) {
  const id = containerId || ('ass-ms-' + Math.random().toString(36).slice(2));
  const html = `<div class="multi-select-wrap" id="${id}">
    <div class="multi-select-trigger" onclick="toggleMultiSelect('${id}')">
      <span class="multi-select-label" id="${id}-label">Selecionar assuntos...</span>
      <span>▾</span>
    </div>
    <div class="multi-select-dropdown hidden" id="${id}-dropdown">
      ${buildAssuntosTree(assuntos, selectedIds, id)}
    </div>
  </div>`;
  return { id, html };
}

function buildAssuntosTree(assuntos, selectedIds, prefix) {
  const raizes = assuntos.filter(a => !a.parent_id);
  const filhosMap = {};
  assuntos.forEach(a => {
    if (a.parent_id) {
      if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
      filhosMap[a.parent_id].push(a);
    }
  });

  function renderNode(a, nivel = 0) {
    const filhos = filhosMap[a.id] || [];
    const checked = selectedIds.includes(a.id);
    const pad = nivel * 14;
    let html = `<label class="ms-item" style="padding-left:${8 + pad}px">
      <input type="checkbox" class="ms-check" value="${a.id}" ${checked ? 'checked' : ''} data-prefix="${prefix}">
      <span class="ms-codigo">${a.codigo ? a.codigo + ' ' : ''}</span>${a.nome}
    </label>`;
    if (filhos.length > 0) {
      html += `<div class="ms-children">${filhos.map(f => renderNode(f, nivel + 1)).join('')}</div>`;
    }
    return html;
  }

  return raizes.map(a => renderNode(a)).join('');
}

function toggleMultiSelect(id) {
  const dd = document.getElementById(id + '-dropdown');
  if (dd) dd.classList.toggle('hidden');
}

function getMultiSelectValues(id) {
  const dd = document.getElementById(id + '-dropdown');
  if (!dd) return [];
  return [...dd.querySelectorAll('.ms-check:checked')].map(cb => parseInt(cb.value));
}

function updateMultiSelectLabel(id, assuntos) {
  const vals = getMultiSelectValues(id);
  const label = document.getElementById(id + '-label');
  if (!label) return;
  if (vals.length === 0) {
    label.textContent = 'Selecionar assuntos...';
  } else if (vals.length === 1) {
    const a = (assuntos || []).find(x => (x.id || x.assunto_id) === vals[0]);
    label.textContent = a ? a.nome : '1 selecionado';
  } else {
    label.textContent = `${vals.length} assuntos selecionados`;
  }
}

// Fechar dropdowns ao clicar fora
document.addEventListener('click', e => {
  if (!e.target.closest('.multi-select-wrap')) {
    qsa('.multi-select-dropdown').forEach(dd => dd.classList.add('hidden'));
  }
});

// Tooltip helper
function tooltip(texto) {
  return `<span class="tooltip-wrap">ⓘ<span class="tooltip-box">${texto}</span></span>`;
}

// Comparação semanal/mensal
function comparacaoArrow(atual, anterior) {
  if (!anterior || anterior === 0) return '';
  const diff = atual - anterior;
  if (diff > 0) return `<span style="color:var(--green);font-size:0.75rem">▲ ${diff}</span>`;
  if (diff < 0) return `<span style="color:var(--red);font-size:0.75rem">▼ ${Math.abs(diff)}</span>`;
  return `<span style="color:var(--text-3);font-size:0.75rem">= igual</span>`;
}
