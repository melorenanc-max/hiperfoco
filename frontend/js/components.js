// ── COMPONENTS ────────────────────────────────────────────────────────────────

function renderEmptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
}

function renderMetricCard(label, value, sub = '') {
  return `<div class="metric-card">
    <div class="metric-label">${label}</div>
    <div class="metric-value">${value}</div>
    ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
  </div>`;
}

// ── ÍCONES PADRONIZADOS ────────────────────────────────────────────────────────
// Use sempre estas funções para botões de ação em toda a plataforma
function btnEditar(dataAttrs = '', extraClass = '') {
  return `<button class="btn-action btn-action-edit ${extraClass}" ${dataAttrs} title="Editar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>`;
}

function btnApagar(dataAttrs = '', extraClass = '') {
  return `<button class="btn-action btn-action-delete ${extraClass}" ${dataAttrs} title="Apagar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  </button>`;
}

// ── INDICADOR DE META SVG ──────────────────────────────────────────────────────
// acertoPct: número (ex: 72.5) | metaPct: número (ex: 83) | opts.tooltip: bool
function buildMetaIndicator(acertoPct, metaPct, opts = {}) {
  const wrap = document.createElement('span');
  wrap.className = 'meta-indicator-wrap';

  if (acertoPct === null || acertoPct === undefined || metaPct === null || metaPct === undefined) {
    wrap.innerHTML = `<svg class="meta-indicator meta-none" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="8" fill="none" stroke="currentColor" stroke-width="1.5"/>
      <text x="9" y="13" text-anchor="middle" font-size="10" fill="currentColor">–</text>
    </svg>`;
    return wrap;
  }

  const acerto = parseFloat(acertoPct);
  const meta = parseFloat(metaPct);
  let cls, icon, tipMeta, tipAcerto;

  tipMeta = `Meta: ${meta.toFixed(0)}%`;
  tipAcerto = `Acerto atual: ${acerto.toFixed(1)}%`;

  if (acerto >= meta) {
    cls = 'meta-ok';
    icon = `<polyline points="4,9 7.5,13 14,5" stroke="white" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  } else if (acerto >= meta - 15) {
    cls = 'meta-warn';
    icon = `<line x1="9" y1="5" x2="9" y2="10.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="9" cy="13" r="1" fill="white"/>`;
  } else {
    cls = 'meta-danger';
    icon = `<line x1="9" y1="5" x2="9" y2="10.5" stroke="white" stroke-width="1.8" stroke-linecap="round"/>
            <circle cx="9" cy="13" r="1" fill="white"/>`;
  }

  wrap.innerHTML = `<span class="meta-indicator-tip" data-tip="${tipMeta} | ${tipAcerto}">
    <svg class="meta-indicator ${cls}" width="18" height="18" viewBox="0 0 18 18">
      <circle cx="9" cy="9" r="8.5" class="meta-circle"/>
      ${icon}
    </svg>
    <span class="meta-tip-box">${tipMeta}<br>${tipAcerto}</span>
  </span>`;
  return wrap;
}

