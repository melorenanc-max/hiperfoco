// ── DISCIPLINAS PAGE ──────────────────────────────────────────────────────────

async function renderDisciplinas(container) {
  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Disciplinas</div><div class="page-subtitle">Gerencie suas disciplinas e assuntos</div></div>
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
      (s.disciplinas || []).forEach(d => { statsMap[d.id] = d; });
    } catch(e) {}

    listEl.innerHTML = '';
    disciplinas.forEach(d => {
      const s = statsMap[d.id] || {};
      const pct = s.pct_acerto ? parseFloat(s.pct_acerto) : null;
      const item = document.createElement('div');
      item.className = 'accordion-item disc-accordion-item';
      item.dataset.id = d.id;

      // ── Header
      const header = document.createElement('div');
      header.className = 'accordion-header disc-acc-header';

      const chevron = document.createElement('span');
      chevron.className = 'accordion-arrow';
      chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

      const nome = document.createElement('span');
      nome.className = 'disc-acc-nome';
      nome.textContent = d.nome;

      const badges = document.createElement('div');
      badges.className = 'disc-acc-badges';

      if (pct !== null) {
        const b = document.createElement('span');
        b.className = `acerto-badge ${acertoClass(pct)}`;
        b.textContent = `${pct.toFixed(1)}%`;
        badges.appendChild(b);
      }
      if (s.total_questoes) {
        const q = document.createElement('span');
        q.className = 'text-small text-muted';
        q.textContent = `${(s.total_questoes||0)} questões`;
        badges.appendChild(q);
      }

      const headerActions = document.createElement('div');
      headerActions.className = 'disc-header-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-action btn-action-edit';
      editBtn.title = 'Editar disciplina';
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      editBtn.addEventListener('click', e => { e.stopPropagation(); openDiscModal(d.id, load); });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-action btn-action-delete';
      delBtn.title = 'Apagar disciplina';
      delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>`;
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm(`Apagar a disciplina "${d.nome}"?`)) return;
        await api.delete(`/api/disciplinas/${d.id}`);
        showToast('Disciplina apagada'); load();
      });

      headerActions.append(editBtn, delBtn);
      header.append(chevron, nome, badges, headerActions);

      const body = document.createElement('div');
      body.className = 'accordion-body';
      body.id = `disc-body-${d.id}`;

      item.append(header, body);
      listEl.appendChild(item);

      header.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const isOpen = item.classList.toggle('open');
        chevron.style.transform = isOpen ? 'rotate(90deg)' : '';
        if (isOpen && !item.dataset.loaded) {
          item.dataset.loaded = '1';
          loadDiscBody(d.id, d, item);
        }
      });
    });
  }

  qs('#nova-disc-btn', container).addEventListener('click', () => openDiscModal(null, load));
  load();
}

// ── CORPO DA DISCIPLINA ───────────────────────────────────────────────────────
async function loadDiscBody(discId, discBasic, item) {
  const body = qs(`#disc-body-${discId}`, item);
  body.innerHTML = `<div style="padding:20px;text-align:center;color:var(--text-3)">Carregando...</div>`;

  const [discs, assuntos] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get(`/api/assuntos?disciplina_id=${discId}`)
  ]);
  const disc = discs.find(d => d.id == discId) || discBasic;

  const reload = () => {
    item.dataset.loaded = '';
    loadDiscBody(discId, disc, item);
  };

  body.innerHTML = '';

  // ── Grid de cards de informação
  const grid = document.createElement('div');
  grid.className = 'disc-info-grid';
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:16px 20px;';

  // Card Estratégia (ocupa linha 1 e 2 da coluna esquerda)
  grid.appendChild(makeInfoCard('Estratégia', disc.estrategia, 'estrategia', 'textarea', discId, reload));

  // Coluna direita: teoria + resumo
  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  rightCol.appendChild(makeInfoCard('Material de Teoria', disc.teoria_material, 'teoria_material', 'text', discId, reload));
  rightCol.appendChild(makeInfoCard('Material de Resumo', disc.resumo_descricao || disc.resumo_tipo, 'resumo_descricao', 'text', discId, reload));
  grid.appendChild(rightCol);

  body.appendChild(grid);

  // ── Seção Assuntos
  const assuntosSection = document.createElement('div');
  assuntosSection.style.cssText = 'padding:0 20px 20px;border-top:1px solid var(--border);padding-top:16px;';

  const assuntosHeader = document.createElement('div');
  assuntosHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';

  const assuntosTitle = document.createElement('div');
  assuntosTitle.className = 'section-title';
  assuntosTitle.style.margin = '0';
  assuntosTitle.textContent = 'Assuntos';

  const editAssuntosBtn = document.createElement('button');
  editAssuntosBtn.className = 'btn btn-outline btn-sm';
  editAssuntosBtn.textContent = 'Editar assuntos';
  editAssuntosBtn.addEventListener('click', () => openEditarAssuntosModal(discId, assuntos, reload));

  assuntosHeader.append(assuntosTitle, editAssuntosBtn);
  assuntosSection.appendChild(assuntosHeader);

  if (assuntos.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'text-muted text-small';
    empty.textContent = 'Nenhum assunto cadastrado. Clique em "Editar assuntos" para adicionar.';
    assuntosSection.appendChild(empty);
  } else {
    assuntosSection.appendChild(buildAssuntoAccordion(assuntos));
  }

  body.appendChild(assuntosSection);
}

