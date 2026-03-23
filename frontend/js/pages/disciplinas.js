// ── DISCIPLINAS PAGE ──────────────────────────────────────────────────────────

async function renderDisciplinas(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Disciplinas</div><div class="page-subtitle">Clique numa disciplina para ver detalhes</div></div>
      <button class="btn btn-primary" id="nova-disc-btn">+ Nova Disciplina</button>
    </div>
    <div id="disciplinas-list"></div>
  `;

  async function load() {
    const [disciplinas, planId] = await Promise.all([api.get('/api/disciplinas'), getConcursoAlvo()]);
    const listEl = qs('#disciplinas-list', container);
    if (!disciplinas.length) { listEl.innerHTML = renderEmptyState('▹', 'Nenhuma disciplina cadastrada.'); return; }

    let statsMap = {};
    try {
      const url = planId ? `/api/stats/dashboard-plan?plan_id=${planId}` : '/api/stats/dashboard-plan';
      const s = await api.get(url);
      s.disciplinas.forEach(d => { statsMap[d.id] = d; });
    } catch(e) {}

    listEl.innerHTML = '';
    disciplinas.forEach(d => {
      const s = statsMap[d.id] || {};
      const item = document.createElement('div');
      item.className = 'accordion-item';
      item.dataset.id = d.id;

      // Header: só nome e badge de acerto. Sem botões aqui.
      const header = document.createElement('div');
      header.className = 'accordion-header';
      header.innerHTML = `
        <span class="accordion-arrow">▶</span>
        <span class="disc-acc-nome">${d.nome}</span>
        <div class="disc-acc-badges">
          ${acertoBadge(s.pct_acerto)}
          <span class="text-small text-muted">Avanço: ${s.pct_avanco ? s.pct_avanco + '%' : '—'}</span>
        </div>
      `;

      const body = document.createElement('div');
      body.className = 'accordion-body';
      body.id = `disc-body-${d.id}`;

      item.appendChild(header);
      item.appendChild(body);
      listEl.appendChild(item);

      // Toggle accordion — listener simples, sem botões para interferir
      header.addEventListener('click', () => {
        const isOpen = item.classList.toggle('open');
        if (isOpen && !item.dataset.loaded) {
          item.dataset.loaded = '1';
          loadDiscBody(d.id, item, load);
        }
      });
    });
  }

  qs('#nova-disc-btn', container).addEventListener('click', () => openDiscModal(null, load));
  load();
}

// ── CORPO DA DISCIPLINA ───────────────────────────────────────────────────────
async function loadDiscBody(discId, item, onReload) {
  const body = qs(`#disc-body-${discId}`, item);
  body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3);font-size:0.84rem">Carregando...</div>`;

  const [discs, stats] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get(`/api/stats/disciplina/${discId}`)
  ]);
  const disc = discs.find(d => d.id == discId);
  if (!disc) return;

  const reload = () => {
    item.dataset.loaded = '';
    loadDiscBody(discId, item, onReload);
  };

  // Barra de ações da disciplina — fora do header, dentro do body
  const acoesBarra = document.createElement('div');
  acoesBarra.className = 'disc-acoes-barra';
  acoesBarra.innerHTML = `<span style="font-size:0.78rem;color:var(--text-3)">Disciplina:</span>`;

  const editarBtn = document.createElement('button');
  editarBtn.className = 'btn-action btn-action-edit';
  editarBtn.title = 'Editar disciplina';
  editarBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editarBtn.addEventListener('click', () => openDiscModal(discId, onReload));

  const apagarBtn = document.createElement('button');
  apagarBtn.className = 'btn-action btn-action-delete';
  apagarBtn.title = 'Apagar disciplina';
  apagarBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  apagarBtn.addEventListener('click', async () => {
    if (!confirm(`Apagar a disciplina "${disc.nome}"?`)) return;
    await api.delete(`/api/disciplinas/${discId}`);
    showToast('Disciplina apagada');
    item.classList.remove('open');
    item.dataset.loaded = '';
    onReload();
  });

  acoesBarra.appendChild(editarBtn);
  acoesBarra.appendChild(apagarBtn);

  // Conteúdo do body
  const conteudo = document.createElement('div');
  conteudo.innerHTML = `
    <div class="disc-detail-grid">
      <div class="disc-info-card">
        <div class="disc-info-title">Estratégia</div>
        <div class="disc-info-content">${disc.estrategia || '<span style="color:var(--text-3)">Não definida</span>'}</div>
      </div>
      <div>
        <div class="disc-info-card" style="margin-bottom:10px">
          <div class="disc-info-title">Material de Teoria</div>
          <div class="disc-info-content">
            ${disc.teoria_material ? `${disc.teoria_material}${disc.teoria_link ? ` — <a href="${disc.teoria_link}" target="_blank">📎 link</a>` : ''}` : '<span style="color:var(--text-3)">Não definido</span>'}
          </div>
        </div>
        <div class="disc-info-card">
          <div class="disc-info-title">Material de Resumo</div>
          <div class="disc-info-content">
            ${disc.resumo_tipo ? `<strong>${disc.resumo_tipo}</strong>` : ''}
            ${disc.resumo_descricao ? `<br>${disc.resumo_descricao}` : ''}
            ${disc.resumo_link ? `<br><a href="${disc.resumo_link}" target="_blank">📎 link</a>` : ''}
            ${!disc.resumo_tipo && !disc.resumo_descricao ? '<span style="color:var(--text-3)">Não definido</span>' : ''}
          </div>
        </div>
      </div>
    </div>

    <div style="padding:0 20px">
      <div class="metrics-grid" style="margin-bottom:16px">
        <div class="metric-card"><div class="metric-label">% Acerto</div><div class="metric-value">${stats.pct_acerto ? stats.pct_acerto + '%' : '—'}</div></div>
        <div class="metric-card"><div class="metric-label">Questões</div><div class="metric-value">${(stats.total_questoes||0).toLocaleString('pt-BR')}</div></div>
        <div class="metric-card"><div class="metric-label">Avanço</div><div class="metric-value">${stats.pct_avanco ? stats.pct_avanco + '%' : '—'}</div></div>
        <div class="metric-card"><div class="metric-label">Assuntos na Meta</div><div class="metric-value">${stats.assuntos_na_meta}/${stats.assuntos.length}</div></div>
      </div>
    </div>

    <div style="padding:0 20px 20px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
        <div class="section-title" style="margin:0">Assuntos</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center" id="assuntos-toolbar-${discId}"></div>
      </div>
      <div id="assuntos-tree-${discId}" class="assunto-tree"></div>
    </div>
  `;

  body.innerHTML = '';
  body.appendChild(acoesBarra);
  body.appendChild(conteudo);

  // Toolbar de assuntos — botões via createElement
  const toolbar = qs(`#assuntos-toolbar-${discId}`, body);

  const expandirBtn = document.createElement('button');
  expandirBtn.className = 'btn btn-outline btn-sm';
  expandirBtn.textContent = '↕ Expandir tudo';
  expandirBtn.addEventListener('click', () => {
    qsa('.assunto-children', body).forEach(el => el.classList.remove('hidden'));
    qsa('.assunto-tree-toggle', body).forEach(el => { if (el.textContent === '▶') el.textContent = '▼'; });
  });

  const retrairBtn = document.createElement('button');
  retrairBtn.className = 'btn btn-outline btn-sm';
  retrairBtn.textContent = '↕ Retrair tudo';
  retrairBtn.addEventListener('click', () => {
    qsa('.assunto-children', body).forEach(el => el.classList.add('hidden'));
    qsa('.assunto-tree-toggle', body).forEach(el => { if (el.textContent === '▼') el.textContent = '▶'; });
  });

  const importarBtn = document.createElement('button');
  importarBtn.className = 'btn btn-outline btn-sm';
  importarBtn.textContent = '⬆ Importar';
  importarBtn.addEventListener('click', () => openImportarModal(discId, reload));

  const novoAssuntoBtn = document.createElement('button');
  novoAssuntoBtn.className = 'btn btn-primary btn-sm';
  novoAssuntoBtn.textContent = '+ Novo Assunto';
  novoAssuntoBtn.addEventListener('click', () => openAssuntoModal(null, '', discId, null, reload));

  toolbar.appendChild(expandirBtn);
  toolbar.appendChild(retrairBtn);
  toolbar.appendChild(importarBtn);
  toolbar.appendChild(novoAssuntoBtn);

  await renderAssuntosTree(discId, stats, body, reload);
}