// ── ACCORDION DE ASSUNTOS (READ-ONLY) ─────────────────────────────────────────
// assuntos: array flat com parent_id. Retorna elemento DOM.
function buildAssuntoAccordion(assuntos, opts = {}) {
  const container = document.createElement('div');
  container.className = 'assunto-accordion';

  if (!assuntos || assuntos.length === 0) {
    container.innerHTML = '<p class="text-muted" style="font-size:0.8rem;padding:8px 0">Nenhum assunto cadastrado</p>';
    return container;
  }

  const raizes = assuntos.filter(a => !a.parent_id);
  const filhosMap = {};
  assuntos.forEach(a => {
    if (a.parent_id) {
      if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
      filhosMap[a.parent_id].push(a);
    }
  });

  // Ordena por campo ordem ou código
  function sort(list) {
    return [...list].sort((a, b) => (a.ordem || 0) - (b.ordem || 0) || (a.codigo || '').localeCompare(b.codigo || '') || a.nome.localeCompare(b.nome));
  }

  function renderNode(a, numPai, nivel) {
    const filhos = sort(filhosMap[a.id] || []);
    const filhosNeto = filhos.flatMap(f => filhosMap[f.id] || []);
    const hasChildren = filhos.length > 0;

    const item = document.createElement('div');
    item.className = 'acc-item';

    const header = document.createElement('div');
    header.className = 'acc-header' + (nivel > 0 ? ' acc-sub' : '');
    header.style.paddingLeft = nivel === 0 ? '0' : nivel === 1 ? '20px' : '40px';

    const chevron = document.createElement('span');
    chevron.className = 'acc-chevron';
    if (hasChildren) {
      chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
    } else {
      chevron.style.visibility = 'hidden';
      chevron.style.width = '12px';
    }

    const num = document.createElement('span');
    num.className = 'acc-num';
    num.textContent = numPai;

    const nome = document.createElement('span');
    nome.className = 'acc-nome';
    nome.textContent = a.nome;

    // Adiciona última data estudada se disponível
    if (opts.showLastDate && a.ultima_data) {
      const data = document.createElement('span');
      data.className = 'acc-last-date';
      data.textContent = formatDate(a.ultima_data);
      if (opts.onDateClick) {
        data.style.cursor = 'pointer';
        data.addEventListener('click', e => { e.stopPropagation(); opts.onDateClick(a); });
      }
      header.append(chevron, num, nome, data);
    } else {
      header.append(chevron, num, nome);
    }

    item.appendChild(header);

    if (hasChildren) {
      const childrenWrap = document.createElement('div');
      childrenWrap.className = 'acc-children hidden';
      let childNum = 1;
      for (const f of sort(filhos)) {
        const fFilhos = sort(filhosMap[f.id] || []);
        const fHasChildren = fFilhos.length > 0;

        const fItem = document.createElement('div');
        fItem.className = 'acc-item';
        const fHeader = document.createElement('div');
        fHeader.className = 'acc-header acc-sub';
        fHeader.style.paddingLeft = '20px';

        const fChevron = document.createElement('span');
        fChevron.className = 'acc-chevron';
        if (fHasChildren) {
          fChevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;
        } else { fChevron.style.visibility='hidden'; fChevron.style.width='12px'; }

        const fNumSpan = document.createElement('span');
        fNumSpan.className = 'acc-num';
        fNumSpan.textContent = `${numPai}.${childNum}`;

        const fNome = document.createElement('span');
        fNome.className = 'acc-nome';
        fNome.textContent = f.nome;

        if (opts.showLastDate && f.ultima_data) {
          const fd = document.createElement('span');
          fd.className = 'acc-last-date';
          fd.textContent = formatDate(f.ultima_data);
          if (opts.onDateClick) { fd.style.cursor='pointer'; fd.addEventListener('click', e => { e.stopPropagation(); opts.onDateClick(f); }); }
          fHeader.append(fChevron, fNumSpan, fNome, fd);
        } else {
          fHeader.append(fChevron, fNumSpan, fNome);
        }

        fItem.appendChild(fHeader);

        if (fHasChildren) {
          const netoWrap = document.createElement('div');
          netoWrap.className = 'acc-children hidden';
          let netoNum = 1;
          for (const n of sort(fFilhos)) {
            const nItem = document.createElement('div');
            nItem.className = 'acc-item';
            const nHeader = document.createElement('div');
            nHeader.className = 'acc-header acc-sub';
            nHeader.style.paddingLeft = '40px';
            nHeader.innerHTML = `<span class="acc-chevron" style="visibility:hidden;width:12px"></span>
              <span class="acc-num">${numPai}.${childNum}.${netoNum}</span>
              <span class="acc-nome">${n.nome}</span>`;
            nItem.appendChild(nHeader);
            netoWrap.appendChild(nItem);
            netoNum++;
          }
          fItem.appendChild(netoWrap);
          fChevron.style.cursor = 'pointer';
          fChevron.addEventListener('click', e => {
            e.stopPropagation();
            netoWrap.classList.toggle('hidden');
            fChevron.classList.toggle('open');
          });
        }

        childrenWrap.appendChild(fItem);
        childNum++;
      }
      item.appendChild(childrenWrap);

      chevron.style.cursor = 'pointer';
      chevron.addEventListener('click', e => {
        e.stopPropagation();
        childrenWrap.classList.toggle('hidden');
        chevron.classList.toggle('open');
      });
    }

    return item;
  }

  let rootNum = 1;
  for (const a of sort(raizes)) {
    container.appendChild(renderNode(a, String(rootNum), 0));
    rootNum++;
  }

  return container;
}

