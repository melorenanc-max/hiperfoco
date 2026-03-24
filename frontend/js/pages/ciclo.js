// ── CICLO SEMANAL ─────────────────────────────────────────────────────────────

async function renderCiclo(container) {
  const [disciplinas, concursos, bancas] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get('/api/concursos'),
    api.get('/api/bancas'),
  ]);

  let semanaAtual = getCurrentWeekMonday();
  let modoVista = 'lista'; // 'lista' | 'dia'
  let cicloData = null;

  container.innerHTML = '';

  // ── HEADER ───────────────────────────────────────────────────────────────────
  const pageHeader = document.createElement('div');
  pageHeader.className = 'page-header';
  pageHeader.style.alignItems = 'flex-start';

  const headerLeft = document.createElement('div');
  const title = document.createElement('div');
  title.className = 'page-title';
  title.textContent = 'Ciclo Semanal';
  const subtitle = document.createElement('div');
  subtitle.className = 'page-subtitle';
  subtitle.textContent = 'Organize seus estudos por semana';
  headerLeft.append(title, subtitle);

  const headerRight = document.createElement('div');
  headerRight.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;align-items:center;';

  // Toggle Lista / Por Dia
  const modoWrap = document.createElement('div');
  modoWrap.className = 'modo-toggle';
  const btnListaMode = document.createElement('button');
  btnListaMode.className = 'modo-toggle-btn active';
  btnListaMode.textContent = 'Lista';
  const btnDiaMode = document.createElement('button');
  btnDiaMode.className = 'modo-toggle-btn';
  btnDiaMode.textContent = 'Por Dia';
  modoWrap.append(btnListaMode, btnDiaMode);

  btnListaMode.addEventListener('click', () => {
    modoVista = 'lista';
    btnListaMode.classList.add('active');
    btnDiaMode.classList.remove('active');
    renderBody();
  });
  btnDiaMode.addEventListener('click', () => {
    modoVista = 'dia';
    btnDiaMode.classList.add('active');
    btnListaMode.classList.remove('active');
    renderBody();
  });

  const btnDuplicar = document.createElement('button');
  btnDuplicar.className = 'btn btn-outline btn-sm';
  btnDuplicar.textContent = '⎘ Duplicar';
  btnDuplicar.addEventListener('click', () => openDuplicarModal());

  const btnConfig = document.createElement('button');
  btnConfig.className = 'btn btn-outline btn-sm';
  btnConfig.textContent = '⚙ Configurar';
  btnConfig.addEventListener('click', () => openConfigModal());

  const btnVirada = document.createElement('button');
  btnVirada.className = 'btn btn-outline btn-sm';
  btnVirada.textContent = '↻ Virada';
  btnVirada.addEventListener('click', () => openViradaModal());

  headerRight.append(modoWrap, btnDuplicar, btnConfig, btnVirada);
  pageHeader.append(headerLeft, headerRight);
  container.appendChild(pageHeader);

  // ── NAV SEMANA ───────────────────────────────────────────────────────────────
  const nav = document.createElement('div');
  nav.className = 'ciclo-semana-nav';
  const btnPrev = document.createElement('button');
  btnPrev.className = 'btn btn-outline btn-sm';
  btnPrev.textContent = '◀ Anterior';
  const semLabel = document.createElement('div');
  semLabel.className = 'ciclo-semana-label';
  const btnNext = document.createElement('button');
  btnNext.className = 'btn btn-outline btn-sm';
  btnNext.textContent = 'Próxima ▶';
  const btnHoje = document.createElement('button');
  btnHoje.className = 'btn btn-outline btn-sm';
  btnHoje.textContent = 'Hoje';
  nav.append(btnPrev, semLabel, btnNext, btnHoje);
  container.appendChild(nav);

  btnPrev.addEventListener('click', () => { semanaAtual = prevWeek(semanaAtual); updateNavLabel(); load(); });
  btnNext.addEventListener('click', () => { semanaAtual = nextWeek(semanaAtual); updateNavLabel(); load(); });
  btnHoje.addEventListener('click', () => { semanaAtual = getCurrentWeekMonday(); updateNavLabel(); load(); });

  function updateNavLabel() {
    const sunday = getSundayOf(semanaAtual);
    const semNum = getWeekNumber(new Date(semanaAtual + 'T00:00:00'));
    semLabel.innerHTML = `Semana ${semNum} &nbsp;·&nbsp; ${formatDate(semanaAtual)} – ${formatDate(sunday)}`;
  }

  // ── STATS ────────────────────────────────────────────────────────────────────
  const statsRow = document.createElement('div');
  statsRow.className = 'ciclo-stats-row';
  container.appendChild(statsRow);

  // ── BODY ─────────────────────────────────────────────────────────────────────
  const bodyEl = document.createElement('div');
  bodyEl.id = 'ciclo-body';
  container.appendChild(bodyEl);

  // ── FAB ──────────────────────────────────────────────────────────────────────
  const fab = document.createElement('button');
  fab.className = 'ciclo-fab';
  fab.title = 'Registrar estudo avulso';
  fab.innerHTML = `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`;
  fab.addEventListener('click', () => openRegistroAvulsoModal());
  container.appendChild(fab);

  // ── LOAD ─────────────────────────────────────────────────────────────────────
  async function load() {
    cicloData = await api.get(`/api/ciclo?semana=${semanaAtual}`);
    renderStats(cicloData);
    renderBody();
  }

  function renderStats(data) {
    const total = data.itens.length;
    const feitos = data.itens.filter(i => i.realizado).length;
    const adiados = data.itens.filter(i => i.adiado).length;
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;
    statsRow.innerHTML = '';
    [
      { val: total, label: 'Planejadas' },
      { val: feitos, label: 'Realizadas', color: 'var(--green)' },
      { val: adiados, label: 'Adiadas', color: 'var(--yellow)' },
      { val: pct + '%', label: 'Cumprimento' },
    ].forEach(s => {
      const card = document.createElement('div');
      card.className = 'ciclo-stat-card';
      const v = document.createElement('div');
      v.className = 'ciclo-stat-val';
      if (s.color) v.style.color = s.color;
      v.textContent = s.val;
      const l = document.createElement('div');
      l.className = 'ciclo-stat-label';
      l.textContent = s.label;
      card.append(v, l);
      statsRow.appendChild(card);
    });
  }

  function renderBody() {
    if (!cicloData) return;
    bodyEl.innerHTML = '';
    if (modoVista === 'lista') renderLista(cicloData);
    else renderPorDia(cicloData);
  }

  // ── MODO LISTA ───────────────────────────────────────────────────────────────
  function renderLista(data) {
    const acc = document.createElement('div');
    acc.className = 'ciclo-accordion-list';
    bodyEl.appendChild(acc);

    const hoje = todayISO();
    const dates = getWeekDates(semanaAtual);

    const atrasados = data.itens.filter(i => {
      if (i.realizado) return false;
      const d = i.dia_semana !== null && i.dia_semana !== undefined ? dates[i.dia_semana] : null;
      return d && d < hoje;
    });
    if (atrasados.length) {
      acc.appendChild(buildDayAccordion('⚠ Atrasadas', null, atrasados, true, true));
    }

    DIAS_SEMANA.forEach((nome, idx) => {
      const dateISO = dates[idx];
      const isHoje = dateISO === hoje;
      const sessoes = data.itens.filter(i => i.dia_semana === idx);
      acc.appendChild(buildDayAccordion(nome, dateISO, sessoes, isHoje, false));
    });

    const semDia = data.itens.filter(i => i.dia_semana === null || i.dia_semana === undefined);
    if (semDia.length) {
      acc.appendChild(buildDayAccordion('Sem dia definido', null, semDia, false, false));
    }
  }

  // ── MODO POR DIA ─────────────────────────────────────────────────────────────
  function renderPorDia(data) {
    const hoje = todayISO();
    const dates = getWeekDates(semanaAtual);

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px;';
    bodyEl.appendChild(wrap);

    DIAS_SEMANA.forEach((nome, idx) => {
      const dateISO = dates[idx];
      const isHoje = dateISO === hoje;
      const sessoes = data.itens.filter(i => i.dia_semana === idx);
      const feitas = sessoes.filter(i => i.realizado).length;

      const card = document.createElement('div');
      card.className = 'ciclo-dia-card' + (isHoje ? ' ciclo-dia-card-hoje' : '');

      const dh = document.createElement('div');
      dh.className = 'ciclo-dia-card-header';

      const dLeft = document.createElement('div');
      const dTitle = document.createElement('div');
      dTitle.className = 'ciclo-dia-card-title';
      dTitle.textContent = nome + (isHoje ? ' — hoje' : '');
      const dDate = document.createElement('div');
      dDate.className = 'ciclo-dia-card-date';
      dDate.textContent = formatDate(dateISO);
      dLeft.append(dTitle, dDate);

      const dCount = document.createElement('div');
      dCount.className = 'ciclo-dia-card-count';
      dCount.textContent = `${feitas}/${sessoes.length}`;
      dh.append(dLeft, dCount);
      card.appendChild(dh);

      if (sessoes.length > 0) {
        const taskList = document.createElement('div');
        taskList.style.cssText = 'padding:6px 10px 10px;';
        sessoes.forEach(item => taskList.appendChild(buildCicloTaskCard(item)));
        card.appendChild(taskList);
      } else {
        const empty = document.createElement('div');
        empty.className = 'text-muted text-small';
        empty.style.cssText = 'padding:10px 14px;';
        empty.textContent = 'Nenhuma tarefa.';
        card.appendChild(empty);
      }

      // Drag & drop
      card.addEventListener('dragover', e => { e.preventDefault(); card.style.borderColor = 'var(--primary)'; });
      card.addEventListener('dragleave', () => { card.style.borderColor = ''; });
      card.addEventListener('drop', async e => {
        e.preventDefault();
        card.style.borderColor = '';
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        await api.put(`/api/ciclo/item/${itemId}`, { dia_semana: idx });
        load();
      });

      wrap.appendChild(card);
    });
  }

  function buildDayAccordion(nome, dateISO, sessoes, isHoje, isAtraso) {
    const hoje = todayISO();
    const isPast = dateISO && dateISO < hoje && !isHoje;
    const feitas = sessoes.filter(i => i.realizado).length;
    const total = sessoes.length;
    const startOpen = isHoje || isAtraso;

    const card = document.createElement('div');
    card.className = 'ciclo-acc-card' + (isHoje ? ' ciclo-acc-hoje' : '');
    if (startOpen) card.classList.add('open');

    const header = document.createElement('div');
    header.className = 'ciclo-acc-header';

    const left = document.createElement('div');
    left.className = 'ciclo-acc-header-left';

    const titleEl = document.createElement('div');
    titleEl.className = 'ciclo-acc-title' + (isHoje ? ' ciclo-acc-title-hoje' : '');
    if (isAtraso) titleEl.style.color = 'var(--red)';
    titleEl.textContent = nome;
    if (isHoje) {
      const badge = document.createElement('span');
      badge.className = 'ciclo-hoje-badge';
      badge.textContent = 'hoje';
      titleEl.appendChild(badge);
    }

    const subEl = document.createElement('div');
    subEl.className = 'ciclo-acc-sub';
    subEl.textContent = dateISO
      ? `${formatDate(dateISO)}${total > 0 ? ` · ${total} tarefa${total !== 1 ? 's' : ''}` : ''}`
      : `${total} tarefa${total !== 1 ? 's' : ''}`;

    left.append(titleEl, subEl);

    const right = document.createElement('div');
    right.className = 'ciclo-acc-right';

    let countEl;
    if (total === 0) {
      countEl = document.createElement('span');
      countEl.className = 'ciclo-acc-count ciclo-acc-count-empty';
      countEl.textContent = '—';
    } else if (isPast || isHoje || isAtraso) {
      const cor = feitas === total ? 'green' : feitas > 0 ? 'yellow' : 'red';
      countEl = document.createElement('span');
      countEl.className = `ciclo-acc-count ciclo-acc-count-${cor}`;
      countEl.textContent = `${feitas}/${total}`;
    } else {
      countEl = document.createElement('span');
      countEl.className = 'ciclo-acc-count ciclo-acc-count-empty';
      countEl.textContent = total;
    }

    const chevron = document.createElement('span');
    chevron.className = 'ciclo-acc-chevron';
    chevron.textContent = startOpen ? '▼' : '▶';

    right.append(countEl, chevron);
    header.append(left, right);
    card.appendChild(header);

    const bodyDiv = document.createElement('div');
    bodyDiv.className = 'ciclo-acc-body' + (startOpen ? '' : ' hidden');

    if (total > 0) {
      const taskList = document.createElement('div');
      taskList.style.cssText = 'padding:6px 8px 8px;';
      sessoes.forEach(item => taskList.appendChild(buildCicloTaskCard(item)));
      bodyDiv.appendChild(taskList);
    } else {
      const empty = document.createElement('div');
      empty.className = 'text-muted text-small';
      empty.style.cssText = 'padding:12px 16px;';
      empty.textContent = 'Nenhuma tarefa para este dia.';
      bodyDiv.appendChild(empty);
    }

    card.appendChild(bodyDiv);

    header.addEventListener('click', e => {
      if (e.target.closest('button')) return;
      const isOpen = !bodyDiv.classList.contains('hidden');
      bodyDiv.classList.toggle('hidden', isOpen);
      chevron.textContent = isOpen ? '▶' : '▼';
      card.classList.toggle('open', !isOpen);
    });

    // Drag & drop
    card.addEventListener('dragover', e => { e.preventDefault(); card.style.borderColor = 'var(--primary)'; });
    card.addEventListener('dragleave', () => { card.style.borderColor = ''; });
    card.addEventListener('drop', async e => {
      e.preventDefault();
      card.style.borderColor = '';
      const itemId = e.dataTransfer.getData('text/plain');
      if (!itemId) return;
      const dates = getWeekDates(semanaAtual);
      const diaIdx = dateISO ? dates.indexOf(dateISO) : null;
      await api.put(`/api/ciclo/item/${itemId}`, { dia_semana: diaIdx >= 0 ? diaIdx : null });
      load();
    });

    return card;
  }

  function buildCicloTaskCard(item) {
    const card = buildTaskCard(item, {
      mode: 'ciclo',
      draggable: !item.realizado,
      onCheck: () => openConcluirModal(item),
      onEdit: () => openEditarItemCicloModal(item),
      onDelete: async () => {
        if (!confirm('Remover do ciclo?')) return;
        await fetch(`/api/ciclo/item/${item.id}`, { method: 'DELETE' });
        load();
      },
    });

    if (!item.realizado) {
      card.setAttribute('draggable', 'true');
      card.addEventListener('dragstart', e => e.dataTransfer.setData('text/plain', String(item.id)));
    }

    const actions = card.querySelector('.task-card-actions');

    if (item.realizado) {
      const btnUndo = document.createElement('button');
      btnUndo.className = 'task-action-btn';
      btnUndo.title = 'Desmarcar como feito';
      btnUndo.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.58"/></svg>`;
      btnUndo.addEventListener('click', e => {
        e.stopPropagation();
        api.put(`/api/ciclo/item/${item.id}`, { realizado: false }).then(() => { showToast('Desmarcado'); load(); });
      });
      if (actions) actions.insertBefore(btnUndo, actions.firstChild);
    } else if (item.adiado) {
      const badge = document.createElement('span');
      badge.style.cssText = 'font-size:0.68rem;color:var(--yellow);font-weight:600;padding:1px 6px;background:var(--yellow-bg);border-radius:4px;';
      badge.textContent = 'adiado';
      const linha1 = card.querySelector('.task-card-linha1');
      if (linha1) linha1.appendChild(badge);

      const btnReativar = document.createElement('button');
      btnReativar.className = 'task-action-btn';
      btnReativar.title = 'Reativar';
      btnReativar.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-3.58"/></svg>`;
      btnReativar.addEventListener('click', e => {
        e.stopPropagation();
        api.put(`/api/ciclo/item/${item.id}`, { adiado: false }).then(() => { showToast('Reativado'); load(); });
      });
      if (actions) actions.insertBefore(btnReativar, actions.firstChild);
    } else {
      const btnAdiar = document.createElement('button');
      btnAdiar.className = 'task-action-btn';
      btnAdiar.title = 'Adiar';
      btnAdiar.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`;
      btnAdiar.addEventListener('click', e => {
        e.stopPropagation();
        api.put(`/api/ciclo/item/${item.id}`, { adiado: true }).then(() => { showToast('Adiado'); load(); });
      });
      if (actions) actions.insertBefore(btnAdiar, actions.firstChild);
    }

    return card;
  }

  // ── MODAL CONCLUIR TAREFA ─────────────────────────────────────────────────────
  function openConcluirModal(item) {
    const isQuestoes = !item.tipo || item.tipo === 'questoes';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.maxWidth = '500px';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = `Concluir: ${item.disciplina_nome}`;
    box.appendChild(h2);

    if (item.tipo) {
      const info = document.createElement('p');
      info.style.cssText = 'font-size:0.82rem;color:var(--text-2);margin-bottom:14px;';
      info.textContent = `${item.tipo}${item.tempo_estimado ? ' · ' + formatTempo(item.tempo_estimado) + ' estimados' : ''}`;
      box.appendChild(info);
    }

    // Tempo gasto
    const gr1 = document.createElement('div');
    gr1.className = 'form-row';

    const gTempo = document.createElement('div');
    gTempo.className = 'form-group';
    const lTempo = document.createElement('label');
    lTempo.textContent = 'Tempo gasto (min)';
    const iTempo = document.createElement('input');
    iTempo.type = 'number';
    iTempo.value = item.tempo_estimado || 60;
    iTempo.min = '0';
    iTempo.step = '5';
    gTempo.append(lTempo, iTempo);
    gr1.appendChild(gTempo);

    if (isQuestoes) {
      const gQF = document.createElement('div');
      gQF.className = 'form-group';
      const lQF = document.createElement('label');
      lQF.textContent = 'Questões feitas';
      const iQF = document.createElement('input');
      iQF.type = 'number';
      iQF.id = 'cc-qfeitas';
      iQF.value = item.quantidade_questoes || 0;
      iQF.min = '0';
      gQF.append(lQF, iQF);
      gr1.appendChild(gQF);
    }
    box.appendChild(gr1);

    let iQF, iQA, sBanca;
    if (isQuestoes) {
      iQF = box.querySelector('#cc-qfeitas');

      const gr2 = document.createElement('div');
      gr2.className = 'form-row';

      const gQA = document.createElement('div');
      gQA.className = 'form-group';
      const lQA = document.createElement('label');
      lQA.textContent = 'Acertadas';
      iQA = document.createElement('input');
      iQA.type = 'number';
      iQA.value = '0';
      iQA.min = '0';
      const pctDiv = document.createElement('div');
      pctDiv.className = 'text-small text-muted';
      gQA.append(lQA, iQA, pctDiv);
      gr2.appendChild(gQA);

      const gBanca = document.createElement('div');
      gBanca.className = 'form-group';
      const lBanca = document.createElement('label');
      lBanca.textContent = 'Banca';
      sBanca = document.createElement('select');
      const optNone = document.createElement('option');
      optNone.value = '';
      optNone.textContent = '—';
      sBanca.appendChild(optNone);
      bancas.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b.nome;
        opt.textContent = b.nome;
        sBanca.appendChild(opt);
      });
      gBanca.append(lBanca, sBanca);
      gr2.appendChild(gBanca);
      box.appendChild(gr2);

      function updatePct() {
        const q = parseInt(iQF.value) || 0;
        const a = parseInt(iQA.value) || 0;
        pctDiv.textContent = q > 0 ? `Erros: ${Math.max(0, q - a)} · Acerto: ${((a / q) * 100).toFixed(1)}%` : '';
      }
      iQF.addEventListener('input', updatePct);
      iQA.addEventListener('input', updatePct);
    }

    // Como foi
    const gCF = document.createElement('div');
    gCF.className = 'form-group';
    const lCF = document.createElement('label');
    lCF.textContent = 'Como foi? *';
    const tCF = document.createElement('textarea');
    tCF.placeholder = 'Breve relato, dificuldades, insights...';
    tCF.style.minHeight = '80px';
    gCF.append(lCF, tCF);
    box.appendChild(gCF);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', () => modal.remove());
    const btnSalvar = document.createElement('button');
    btnSalvar.className = 'btn btn-primary';
    btnSalvar.textContent = 'Confirmar ✓';
    btnSalvar.addEventListener('click', async () => {
      const comoFoi = tCF.value.trim();
      if (!comoFoi) { showToast('Descreva como foi o estudo', 'error'); tCF.focus(); return; }
      const concursoAlvoId = await getConcursoIdDoPlanoAtivo();
      await api.post('/api/sessoes', {
        data: todayISO(),
        disciplina_id: item.disciplina_id,
        concurso_id: concursoAlvoId || null,
        tipo: item.tipo || 'questoes',
        questoes_feitas: iQF ? (parseInt(iQF.value) || 0) : 0,
        questoes_acertadas: iQA ? (parseInt(iQA.value) || 0) : 0,
        tempo_gasto: parseInt(iTempo.value) || 0,
        como_foi: comoFoi,
        banca: sBanca ? sBanca.value : '',
        assunto_ids: item.assuntos ? item.assuntos.map(a => a.id) : [],
        ciclo_item_id: item.id,
      });
      await api.put(`/api/ciclo/item/${item.id}`, { realizado: true });
      modal.remove();
      showToast('Estudo registrado!', 'success');
      load();
    });
    actions.append(btnCancel, btnSalvar);
    box.appendChild(actions);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── MODAL EDITAR ITEM CICLO ───────────────────────────────────────────────────
  function openEditarItemCicloModal(item) {
    const assuntosIds = item.assuntos ? item.assuntos.map(a => a.id) : [];
    const msId = 'edit-ciclo-ms';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = 'Editar Item do Ciclo';
    box.appendChild(h2);

    const gAss = document.createElement('div');
    gAss.className = 'form-group';
    const lAss = document.createElement('label');
    lAss.textContent = 'Assuntos';
    const assWrap = document.createElement('div');
    assWrap.textContent = 'Carregando...';
    gAss.append(lAss, assWrap);
    box.appendChild(gAss);

    api.get(`/api/assuntos?disciplina_id=${item.disciplina_id}`).then(assuntos => {
      const { html } = buildAssuntosMultiSelect(assuntos, assuntosIds, msId);
      assWrap.innerHTML = html;
      assWrap.addEventListener('change', () => updateMultiSelectLabel(msId, assuntos));
      setTimeout(() => updateMultiSelectLabel(msId, assuntos), 50);
    });

    const gr1 = document.createElement('div');
    gr1.className = 'form-row';

    const gDia = document.createElement('div');
    gDia.className = 'form-group';
    const lDia = document.createElement('label');
    lDia.textContent = 'Dia da semana';
    const sDia = document.createElement('select');
    const optSemDia = document.createElement('option');
    optSemDia.value = '';
    optSemDia.textContent = 'Sem dia';
    sDia.appendChild(optSemDia);
    DIAS_SEMANA.forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = i;
      opt.textContent = d;
      if (item.dia_semana === i) opt.selected = true;
      sDia.appendChild(opt);
    });
    gDia.append(lDia, sDia);
    gr1.appendChild(gDia);

    const gTipo = document.createElement('div');
    gTipo.className = 'form-group';
    const lTipo = document.createElement('label');
    lTipo.textContent = 'Tipo';
    const sTipo = document.createElement('select');
    [['', '—'], ['questoes', 'Questões'], ['teoria', 'Teoria'], ['revisao', 'Revisão'], ['simulado', 'Simulado']].forEach(([v, t]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = t;
      if ((item.tipo || '') === v) opt.selected = true;
      sTipo.appendChild(opt);
    });
    gTipo.append(lTipo, sTipo);
    gr1.appendChild(gTipo);
    box.appendChild(gr1);

    const gr2 = document.createElement('div');
    gr2.className = 'form-row';

    const gTempo = document.createElement('div');
    gTempo.className = 'form-group';
    const lTempo = document.createElement('label');
    lTempo.textContent = 'Tempo estimado (min)';
    const iTempo = document.createElement('input');
    iTempo.type = 'number';
    iTempo.value = item.tempo_estimado || 60;
    iTempo.min = '15';
    iTempo.step = '15';
    gTempo.append(lTempo, iTempo);
    gr2.appendChild(gTempo);

    const gQQ = document.createElement('div');
    gQQ.className = 'form-group';
    const lQQ = document.createElement('label');
    lQQ.textContent = 'Qtd. questões';
    const iQQ = document.createElement('input');
    iQQ.type = 'number';
    iQQ.value = item.quantidade_questoes || 0;
    iQQ.min = '0';
    gQQ.append(lQQ, iQQ);
    gr2.appendChild(gQQ);
    box.appendChild(gr2);

    const gDesc = document.createElement('div');
    gDesc.className = 'form-group';
    const lDesc = document.createElement('label');
    lDesc.textContent = 'Descrição';
    const iDesc = document.createElement('input');
    iDesc.type = 'text';
    iDesc.value = item.descricao || '';
    gDesc.append(lDesc, iDesc);
    box.appendChild(gDesc);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', () => modal.remove());
    const btnSalvar = document.createElement('button');
    btnSalvar.className = 'btn btn-primary';
    btnSalvar.textContent = 'Salvar';
    btnSalvar.addEventListener('click', async () => {
      const dia = sDia.value;
      const assunto_ids = getMultiSelectValues(msId);
      await api.put(`/api/ciclo/item/${item.id}`, {
        dia_semana: dia !== '' ? parseInt(dia) : null,
        assunto_ids,
        tipo: sTipo.value,
        tempo_estimado: parseInt(iTempo.value) || 60,
        quantidade_questoes: parseInt(iQQ.value) || 0,
        descricao: iDesc.value.trim(),
      });
      modal.remove();
      showToast('Salvo!', 'success');
      load();
    });
    actions.append(btnCancel, btnSalvar);
    box.appendChild(actions);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── MODAL CONFIGURAR CICLO (3 etapas) ────────────────────────────────────────
  async function openConfigModal() {
    let cfg = {};
    try { cfg = await api.get('/api/ciclo/config-global'); } catch(e) {}
    const diasEstudo = cfg.dias_estudo ? JSON.parse(cfg.dias_estudo) : [1, 2, 3, 4, 5];
    const horasSemana = cfg.horas_semana || 20;
    const duracaoCiclo = cfg.duracao_ciclo || 7;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.maxWidth = '560px';

    const stepWrap = document.createElement('div');
    stepWrap.className = 'ciclo-cfg-steps';
    ['1 Configurações', '2 Disciplinas', '3 Gerar Ciclo'].forEach((label, idx) => {
      const s = document.createElement('div');
      s.className = 'ciclo-cfg-step' + (idx === 0 ? ' active' : '');
      s.dataset.step = idx + 1;
      s.textContent = label;
      stepWrap.appendChild(s);
    });
    box.appendChild(stepWrap);

    const stepBody = document.createElement('div');
    stepBody.style.cssText = 'min-height:200px;margin-bottom:8px;';
    box.appendChild(stepBody);

    const stepActions = document.createElement('div');
    stepActions.className = 'form-actions';
    box.appendChild(stepActions);

    const discConfigs = {};
    disciplinas.forEach(d => { discConfigs[d.id] = { sessoes: 0 }; });

    let currentStep = 1;

    function setStep(n) {
      currentStep = n;
      qsa('.ciclo-cfg-step', box).forEach(s => s.classList.toggle('active', parseInt(s.dataset.step) === n));
      stepBody.innerHTML = '';
      stepActions.innerHTML = '';
      if (n === 1) renderStep1();
      else if (n === 2) renderStep2();
      else renderStep3();
    }

    function renderStep1() {
      const gHoras = document.createElement('div');
      gHoras.className = 'form-group';
      const lHoras = document.createElement('label');
      lHoras.textContent = 'Horas de estudo por semana';
      const iHoras = document.createElement('input');
      iHoras.type = 'number';
      iHoras.id = 'cfg-horas';
      iHoras.value = horasSemana;
      iHoras.min = '1';
      iHoras.max = '80';
      gHoras.append(lHoras, iHoras);
      stepBody.appendChild(gHoras);

      const gDias = document.createElement('div');
      gDias.className = 'form-group';
      const lDias = document.createElement('label');
      lDias.textContent = 'Dias de estudo';
      gDias.appendChild(lDias);
      const diasWrap = document.createElement('div');
      diasWrap.style.cssText = 'display:flex;gap:10px;flex-wrap:wrap;margin-top:6px;';
      DIAS_SEMANA.forEach((nome, idx) => {
        const label = document.createElement('label');
        label.style.cssText = 'display:flex;align-items:center;gap:4px;font-size:0.84rem;cursor:pointer;padding:4px 8px;border:1px solid var(--border);border-radius:var(--radius-sm);';
        const cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.value = idx;
        cb.id = `cfg-dia-${idx}`;
        cb.checked = diasEstudo.includes(idx);
        label.append(cb, nome.substring(0, 3));
        diasWrap.appendChild(label);
      });
      gDias.appendChild(diasWrap);
      stepBody.appendChild(gDias);

      const gDur = document.createElement('div');
      gDur.className = 'form-group';
      const lDur = document.createElement('label');
      lDur.textContent = 'Duração do ciclo';
      const sDur = document.createElement('select');
      sDur.id = 'cfg-dur';
      [[7, '7 dias (1 semana)'], [14, '14 dias (2 semanas)'], [21, '21 dias (3 semanas)']].forEach(([d, t]) => {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = t;
        if (d === duracaoCiclo) opt.selected = true;
        sDur.appendChild(opt);
      });
      gDur.append(lDur, sDur);
      stepBody.appendChild(gDur);

      const btnCancel = document.createElement('button');
      btnCancel.className = 'btn btn-outline';
      btnCancel.textContent = 'Cancelar';
      btnCancel.addEventListener('click', () => modal.remove());
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn-primary';
      btnNext.textContent = 'Próximo →';
      btnNext.addEventListener('click', async () => {
        const horas = parseFloat(document.getElementById('cfg-horas')?.value) || 20;
        const dias = Array.from(stepBody.querySelectorAll('input[type="checkbox"]')).filter(c => c.checked).map(c => parseInt(c.value));
        const dur = parseInt(document.getElementById('cfg-dur')?.value) || 7;
        try {
          await api.put('/api/ciclo/config-global', { horas_semana: horas, dias_estudo: JSON.stringify(dias), duracao_ciclo: dur });
        } catch(e) {}
        setStep(2);
      });
      stepActions.append(btnCancel, btnNext);
    }

    function renderStep2() {
      const info = document.createElement('p');
      info.style.cssText = 'font-size:0.84rem;color:var(--text-2);margin-bottom:14px;';
      info.textContent = 'Configure quantas sessões de cada disciplina por semana.';
      stepBody.appendChild(info);

      disciplinas.forEach(d => {
        const row = document.createElement('div');
        row.style.cssText = 'display:flex;align-items:center;gap:12px;padding:9px 0;border-bottom:1px solid var(--border);';
        const nome = document.createElement('span');
        nome.style.cssText = 'flex:1;font-size:0.88rem;font-weight:500;';
        nome.textContent = d.nome;
        const lSess = document.createElement('label');
        lSess.style.cssText = 'font-size:0.78rem;color:var(--text-3);white-space:nowrap;';
        lSess.textContent = 'Sessões/sem.';
        const input = document.createElement('input');
        input.type = 'number';
        input.min = '0';
        input.max = '14';
        input.value = discConfigs[d.id]?.sessoes || 0;
        input.style.cssText = 'width:56px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 8px;text-align:center;font-weight:700;font-family:var(--font-display);';
        input.addEventListener('input', () => { discConfigs[d.id] = { sessoes: parseInt(input.value) || 0 }; });
        row.append(nome, lSess, input);
        stepBody.appendChild(row);
      });

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn-outline';
      btnBack.textContent = '← Voltar';
      btnBack.addEventListener('click', () => setStep(1));
      const btnNext = document.createElement('button');
      btnNext.className = 'btn btn-primary';
      btnNext.textContent = 'Próximo →';
      btnNext.addEventListener('click', () => setStep(3));
      stepActions.append(btnBack, btnNext);
    }

    function renderStep3() {
      const sessoes = [];
      disciplinas.forEach(d => {
        const c = discConfigs[d.id] || { sessoes: 0 };
        for (let i = 0; i < (c.sessoes || 0); i++) sessoes.push({ disciplina_id: d.id });
      });
      const total = sessoes.length;

      const summary = document.createElement('div');
      summary.style.cssText = 'background:var(--bg);border-radius:var(--radius-sm);padding:14px;margin-bottom:14px;';

      const sumTitle = document.createElement('div');
      sumTitle.style.cssText = 'font-size:0.84rem;font-weight:600;margin-bottom:8px;font-family:var(--font-display);';
      sumTitle.textContent = 'Resumo do ciclo';
      summary.appendChild(sumTitle);

      const sumTotal = document.createElement('div');
      sumTotal.style.cssText = 'font-size:0.84rem;color:var(--text-2);margin-bottom:6px;';
      sumTotal.textContent = `${total} tarefa${total !== 1 ? 's' : ''} no total`;
      summary.appendChild(sumTotal);

      const sumDiscs = document.createElement('div');
      sumDiscs.style.cssText = 'font-size:0.82rem;color:var(--text-3);display:flex;flex-wrap:wrap;gap:6px;';
      disciplinas.forEach(d => {
        const c = discConfigs[d.id] || { sessoes: 0 };
        if (c.sessoes > 0) {
          const tag = document.createElement('span');
          tag.style.cssText = 'background:var(--primary-bg);color:var(--primary);padding:2px 8px;border-radius:4px;';
          tag.textContent = `${d.nome}: ${c.sessoes}×`;
          sumDiscs.appendChild(tag);
        }
      });
      summary.appendChild(sumDiscs);
      stepBody.appendChild(summary);

      const warn = document.createElement('p');
      warn.style.cssText = 'font-size:0.82rem;color:var(--yellow);background:var(--yellow-bg);padding:8px 12px;border-radius:var(--radius-sm);margin-bottom:8px;';
      warn.textContent = 'Atenção: gerar um novo ciclo substituirá as tarefas da semana atual.';
      stepBody.appendChild(warn);

      const btnBack = document.createElement('button');
      btnBack.className = 'btn btn-outline';
      btnBack.textContent = '← Voltar';
      btnBack.addEventListener('click', () => setStep(2));
      const btnGerar = document.createElement('button');
      btnGerar.className = 'btn btn-primary';
      btnGerar.textContent = 'Gerar Ciclo';
      btnGerar.addEventListener('click', async () => {
        if (!sessoes.length) { showToast('Configure ao menos uma sessão', 'error'); return; }
        await api.post('/api/ciclo/gerar', { semana: semanaAtual, sessoes });
        modal.remove();
        showToast('Ciclo gerado!', 'success');
        load();
      });
      stepActions.append(btnBack, btnGerar);
    }

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
    setStep(1);
  }

  // ── MODAL DUPLICAR ────────────────────────────────────────────────────────────
  function openDuplicarModal() {
    const proxSemana = nextWeek(semanaAtual);

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = 'Duplicar Ciclo';
    box.appendChild(h2);

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:0.84rem;color:var(--text-2);margin-bottom:14px;';
    desc.textContent = 'Duplica o ciclo atual para outra semana (mantém disciplinas e assuntos, reseta progresso).';
    box.appendChild(desc);

    const gDest = document.createElement('div');
    gDest.className = 'form-group';
    const lDest = document.createElement('label');
    lDest.textContent = 'Semana de destino';
    const iDest = document.createElement('input');
    iDest.type = 'date';
    iDest.value = proxSemana;
    const labelDest = document.createElement('div');
    labelDest.className = 'text-small text-muted';
    labelDest.style.marginTop = '4px';

    function updateLabel() {
      if (!iDest.value) return;
      const monday = getMondayOf(new Date(iDest.value + 'T00:00:00')).toISOString().slice(0, 10);
      const sunday = getSundayOf(monday);
      const semNum = getWeekNumber(new Date(monday + 'T00:00:00'));
      labelDest.innerHTML = `Sem. ${semNum} · ${formatDate(monday)} – ${formatDate(sunday)}`;
    }
    iDest.addEventListener('change', updateLabel);
    updateLabel();

    gDest.append(lDest, iDest, labelDest);
    box.appendChild(gDest);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', () => modal.remove());
    const btnDup = document.createElement('button');
    btnDup.className = 'btn btn-primary';
    btnDup.textContent = 'Duplicar';
    btnDup.addEventListener('click', async () => {
      if (!iDest.value) { showToast('Selecione uma data', 'error'); return; }
      const semana_destino = getMondayOf(new Date(iDest.value + 'T00:00:00')).toISOString().slice(0, 10);
      await api.post('/api/ciclo/duplicar', { semana_origem: semanaAtual, semana_destino });
      modal.remove();
      showToast('Ciclo duplicado!', 'success');
      semanaAtual = semana_destino;
      updateNavLabel();
      load();
    });
    actions.append(btnCancel, btnDup);
    box.appendChild(actions);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── MODAL VIRADA DE CICLO ─────────────────────────────────────────────────────
  async function openViradaModal() {
    const data = cicloData || await api.get(`/api/ciclo?semana=${semanaAtual}`);
    const feitas = data.itens.filter(i => i.realizado).length;
    const naoFeitas = data.itens.filter(i => !i.realizado).length;
    const total = data.itens.length;
    const pct = total > 0 ? Math.round((feitas / total) * 100) : 0;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = '↻ Virada de Ciclo';
    box.appendChild(h2);

    const summary = document.createElement('div');
    summary.style.cssText = 'display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;text-align:center;background:var(--bg);border-radius:var(--radius-sm);padding:16px;margin-bottom:16px;';
    [
      { val: feitas, label: 'Realizadas', color: 'var(--green)' },
      { val: naoFeitas, label: 'Não feitas', color: 'var(--red)' },
      { val: pct + '%', label: 'Cumprimento', color: pct >= 80 ? 'var(--green)' : pct >= 50 ? 'var(--yellow)' : 'var(--red)' },
    ].forEach(s => {
      const d = document.createElement('div');
      const v = document.createElement('div');
      v.style.cssText = `font-size:1.4rem;font-weight:800;font-family:var(--font-display);color:${s.color};`;
      v.textContent = s.val;
      const l = document.createElement('div');
      l.style.cssText = 'font-size:0.72rem;color:var(--text-3);margin-top:2px;text-transform:uppercase;letter-spacing:0.05em;';
      l.textContent = s.label;
      d.append(v, l);
      summary.appendChild(d);
    });
    box.appendChild(summary);

    const desc = document.createElement('p');
    desc.style.cssText = 'font-size:0.84rem;color:var(--text-2);margin-bottom:14px;';
    desc.textContent = 'Registrar a virada salva o histórico de progresso desta semana.';
    box.appendChild(desc);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', () => modal.remove());
    const btnVirar = document.createElement('button');
    btnVirar.className = 'btn btn-primary';
    btnVirar.textContent = '↻ Confirmar Virada';
    btnVirar.addEventListener('click', async () => {
      await api.post('/api/ciclo/virada', {
        data_virada: semanaAtual,
        tarefas_concluidas: feitas,
        tarefas_nao_concluidas: naoFeitas,
      });
      modal.remove();
      showToast('Virada registrada!', 'success');
    });
    actions.append(btnCancel, btnVirar);
    box.appendChild(actions);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── REGISTRO AVULSO (FAB) ─────────────────────────────────────────────────────
  function openRegistroAvulsoModal() {
    const msId = 'ra-ms';

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.maxWidth = '520px';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = 'Registrar Estudo Avulso';
    box.appendChild(h2);

    const gr1 = document.createElement('div');
    gr1.className = 'form-row';

    const gDisc = document.createElement('div');
    gDisc.className = 'form-group';
    const lDisc = document.createElement('label');
    lDisc.textContent = 'Disciplina *';
    const sDisc = document.createElement('select');
    const optDisc0 = document.createElement('option');
    optDisc0.value = '';
    optDisc0.textContent = 'Selecione...';
    sDisc.appendChild(optDisc0);
    disciplinas.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      opt.textContent = d.nome;
      sDisc.appendChild(opt);
    });
    gDisc.append(lDisc, sDisc);
    gr1.appendChild(gDisc);

    const gData = document.createElement('div');
    gData.className = 'form-group';
    const lData = document.createElement('label');
    lData.textContent = 'Data *';
    const iData = document.createElement('input');
    iData.type = 'date';
    iData.value = todayISO();
    gData.append(lData, iData);
    gr1.appendChild(gData);
    box.appendChild(gr1);

    const gr2 = document.createElement('div');
    gr2.className = 'form-row';

    const gTipo = document.createElement('div');
    gTipo.className = 'form-group';
    const lTipo = document.createElement('label');
    lTipo.textContent = 'Tipo';
    const sTipo = document.createElement('select');
    [['', '—'], ['questoes', 'Questões'], ['teoria', 'Teoria'], ['revisao', 'Revisão'], ['simulado', 'Simulado']].forEach(([v, t]) => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = t;
      sTipo.appendChild(opt);
    });
    gTipo.append(lTipo, sTipo);
    gr2.appendChild(gTipo);

    const gTempo = document.createElement('div');
    gTempo.className = 'form-group';
    const lTempo = document.createElement('label');
    lTempo.textContent = 'Tempo gasto (min)';
    const iTempo = document.createElement('input');
    iTempo.type = 'number';
    iTempo.value = '60';
    iTempo.min = '1';
    gTempo.append(lTempo, iTempo);
    gr2.appendChild(gTempo);
    box.appendChild(gr2);

    const gAss = document.createElement('div');
    gAss.className = 'form-group';
    const lAss = document.createElement('label');
    lAss.textContent = 'Assuntos';
    const assWrap = document.createElement('div');
    assWrap.innerHTML = '<div class="multi-select-trigger" style="opacity:0.5">Selecione a disciplina...</div>';
    gAss.append(lAss, assWrap);
    box.appendChild(gAss);

    let assuntosCarregados = [];
    sDisc.addEventListener('change', async () => {
      const did = sDisc.value;
      if (!did) {
        assWrap.innerHTML = '<div class="multi-select-trigger" style="opacity:0.5">Selecione a disciplina...</div>';
        return;
      }
      assuntosCarregados = await api.get('/api/assuntos?disciplina_id=' + did);
      const { html } = buildAssuntosMultiSelect(assuntosCarregados, [], msId);
      assWrap.innerHTML = html;
      assWrap.addEventListener('change', () => updateMultiSelectLabel(msId, assuntosCarregados));
    });

    const gr3 = document.createElement('div');
    gr3.className = 'form-row';

    const gQF = document.createElement('div');
    gQF.className = 'form-group';
    const lQF = document.createElement('label');
    lQF.textContent = 'Questões feitas';
    const iQF = document.createElement('input');
    iQF.type = 'number';
    iQF.value = '0';
    iQF.min = '0';
    gQF.append(lQF, iQF);
    gr3.appendChild(gQF);

    const gQA = document.createElement('div');
    gQA.className = 'form-group';
    const lQA = document.createElement('label');
    lQA.textContent = 'Acertadas';
    const iQA = document.createElement('input');
    iQA.type = 'number';
    iQA.value = '0';
    iQA.min = '0';
    const pctDiv = document.createElement('div');
    pctDiv.className = 'text-small text-muted';
    gQA.append(lQA, iQA, pctDiv);
    gr3.appendChild(gQA);
    box.appendChild(gr3);

    function updatePct() {
      const q = parseInt(iQF.value) || 0, a = parseInt(iQA.value) || 0;
      pctDiv.textContent = q > 0 ? `${((a / q) * 100).toFixed(1)}% acerto` : '';
    }
    iQF.addEventListener('input', updatePct);
    iQA.addEventListener('input', updatePct);

    const gBanca = document.createElement('div');
    gBanca.className = 'form-group';
    const lBanca = document.createElement('label');
    lBanca.textContent = 'Banca';
    const sBanca = document.createElement('select');
    const optB0 = document.createElement('option');
    optB0.value = '';
    optB0.textContent = '—';
    sBanca.appendChild(optB0);
    bancas.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.nome;
      opt.textContent = b.nome;
      sBanca.appendChild(opt);
    });
    gBanca.append(lBanca, sBanca);
    box.appendChild(gBanca);

    const gCF = document.createElement('div');
    gCF.className = 'form-group';
    const lCF = document.createElement('label');
    lCF.textContent = 'Como foi?';
    const tCF = document.createElement('textarea');
    tCF.placeholder = 'Observações sobre este estudo...';
    tCF.style.minHeight = '70px';
    gCF.append(lCF, tCF);
    box.appendChild(gCF);

    const actions = document.createElement('div');
    actions.className = 'form-actions';
    const btnCancel = document.createElement('button');
    btnCancel.className = 'btn btn-outline';
    btnCancel.textContent = 'Cancelar';
    btnCancel.addEventListener('click', () => modal.remove());
    const btnSalvar = document.createElement('button');
    btnSalvar.className = 'btn btn-primary';
    btnSalvar.textContent = 'Registrar';
    btnSalvar.addEventListener('click', async () => {
      const did = sDisc.value;
      if (!did) { showToast('Selecione uma disciplina', 'error'); sDisc.focus(); return; }
      const assunto_ids = getMultiSelectValues(msId);
      const concursoAlvoId = await getConcursoIdDoPlanoAtivo();
      await api.post('/api/sessoes', {
        data: iData.value || todayISO(),
        disciplina_id: parseInt(did),
        concurso_id: concursoAlvoId || null,
        tipo: sTipo.value,
        questoes_feitas: parseInt(iQF.value) || 0,
        questoes_acertadas: parseInt(iQA.value) || 0,
        tempo_gasto: parseInt(iTempo.value) || 0,
        como_foi: tCF.value.trim(),
        banca: sBanca.value,
        assunto_ids,
      });
      modal.remove();
      showToast('Estudo registrado!', 'success');
    });
    actions.append(btnCancel, btnSalvar);
    box.appendChild(actions);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  updateNavLabel();
  load();
}