function makeInfoCard(titulo, valor, campo, tipo, discId, reload) {
  const card = document.createElement('div');
  card.className = 'disc-info-card';

  const titleRow = document.createElement('div');
  titleRow.className = 'disc-info-card-title';

  const titleSpan = document.createElement('span');
  titleSpan.textContent = titulo;

  const editIcon = document.createElement('button');
  editIcon.className = 'disc-info-edit-btn';
  editIcon.title = 'Editar';
  editIcon.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;

  titleRow.append(titleSpan, editIcon);

  const display = document.createElement('div');
  display.className = 'disc-info-content';
  display.textContent = valor || '';
  if (!valor) { display.style.color = 'var(--text-3)'; display.textContent = 'Não definido'; }

  const editForm = document.createElement('div');
  editForm.className = 'disc-info-edit-form hidden';

  const input = tipo === 'textarea'
    ? Object.assign(document.createElement('textarea'), { rows: 4, value: valor || '' })
    : Object.assign(document.createElement('input'), { type: 'text', value: valor || '' });
  input.className = 'form-control';
  input.style.cssText = 'width:100%;margin-bottom:8px;';

  const btnRow = document.createElement('div');
  btnRow.style.cssText = 'display:flex;gap:6px;';

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary btn-sm';
  saveBtn.textContent = 'Salvar';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline btn-sm';
  cancelBtn.textContent = 'Cancelar';

  btnRow.append(saveBtn, cancelBtn);
  editForm.append(input, btnRow);
  card.append(titleRow, display, editForm);

  editIcon.addEventListener('click', () => {
    display.classList.add('hidden');
    editForm.classList.remove('hidden');
    input.focus();
  });
  cancelBtn.addEventListener('click', () => {
    display.classList.remove('hidden');
    editForm.classList.add('hidden');
    input.value = valor || '';
  });
  saveBtn.addEventListener('click', async () => {
    const payload = { [campo]: input.value.trim() };
    await api.put(`/api/disciplinas/${discId}`, { ...payload });
    showToast('Salvo!', 'success');
    reload();
  });

  return card;
}