// ── ÁRVORE DE ASSUNTOS ────────────────────────────────────────────────────────
async function renderAssuntosTree(discId, stats, body, reload) {
  const treeEl = qs(`#assuntos-tree-${discId}`, body);
  if (!treeEl) return;

  const assuntos = await api.get(`/api/assuntos?disciplina_id=${discId}`);
  if (!assuntos.length) { treeEl.innerHTML = renderEmptyState('▸', 'Nenhum assunto cadastrado.'); return; }

  const raizes = assuntos.filter(a => !a.parent_id).sort((a, b) => (a.ordem||0) - (b.ordem||0));
  const filhosMap = {};
  assuntos.forEach(a => {
    if (a.parent_id) {
      if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
      filhosMap[a.parent_id].push(a);
    }
  });
  Object.values(filhosMap).forEach(arr => arr.sort((a, b) => (a.ordem||0) - (b.ordem||0)));

  const statsMap = {};
  (stats.assuntos || []).forEach(a => {
    statsMap[a.id] = a;
    (a.filhos || []).forEach(f => { statsMap[f.id] = f; });
  });

  treeEl.innerHTML = '';
  let contador = {};

  function criarNodeEl(a, nivel) {
    const filhos = filhosMap[a.id] || [];
    const hasFilhos = filhos.length > 0;
    const pct = statsMap[a.id]?.pct_acerto;
    const grupoKey = a.parent_id || 'root';
    contador[grupoKey] = (contador[grupoKey] || 0) + 1;
    const num = String(contador[grupoKey]).padStart(2, '0');

    const itemEl = document.createElement('div');
    itemEl.className = 'assunto-tree-item';
    itemEl.dataset.id = a.id;
    itemEl.dataset.parent = a.parent_id || '';
    itemEl.draggable = true;
    if (nivel > 0) itemEl.style.paddingLeft = (nivel * 20) + 'px';

    // Header (toggle)
    const headerEl = document.createElement('div');
    headerEl.className = 'assunto-tree-header';

    const dragHandle = document.createElement('span');
    dragHandle.className = 'drag-handle';
    dragHandle.title = 'Arrastar';
    dragHandle.textContent = '⠿';

    const toggle = document.createElement('span');
    toggle.className = 'assunto-tree-toggle';
    toggle.textContent = hasFilhos ? '▶' : '·';

    const numSpan = document.createElement('span');
    numSpan.className = 'assunto-num';
    numSpan.textContent = num;

    const nomeSpan = document.createElement('span');
    nomeSpan.className = 'assunto-tree-nome';
    nomeSpan.textContent = a.nome;

    const badgeSpan = document.createElement('span');
    badgeSpan.innerHTML = acertoBadge(pct);

    headerEl.appendChild(dragHandle);
    headerEl.appendChild(toggle);
    headerEl.appendChild(numSpan);
    headerEl.appendChild(nomeSpan);
    headerEl.appendChild(badgeSpan);

    // Botões de ação — criados com createElement e addEventListener direto
    const editBtn = document.createElement('button');
    editBtn.className = 'btn-action btn-action-edit';
    editBtn.title = 'Editar assunto';
    editBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
    editBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAssuntoModal(a.id, a.nome, discId, a.parent_id || null, reload);
    });

    const addSubBtn = document.createElement('button');
    addSubBtn.className = 'btn btn-outline btn-sm';
    addSubBtn.style.fontSize = '0.7rem';
    addSubBtn.style.padding = '2px 6px';
    addSubBtn.title = 'Adicionar subassunto';
    addSubBtn.textContent = '+sub';
    addSubBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openAssuntoModal(null, '', discId, a.id, reload);
    });

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-action btn-action-delete';
    delBtn.title = 'Apagar assunto';
    delBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('Apagar este assunto e seus subassuntos?')) return;
      await api.delete(`/api/assuntos/${a.id}`);
      showToast('Assunto apagado');
      reload();
    });

    headerEl.appendChild(editBtn);
    headerEl.appendChild(addSubBtn);
    headerEl.appendChild(delBtn);

    // Toggle só no header (não nos botões — stopPropagation nos botões resolve)
    headerEl.addEventListener('click', () => {
      if (!hasFilhos) return;
      const filhosEl = qs(`#filhos-${a.id}`, itemEl);
      if (!filhosEl) return;
      filhosEl.classList.toggle('hidden');
      toggle.textContent = filhosEl.classList.contains('hidden') ? '▶' : '▼';
    });

    itemEl.appendChild(headerEl);

    // Filhos
    if (hasFilhos) {
      const filhosContainer = document.createElement('div');
      filhosContainer.className = 'assunto-children hidden';
      filhosContainer.id = `filhos-${a.id}`;
      filhos.forEach(f => filhosContainer.appendChild(criarNodeEl(f, nivel + 1)));
      itemEl.appendChild(filhosContainer);
    }

    return itemEl;
  }

  raizes.forEach(a => treeEl.appendChild(criarNodeEl(a, 0)));

  // Drag & drop
  let dragId = null;
  qsa('.assunto-tree-item', treeEl).forEach(el => {
    el.addEventListener('dragstart', e => {
      dragId = el.dataset.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => el.classList.add('dragging'), 0);
    });
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      qsa('.drag-over', treeEl).forEach(x => x.classList.remove('drag-over'));
    });
    el.addEventListener('dragover', e => {
      e.preventDefault();
      if (el.dataset.id === dragId) return;
      qsa('.drag-over', treeEl).forEach(x => x.classList.remove('drag-over'));
      el.classList.add('drag-over');
    });
    el.addEventListener('drop', async e => {
      e.preventDefault();
      e.stopPropagation();
      if (!dragId || el.dataset.id === dragId) return;
      el.classList.remove('drag-over');
      const dragEl = qs(`[data-id="${dragId}"]`, treeEl);
      el.parentNode.insertBefore(dragEl, el);
      const itensMesmoNivel = [...el.parentNode.querySelectorAll(':scope > .assunto-tree-item')];
      const payload = itensMesmoNivel.map((it, idx) => ({
        id: parseInt(it.dataset.id),
        ordem: idx + 1,
        parent_id: it.dataset.parent ? parseInt(it.dataset.parent) : null
      }));
      await api.put('/api/assuntos/reordenar', { itens: payload });
      reload();
    });
  });
}