// ── CARD DE TAREFA REUTILIZÁVEL ────────────────────────────────────────────────
// Usado em Ciclo Semanal e Planejamento. Retorna elemento DOM.
// tarefa: { id, numero, disciplina_nome, prova, tipo, quantidade_questoes,
//           tempo_estimado, assuntos[], link_caderno, comando, hiperdica,
//           concluida|realizado }
// opts: { mode:'ciclo'|'planejamento', onCheck, onEdit, onDelete, draggable }
const TIPO_CONFIG = {
  questoes:  { label: 'Questões',  color: '#3B82F6', bg: '#EFF6FF' },
  teoria:    { label: 'Teoria',    color: '#8B5CF6', bg: '#F5F3FF' },
  revisao:   { label: 'Revisão',   color: '#F97316', bg: '#FFF7ED' },
  simulado:  { label: 'Simulado',  color: '#10B981', bg: '#ECFDF5' },
};

function buildTaskCard(tarefa, opts = {}) {
  const { mode = 'planejamento', onCheck, onEdit, onDelete, draggable = false } = opts;
  const concluida = tarefa.concluida || tarefa.realizado;
  const tipoKey = (tarefa.tipo || '').toLowerCase();
  const tipoCfg = TIPO_CONFIG[tipoKey] || { label: tarefa.tipo || '—', color: '#9CA3AF', bg: '#F3F4F6' };
  const tempoStr = formatTempo(tarefa.tempo_estimado);
  const assuntos = tarefa.assuntos || [];

  const card = document.createElement('div');
  card.className = 'task-card' + (concluida ? ' task-done' : '');
  card.dataset.id = tarefa.id;

  // ── Cabeçalho (sempre visível)
  const header = document.createElement('div');
  header.className = 'task-card-header';

  if (draggable) {
    const handle = document.createElement('span');
    handle.className = 'task-drag-handle';
    handle.setAttribute('draggable', 'true');
    handle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/>
      <circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/>
      <circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/>
    </svg>`;
    header.appendChild(handle);
  }

  // Check button (ciclo)
  if (mode === 'ciclo' && onCheck) {
    const checkBtn = document.createElement('button');
    checkBtn.className = 'task-check-btn' + (concluida ? ' checked' : '');
    checkBtn.title = concluida ? 'Concluída' : 'Marcar como concluída';
    checkBtn.innerHTML = concluida
      ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="8 12 11 15 16 9"/></svg>`
      : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/></svg>`;
    if (!concluida) {
      checkBtn.addEventListener('click', e => { e.stopPropagation(); onCheck(tarefa); });
    }
    header.appendChild(checkBtn);
  }

  // Info principal
  const info = document.createElement('div');
  info.className = 'task-card-info';

  const linha1 = document.createElement('div');
  linha1.className = 'task-card-linha1';

  const numSpan = document.createElement('span');
  numSpan.className = 'task-num';
  numSpan.textContent = `#${tarefa.numero || tarefa.id}`;

  const nomeSpan = document.createElement('span');
  nomeSpan.className = 'task-disc-nome';
  nomeSpan.textContent = tarefa.disciplina_nome || '';

  linha1.append(numSpan, nomeSpan);

  if (tarefa.prova) {
    const provaBadge = document.createElement('span');
    provaBadge.className = 'task-prova-badge';
    provaBadge.textContent = tarefa.prova;
    linha1.appendChild(provaBadge);
  }

  const tipoBadge = document.createElement('span');
  tipoBadge.className = 'task-tipo-badge';
  tipoBadge.textContent = tipoCfg.label;
  tipoBadge.style.cssText = `color:${tipoCfg.color};background:${tipoCfg.bg}`;
  linha1.appendChild(tipoBadge);

  const linha2 = document.createElement('div');
  linha2.className = 'task-card-linha2';

  if (tarefa.quantidade_questoes) {
    const qSpan = document.createElement('span');
    qSpan.className = 'task-metric';
    qSpan.textContent = `${tarefa.quantidade_questoes} questões`;
    linha2.appendChild(qSpan);
  }
  if (tarefa.tempo_estimado) {
    const tSpan = document.createElement('span');
    tSpan.className = 'task-metric';
    tSpan.textContent = tempoStr;
    linha2.appendChild(tSpan);
  }

  info.append(linha1, linha2);
  header.appendChild(info);

  // Ações (editar/apagar)
  const actions = document.createElement('div');
  actions.className = 'task-card-actions';

  if (onEdit) {
    const editBtn = document.createElement('button');
    editBtn.className = 'task-action-btn';
    editBtn.title = 'Editar';
    editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', e => { e.stopPropagation(); onEdit(tarefa); });
    actions.appendChild(editBtn);
  }
  if (onDelete) {
    const delBtn = document.createElement('button');
    delBtn.className = 'task-action-btn task-action-del';
    delBtn.title = 'Apagar';
    delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
    delBtn.addEventListener('click', e => { e.stopPropagation(); onDelete(tarefa); });
    actions.appendChild(delBtn);
  }

  // Chevron expandir
  const chevron = document.createElement('button');
  chevron.className = 'task-chevron';
  chevron.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  actions.appendChild(chevron);
  header.appendChild(actions);
  card.appendChild(header);

  // ── Corpo expandido
  const body = document.createElement('div');
  body.className = 'task-card-body hidden';

  // Assuntos
  if (assuntos.length > 0) {
    const bloco = document.createElement('div');
    bloco.className = 'task-block task-block-assuntos';
    const titulo = document.createElement('span');
    titulo.className = 'task-block-label';
    titulo.textContent = 'Assuntos';
    bloco.appendChild(titulo);
    bloco.appendChild(buildAssuntoAccordion(assuntos));
    body.appendChild(bloco);
  }

  // Caderno
  if (tarefa.link_caderno) {
    const bloco = document.createElement('div');
    bloco.className = 'task-block task-block-caderno';
    const titulo = document.createElement('span');
    titulo.className = 'task-block-label';
    titulo.textContent = 'Caderno';
    const link = document.createElement('a');
    link.href = tarefa.link_caderno;
    link.target = '_blank';
    link.rel = 'noopener';
    link.textContent = tarefa.link_caderno;
    link.className = 'task-caderno-link';
    bloco.append(titulo, link);
    body.appendChild(bloco);
  }

  // Comando
  if (tarefa.comando || tarefa.o_que_fazer) {
    const bloco = document.createElement('div');
    bloco.className = 'task-block task-block-comando';
    const titulo = document.createElement('span');
    titulo.className = 'task-block-label';
    titulo.textContent = 'Comando';
    const texto = document.createElement('p');
    texto.className = 'task-block-text';
    texto.textContent = tarefa.comando || tarefa.o_que_fazer;
    bloco.append(titulo, texto);
    body.appendChild(bloco);
  }

  // Hiperdica
  if (tarefa.hiperdica) {
    const bloco = document.createElement('div');
    bloco.className = 'task-block task-block-hiperdica';
    const titulo = document.createElement('span');
    titulo.className = 'task-block-label';
    titulo.textContent = 'HIPERDICA';
    const texto = document.createElement('p');
    texto.className = 'task-block-text';
    texto.textContent = tarefa.hiperdica;
    bloco.append(titulo, texto);
    body.appendChild(bloco);
  }

  card.appendChild(body);

  // Toggle expandir/recolher
  chevron.addEventListener('click', e => {
    e.stopPropagation();
    body.classList.toggle('hidden');
    chevron.classList.toggle('open');
  });

  return card;
}

function initTabs(container) {
  const buttons = qsa('.tab-btn', container);
  const panels = qsa('.tab-panel', container);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = qs(`[data-panel="${btn.dataset.tab}"]`, container);
      if (panel) panel.classList.add('active');
    });
  });
}