// ── MODAL EDITAR ASSUNTOS ─────────────────────────────────────────────────────
function openEditarAssuntosModal(discId, assuntosIniciais, onSave) {
  // Estado local editável
  let assuntos = assuntosIniciais.map(a => ({ ...a, id: a.id }));

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:500;display:flex;align-items:center;justify-content:center;';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.cssText = 'width:520px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;background:var(--bg-card);border-radius:var(--radius-lg);overflow:hidden;';

  const mHeader = document.createElement('div');
  mHeader.className = 'modal-header';
  mHeader.style.cssText = 'padding:16px 20px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;';
  mHeader.innerHTML = `<h3 style="font-size:1rem;font-weight:700">Editar Assuntos</h3>`;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'btn-icon';
  closeBtn.textContent = '✕';
  closeBtn.addEventListener('click', () => document.body.removeChild(overlay));
  mHeader.appendChild(closeBtn);

  const mBody = document.createElement('div');
  mBody.style.cssText = 'flex:1;overflow-y:auto;padding:16px 20px;';

  const nota = document.createElement('p');
  nota.style.cssText = 'font-size:0.78rem;color:var(--text-3);margin-bottom:12px;';
  nota.textContent = 'Arraste para reordenar. Passe o mouse para ver opções.';
  mBody.appendChild(nota);

  const lista = document.createElement('div');
  lista.id = 'edit-assuntos-lista';
  mBody.appendChild(lista);

  const addBtn = document.createElement('button');
  addBtn.className = 'btn btn-outline btn-sm';
  addBtn.style.cssText = 'margin-top:12px;width:100%;';
  addBtn.textContent = '+ Adicionar assunto';
  addBtn.addEventListener('click', () => {
    const novoId = -(Date.now());
    assuntos.push({ id: novoId, nome: '', parent_id: null, ordem: assuntos.filter(a=>!a.parent_id).length + 1 });
    renderLista();
  });
  mBody.appendChild(addBtn);

  const mFooter = document.createElement('div');
  mFooter.style.cssText = 'padding:12px 20px;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;';
  mFooter.innerHTML = `<span style="font-size:0.75rem;color:var(--text-3)">Ordem salva ao clicar em Salvar</span>`;

  const footerBtns = document.createElement('div');
  footerBtns.style.cssText = 'display:flex;gap:8px;';

  const cancelarBtn = document.createElement('button');
  cancelarBtn.className = 'btn btn-outline';
  cancelarBtn.textContent = 'Cancelar';
  cancelarBtn.addEventListener('click', () => document.body.removeChild(overlay));

  const salvarBtn = document.createElement('button');
  salvarBtn.className = 'btn btn-primary';
  salvarBtn.textContent = 'Salvar';
  salvarBtn.addEventListener('click', async () => {
    salvarBtn.disabled = true; salvarBtn.textContent = 'Salvando...';
    try {
      // Coleta a ordem atual da lista e salva
      const items = qsa('[data-edit-id]', lista);
      const payload = [];
      let rootNum = 0;
      items.forEach(el => {
        const id = parseInt(el.dataset.editId);
        const parentId = el.dataset.parentId ? parseInt(el.dataset.parentId) : null;
        const nome = el.querySelector('.edit-assunto-nome').value.trim();
        if (!nome) return;
        rootNum++;
        payload.push({ id: id > 0 ? id : null, nome, parent_id: parentId, ordem: rootNum });
      });
      await api.put(`/api/assuntos/reordenar-completo`, { disciplina_id: discId, itens: payload });
      showToast('Assuntos salvos!', 'success');
      document.body.removeChild(overlay);
      onSave();
    } catch(e) {
      showToast('Erro ao salvar: ' + (e.message || ''), 'error');
    } finally {
      salvarBtn.disabled = false; salvarBtn.textContent = 'Salvar';
    }
  });

  footerBtns.append(cancelarBtn, salvarBtn);
  mFooter.appendChild(footerBtns);
  modal.append(mHeader, mBody, mFooter);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  function renderLista() {
    lista.innerHTML = '';
    const raizes = assuntos.filter(a => !a.parent_id).sort((a,b) => (a.ordem||0)-(b.ordem||0));
    const filhosMap = {};
    assuntos.forEach(a => {
      if (a.parent_id) {
        if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
        filhosMap[a.parent_id].push(a);
      }
    });

    function renderItem(a, nivel) {
      const el = document.createElement('div');
      el.className = 'edit-assunto-item';
      el.dataset.editId = a.id;
      el.dataset.parentId = a.parent_id || '';
      el.draggable = true;
      el.style.paddingLeft = nivel === 0 ? '0' : nivel === 1 ? '20px' : '40px';

      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:8px;padding:5px 4px;border-radius:6px;';
      row.style.cursor = 'default';

      const handle = document.createElement('span');
      handle.style.cssText = 'cursor:grab;color:var(--text-3);flex-shrink:0;';
      handle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></svg>`;

      const numSpan = document.createElement('span');
      numSpan.style.cssText = 'font-size:0.72rem;color:var(--text-3);min-width:24px;flex-shrink:0;';

      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'edit-assunto-nome form-control';
      input.value = a.nome;
      input.style.cssText = 'flex:1;font-size:0.84rem;padding:4px 8px;';

      const addSubBtn = document.createElement('button');
      addSubBtn.className = 'btn btn-outline btn-sm';
      addSubBtn.style.cssText = 'font-size:0.7rem;padding:2px 7px;opacity:0;transition:opacity 0.15s;flex-shrink:0;';
      addSubBtn.textContent = '+sub';
      addSubBtn.addEventListener('click', () => {
        if (a.id < 0 && !a.nome) { showToast('Salve o nome do assunto pai primeiro', 'error'); return; }
        const novoId = -(Date.now());
        const parentFilhos = assuntos.filter(x => x.parent_id === a.id);
        assuntos.push({ id: novoId, nome: '', parent_id: a.id, ordem: parentFilhos.length + 1 });
        renderLista();
      });

      const delBtn = document.createElement('button');
      delBtn.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-3);padding:3px;opacity:0;transition:opacity 0.15s;flex-shrink:0;';
      delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
      delBtn.addEventListener('click', () => {
        // Remove o item e seus filhos
        assuntos = assuntos.filter(x => x.id !== a.id && x.parent_id !== a.id);
        renderLista();
      });

      row.addEventListener('mouseenter', () => { addSubBtn.style.opacity='1'; delBtn.style.opacity='1'; });
      row.addEventListener('mouseleave', () => { addSubBtn.style.opacity='0'; delBtn.style.opacity='0'; });

      if (nivel === 0) addSubBtn.style.display = '';
      else addSubBtn.style.display = 'none'; // Só nível raiz pode ter sub (por ora)

      row.append(handle, numSpan, input, addSubBtn, delBtn);
      el.appendChild(row);

      // Filhos
      const filhos = (filhosMap[a.id] || []).sort((x,y) => (x.ordem||0)-(y.ordem||0));
      filhos.forEach(f => el.appendChild(renderItem(f, nivel + 1)));

      return el;
    }

    let rNum = 1;
    raizes.forEach(a => { lista.appendChild(renderItem(a, 0)); rNum++; });
    // Atualiza numeração visual
    updateNumeracao();
  }

  function updateNumeracao() {
    let r = 0;
    qsa('[data-edit-id]', lista).forEach(el => {
      const nivel = el.style.paddingLeft === '0px' || el.style.paddingLeft === '0' || !el.style.paddingLeft || el.dataset.parentId === '' ? 0 : 1;
      if (nivel === 0) r++;
      const numEl = el.querySelector('span[style*="color:var(--text-3)"]');
      if (numEl) numEl.textContent = r + '.';
    });
  }

  renderLista();
}

// ── ENDPOINT HELPER: reordenar-completo ──────────────────────────────────────
// Nota: este modal usa /api/assuntos/reordenar-completo (novo endpoint)
// que precisará ser adicionado ao server.js

// ── MODAL DISCIPLINA ──────────────────────────────────────────────────────────
function openDiscModal(id = null, onSave = null) {
  const bodyEl = document.getElementById('modal-body');
  const titleEl = document.getElementById('modal-title');
  titleEl.textContent = id ? 'Editar Disciplina' : 'Nova Disciplina';

  bodyEl.innerHTML = '';

  const form = document.createElement('div');

  function grupo(label, inputEl) {
    const g = document.createElement('div');
    g.className = 'form-group';
    const l = document.createElement('label');
    l.textContent = label;
    g.append(l, inputEl);
    return g;
  }

  const nomeInput = Object.assign(document.createElement('input'), { type: 'text', id: 'disc-nome', placeholder: 'Ex: Direito Tributário' });
  const teoriaInput = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Ex: PDF do Estratégia...' });
  const teoriaLinkInput = Object.assign(document.createElement('input'), { type: 'url', placeholder: 'https://...' });
  const resumoInput = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Ex: Mapa mental, Flashcards...' });
  const resumoDescInput = Object.assign(document.createElement('input'), { type: 'text', placeholder: 'Descrição do resumo' });
  const estrategiaInput = Object.assign(document.createElement('textarea'), { rows: 3, placeholder: 'Como você vai abordar esta disciplina...' });

  [nomeInput, teoriaInput, teoriaLinkInput, resumoInput, resumoDescInput, estrategiaInput].forEach(el => el.className = 'form-control');

  const sec = (titulo) => {
    const d = document.createElement('div');
    d.className = 'form-section-title';
    d.textContent = titulo;
    return d;
  };

  form.append(
    grupo('Nome *', nomeInput),
    sec('Estratégia'),
    grupo('Estratégia de estudo', estrategiaInput),
    sec('Material de Teoria'),
    grupo('Material', teoriaInput),
    grupo('Link (opcional)', teoriaLinkInput),
    sec('Material de Resumo'),
    grupo('Tipo', resumoInput),
    grupo('Descrição', resumoDescInput),
  );

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Salvar';
  saveBtn.addEventListener('click', async () => {
    const nome = nomeInput.value.trim();
    if (!nome) { showToast('Nome obrigatório', 'error'); return; }
    const payload = {
      nome,
      estrategia: estrategiaInput.value.trim(),
      teoria_material: teoriaInput.value.trim(),
      teoria_link: teoriaLinkInput.value.trim(),
      resumo_tipo: resumoInput.value.trim(),
      resumo_descricao: resumoDescInput.value.trim(),
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

  actions.append(cancelBtn, saveBtn);
  form.appendChild(actions);
  bodyEl.appendChild(form);

  if (id) {
    api.get('/api/disciplinas').then(discs => {
      const d = discs.find(x => x.id == id);
      if (!d) return;
      nomeInput.value = d.nome || '';
      estrategiaInput.value = d.estrategia || '';
      teoriaInput.value = d.teoria_material || '';
      teoriaLinkInput.value = d.teoria_link || '';
      resumoInput.value = d.resumo_tipo || '';
      resumoDescInput.value = d.resumo_descricao || '';
    });
  }

  nomeInput.focus();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openAssuntoModal(id, nome, discId, parentId, onSave) {
  const bodyEl = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = id ? 'Editar Assunto' : (parentId ? 'Novo Subassunto' : 'Novo Assunto');
  bodyEl.innerHTML = '';

  const form = document.createElement('div');
  const nomeInput = Object.assign(document.createElement('input'), { type: 'text', value: nome || '', className: 'form-control' });

  const g = document.createElement('div');
  g.className = 'form-group';
  const l = document.createElement('label');
  l.textContent = 'Nome *';
  g.append(l, nomeInput);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);

  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = 'Salvar';
  saveBtn.addEventListener('click', async () => {
    const nomeTxt = nomeInput.value.trim();
    if (!nomeTxt) { showToast('Nome obrigatório', 'error'); return; }
    if (id) {
      await api.put(`/api/assuntos/${id}`, { nome: nomeTxt });
    } else {
      await api.post('/api/assuntos', { nome: nomeTxt, disciplina_id: discId, parent_id: parentId || null });
    }
    closeModal();
    showToast('Assunto salvo!', 'success');
    if (onSave) onSave();
  });

  actions.append(cancelBtn, saveBtn);
  form.append(g, actions);
  bodyEl.appendChild(form);
  nomeInput.focus();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openImportarModal(discId, onSave) {
  const bodyEl = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = 'Importar Assuntos';
  bodyEl.innerHTML = '';

  const p = document.createElement('p');
  p.style.cssText = 'font-size:0.84rem;color:var(--text-2);margin-bottom:12px;';
  p.textContent = 'Cole o índice copiado do TechConcursos. O número vira hierarquia automaticamente.';

  const g = document.createElement('div');
  g.className = 'form-group';
  const l = document.createElement('label');
  l.textContent = 'Conteúdo';
  const ta = Object.assign(document.createElement('textarea'), {
    style: 'min-height:200px;font-family:monospace;font-size:0.8rem;',
    placeholder: '01\tContabilidade Básica\n01.01\tConceito e Objeto'
  });
  ta.className = 'form-control';
  g.append(l, ta);

  const actions = document.createElement('div');
  actions.className = 'form-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline';
  cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);

  const importBtn = document.createElement('button');
  importBtn.className = 'btn btn-primary';
  importBtn.textContent = 'Importar';
  importBtn.addEventListener('click', async () => {
    const texto = ta.value.trim();
    if (!texto) { showToast('Cole o conteúdo primeiro', 'error'); return; }
    await api.post('/api/assuntos/importar', { disciplina_id: discId, texto });
    closeModal();
    showToast('Assuntos importados!', 'success');
    if (onSave) onSave();
  });

  actions.append(cancelBtn, importBtn);

  const form = document.createElement('div');
  form.append(p, g, actions);
  bodyEl.appendChild(form);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// ── DISCIPLINA DETALHE PAGE ───────────────────────────────────────────────────
async function renderDisciplinaDetalhe(container, params = {}) {
  const discId = params.id;
  if (!discId) { window._app.navigate('disciplinas'); return; }

  container.innerHTML = `<div style="padding:40px;text-align:center;color:var(--text-3);font-size:0.9rem">Carregando...</div>`;

  const [discs, assuntos] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get(`/api/assuntos?disciplina_id=${discId}`)
  ]);
  const disc = discs.find(d => d.id == discId);
  if (!disc) { window._app.navigate('disciplinas'); return; }

  container.innerHTML = `
    <div class="page-header">
      <div>
        <button class="btn btn-outline btn-sm" id="btn-back-disc" style="margin-bottom:8px">← Disciplinas</button>
        <div class="page-title">${disc.nome}</div>
      </div>
      <button class="btn btn-outline btn-sm" id="btn-edit-disc">Editar</button>
    </div>
    <div id="disc-detalhe-body"></div>
  `;

  qs('#btn-back-disc', container).addEventListener('click', () => window._app.navigate('disciplinas'));
  qs('#btn-edit-disc', container).addEventListener('click', () => openDiscModal(discId, () => renderDisciplinaDetalhe(container, params)));

  const body = qs('#disc-detalhe-body', container);

  // Info grid
  const grid = document.createElement('div');
  grid.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px;';

  const reload = () => renderDisciplinaDetalhe(container, params);
  grid.appendChild(makeInfoCard('Estratégia', disc.estrategia, 'estrategia', 'textarea', discId, reload));

  const rightCol = document.createElement('div');
  rightCol.style.cssText = 'display:flex;flex-direction:column;gap:12px;';
  rightCol.appendChild(makeInfoCard('Material de Teoria', disc.teoria_material, 'teoria_material', 'text', discId, reload));
  rightCol.appendChild(makeInfoCard('Material de Resumo', disc.resumo_descricao || disc.resumo_tipo, 'resumo_descricao', 'text', discId, reload));
  grid.appendChild(rightCol);
  body.appendChild(grid);

  // Assuntos section
  const assuntosSection = document.createElement('div');
  assuntosSection.className = 'config-card';

  const assuntosHeader = document.createElement('div');
  assuntosHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;';

  const assuntosTitle = document.createElement('div');
  assuntosTitle.className = 'config-section-title';
  assuntosTitle.style.margin = '0';
  assuntosTitle.textContent = 'Assuntos';

  const editAssuntosBtn = document.createElement('button');
  editAssuntosBtn.className = 'btn btn-outline btn-sm';
  editAssuntosBtn.textContent = 'Editar assuntos';
  editAssuntosBtn.addEventListener('click', () => openEditarAssuntosModal(discId, assuntos, reload));

  assuntosHeader.append(assuntosTitle, editAssuntosBtn);
  assuntosSection.appendChild(assuntosHeader);

  if (!assuntos.length) {
    const empty = document.createElement('p');
    empty.className = 'text-muted text-small';
    empty.textContent = 'Nenhum assunto cadastrado.';
    assuntosSection.appendChild(empty);
  } else {
    assuntosSection.appendChild(buildAssuntoAccordion(assuntos));
  }

  body.appendChild(assuntosSection);
}