// ── MODAIS ────────────────────────────────────────────────────────────────────
function openDiscModal(id = null, onSave = null) {
  openModal(id ? 'Editar Disciplina' : 'Nova Disciplina', `
    <div class="form-group"><label>Nome *</label><input type="text" id="d-nome" required autofocus></div>
    <div class="form-section">
      <div class="form-section-title">📖 Teoria</div>
      <div class="form-group"><label>Material</label><input type="text" id="d-teoria-material" placeholder="Ex: Livro do Estratégia, PDF..."></div>
      <div class="form-group"><label>Link (opcional)</label><input type="url" id="d-teoria-link" placeholder="https://..."></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">📝 Resumo</div>
      <div class="form-group"><label>Tipo</label><input type="text" id="d-resumo-tipo" placeholder="Ex: Mapa mental, Flashcards..."></div>
      <div class="form-group"><label>Descrição</label><input type="text" id="d-resumo-descricao"></div>
      <div class="form-group"><label>Link (opcional)</label><input type="url" id="d-resumo-link" placeholder="https://..."></div>
    </div>
    <div class="form-section">
      <div class="form-section-title">📌 Estratégia</div>
      <div class="form-group">
        <div class="editor-toolbar">
          <button type="button" class="editor-btn" onclick="document.execCommand('bold')"><b>B</b></button>
          <button type="button" class="editor-btn" onclick="document.execCommand('italic')"><i>I</i></button>
          <button type="button" class="editor-btn" onclick="document.execCommand('insertUnorderedList')">• Lista</button>
        </div>
        <div class="rich-editor" id="d-estrategia" contenteditable="true"></div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-disc-btn">Salvar</button>
    </div>
  `);

  if (id) {
    api.get('/api/disciplinas').then(discs => {
      const d = discs.find(x => x.id == id);
      if (!d) return;
      qs('#d-nome').value = d.nome || '';
      qs('#d-teoria-material').value = d.teoria_material || '';
      qs('#d-teoria-link').value = d.teoria_link || '';
      qs('#d-resumo-tipo').value = d.resumo_tipo || '';
      qs('#d-resumo-descricao').value = d.resumo_descricao || '';
      qs('#d-resumo-link').value = d.resumo_link || '';
      qs('#d-estrategia').innerHTML = d.estrategia || '';
    });
  }

  qs('#save-disc-btn').addEventListener('click', async () => {
    const nome = qs('#d-nome').value.trim();
    if (!nome) { showToast('Nome obrigatório', 'error'); return; }
    const payload = {
      nome,
      teoria_material: qs('#d-teoria-material').value.trim(),
      teoria_link: qs('#d-teoria-link').value.trim(),
      resumo_tipo: qs('#d-resumo-tipo').value.trim(),
      resumo_descricao: qs('#d-resumo-descricao').value.trim(),
      resumo_link: qs('#d-resumo-link').value.trim(),
      estrategia: qs('#d-estrategia').innerHTML,
    };
    try {
      if (id) await api.put(`/api/disciplinas/${id}`, payload);
      else await api.post('/api/disciplinas', payload);
      closeModal();
      showToast(id ? 'Disciplina atualizada!' : 'Disciplina criada!', 'success');
      if (onSave) onSave();
    } catch(e) {
      showToast('Erro: ' + (e.message || 'Não foi possível salvar'), 'error');
    }
  });
}

function openImportarModal(discId, onSave) {
  openModal('Importar Assuntos (TechConcursos)', `
    <p style="font-size:0.84rem;color:var(--text-2);margin-bottom:12px">
      Cole o índice copiado do TechConcursos. O número vira hierarquia automaticamente — só o nome é salvo.
    </p>
    <div class="form-group">
      <label>Conteúdo</label>
      <textarea id="import-texto" style="min-height:200px;font-family:monospace;font-size:0.8rem" placeholder="01&#9;Contabilidade Básica&#10;01.01&#9;Conceito e Objeto"></textarea>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="importar-confirmar">Importar</button>
    </div>
  `);

  qs('#importar-confirmar').addEventListener('click', async () => {
    const texto = qs('#import-texto').value.trim();
    if (!texto) { showToast('Cole o conteúdo', 'error'); return; }
    try {
      const result = await api.post('/api/assuntos/importar', { disciplina_id: discId, texto });
      closeModal();
      showToast(`${result.inserted} assuntos importados!`, 'success');
      if (onSave) onSave();
    } catch(e) {
      showToast('Erro ao importar: ' + e.message, 'error');
    }
  });
}

function openAssuntoModal(id, nomeAtual, disciplina_id, parent_id, onSave) {
  const titulo = id ? 'Editar Assunto' : (parent_id ? 'Novo Subassunto' : 'Novo Assunto');
  openModal(titulo, `
    <div class="form-group"><label>Nome *</label><input type="text" id="a-nome" value="${nomeAtual || ''}" required autofocus></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-assunto-btn">Salvar</button>
    </div>
  `);
  qs('#a-nome').focus();
  qs('#save-assunto-btn').addEventListener('click', async () => {
    const nome = qs('#a-nome').value.trim();
    if (!nome) { showToast('Nome obrigatório', 'error'); return; }
    if (id) {
      await api.put(`/api/assuntos/${id}`, { nome, disciplina_id, parent_id: parent_id || null });
    } else {
      await api.post('/api/assuntos', { nome, disciplina_id, parent_id: parent_id || null });
    }
    closeModal();
    showToast('Assunto salvo!', 'success');
    if (onSave) onSave();
  });
}

// ── DISCIPLINA DETALHE (via dashboard) ───────────────────────────────────────
async function renderDisciplinaDetalhe(container, params = {}) {
  const { id, plan_id } = params;
  if (!id) { container.innerHTML = '<p>Disciplina não encontrada.</p>'; return; }

  const stats = await api.get(`/api/stats/disciplina-plan/${id}` + qs_params({ plan_id }));
  const d = stats.disciplina;

  container.innerHTML = `
    <a class="back-link" id="back-btn">← Voltar</a>
    <div class="page-header">
      <div><div class="page-title">${d.nome}</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap" id="det-acoes"></div>
    </div>
    <div class="metrics-grid">
      <div class="metric-card"><div class="metric-label">% Acerto</div><div class="metric-value">${stats.pct_acerto ? stats.pct_acerto + '%' : '—'}</div></div>
      <div class="metric-card"><div class="metric-label">Questões</div><div class="metric-value">${(stats.total_questoes||0).toLocaleString('pt-BR')}</div></div>
      <div class="metric-card"><div class="metric-label">Avanço</div><div class="metric-value">${stats.pct_avanco ? stats.pct_avanco + '%' : '—'}</div></div>
      <div class="metric-card"><div class="metric-label">Assuntos na Meta</div><div class="metric-value">${stats.assuntos_na_meta}/${stats.assuntos.length}</div></div>
    </div>
    <div class="tabs">
      <button class="tab-btn active" data-tab="assuntos">Assuntos</button>
      <button class="tab-btn" data-tab="historico">Histórico</button>
    </div>
    <div class="tab-panel active" data-panel="assuntos">
      <div class="assunto-tree" id="assuntos-tree-det"></div>
    </div>
    <div class="tab-panel" data-panel="historico">
      <div class="card"><div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Assuntos</th><th>Tipo</th><th class="td-right">Questões</th><th class="td-right">% Acerto</th><th></th></tr></thead>
        <tbody id="hist-tbody"></tbody>
      </table></div></div>
    </div>
  `;

  qs('#back-btn', container).addEventListener('click', () => window._app.navigate(window._app.previousPage || 'disciplinas'));

  const acoesDet = qs('#det-acoes', container);

  const editDetBtn = document.createElement('button');
  editDetBtn.className = 'btn-action btn-action-edit';
  editDetBtn.title = 'Editar disciplina';
  editDetBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
  editDetBtn.addEventListener('click', () => openDiscModal(id, () => renderDisciplinaDetalhe(container, params)));

  const delDetBtn = document.createElement('button');
  delDetBtn.className = 'btn-action btn-action-delete';
  delDetBtn.title = 'Apagar disciplina';
  delDetBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>`;
  delDetBtn.addEventListener('click', async () => {
    if (!confirm('Apagar disciplina?')) return;
    await api.delete(`/api/disciplinas/${id}`);
    showToast('Disciplina apagada');
    window._app.navigate('disciplinas');
  });

  acoesDet.appendChild(editDetBtn);
  acoesDet.appendChild(delDetBtn);

  // Assuntos simples (só visualização)
  const treeEl = qs('#assuntos-tree-det', container);
  const assuntos = await api.get(`/api/assuntos?disciplina_id=${id}`);
  const statsMap = {};
  stats.assuntos.forEach(a => { statsMap[a.id] = a; (a.filhos||[]).forEach(f => { statsMap[f.id] = f; }); });

  if (!assuntos.length) { treeEl.innerHTML = renderEmptyState('▸', 'Nenhum assunto.'); }
  else {
    const raizes = assuntos.filter(a => !a.parent_id).sort((a,b) => (a.ordem||0)-(b.ordem||0));
    const fMap = {};
    assuntos.forEach(a => { if (a.parent_id) { if(!fMap[a.parent_id]) fMap[a.parent_id]=[]; fMap[a.parent_id].push(a); } });
    let n = {};
    function renderDet(a, nivel=0) {
      const filhos = (fMap[a.id]||[]).sort((x,y)=>(x.ordem||0)-(y.ordem||0));
      const key = a.parent_id||'root'; n[key]=(n[key]||0)+1;
      const num = String(n[key]).padStart(2,'0');
      const el = document.createElement('div');
      el.className = 'assunto-tree-item';
      el.style.paddingLeft = (nivel*20) + 'px';
      el.dataset.id = a.id;
      const h = document.createElement('div');
      h.className = 'assunto-tree-header';
      h.innerHTML = `<span class="assunto-tree-toggle">${filhos.length?'▶':'·'}</span><span class="assunto-num">${num}</span><span class="assunto-tree-nome">${a.nome}</span>${acertoBadge(statsMap[a.id]?.pct_acerto)}`;
      el.appendChild(h);
      if (filhos.length) {
        const fc = document.createElement('div');
        fc.className = 'assunto-children hidden';
        fc.id = `filhos-det-${a.id}`;
        filhos.forEach(f => fc.appendChild(renderDet(f, nivel+1)));
        el.appendChild(fc);
        h.addEventListener('click', () => {
          fc.classList.toggle('hidden');
          h.querySelector('.assunto-tree-toggle').textContent = fc.classList.contains('hidden') ? '▶' : '▼';
        });
      }
      return el;
    }
    raizes.forEach(a => treeEl.appendChild(renderDet(a, 0)));
  }

  // Histórico
  const tbody = qs('#hist-tbody', container);
  if (!stats.sessoes.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--text-3)">Nenhuma sessão.</td></tr>`;
  } else {
    tbody.innerHTML = stats.sessoes.map(s => {
      const pct = s.total_questoes > 0 ? ((s.acertos/s.total_questoes)*100).toFixed(1) : null;
      const assuntosStr = s.assuntos && s.assuntos.length ? s.assuntos.map(a => a.nome).join(', ') : '—';
      return `<tr>
        <td>${formatDate(s.data)}</td>
        <td style="font-size:0.8rem;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${assuntosStr}</td>
        <td><span class="acerto-badge acerto-none">${s.tipo}</span></td>
        <td class="td-right">${s.total_questoes||0}</td>
        <td class="td-right">${acertoBadge(pct)}</td>
        <td><button class="btn-action btn-action-delete del-s" data-id="${s.id}" title="Apagar sessão"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg></button></td>
      </tr>`;
    }).join('');
    qsa('.del-s', tbody).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Apagar sessão?')) return;
        await api.delete(`/api/sessoes/${btn.dataset.id}`);
        renderDisciplinaDetalhe(container, params);
      });
    });
  }

  initTabs(container);
}
