// ── CICLO SEMANAL ─────────────────────────────────────────────────────────────

async function renderCiclo(container) {
  const [disciplinas, concursos] = await Promise.all([
    api.get('/api/disciplinas'), api.get('/api/concursos')
  ]);

  let semanaAtual = getCurrentWeekMonday();
  let modoConfig = false;

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Ciclo Semanal</div><div class="page-subtitle">Organize seus estudos por semana</div></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" id="duplicar-btn">⎘ Duplicar</button>
        <button class="btn btn-outline btn-sm" id="config-toggle">⚙ Configurar</button>
        <button class="btn btn-primary btn-sm" id="nova-tarefa-ciclo-btn">+ Adicionar Tarefa</button>
      </div>
    </div>

    <div class="ciclo-semana-nav">
      <button class="btn btn-outline btn-sm" id="sem-prev">◀ Anterior</button>
      <div class="ciclo-semana-label" id="sem-label"></div>
      <button class="btn btn-outline btn-sm" id="sem-next">Próxima ▶</button>
      <button class="btn btn-outline btn-sm" id="sem-hoje">Hoje</button>
    </div>

    <div class="ciclo-stats-row" id="ciclo-stats"></div>

    <div id="config-area" class="config-ciclo-wrap hidden"></div>

    <div id="ciclo-body"></div>
  `;

  function getSemanaLabel(monday) {
    const sunday = getSundayOf(monday);
    const semNum = getWeekNumber(new Date(monday + 'T00:00:00'));
    return `Semana ${semNum} &nbsp;·&nbsp; ${formatDate(monday)} – ${formatDate(sunday)}`;
  }

  function updateNavLabel() {
    qs('#sem-label', container).innerHTML = getSemanaLabel(semanaAtual);
  }

  qs('#sem-prev', container).addEventListener('click', () => { semanaAtual = prevWeek(semanaAtual); updateNavLabel(); load(); });
  qs('#sem-next', container).addEventListener('click', () => { semanaAtual = nextWeek(semanaAtual); updateNavLabel(); load(); });
  qs('#sem-hoje', container).addEventListener('click', () => { semanaAtual = getCurrentWeekMonday(); updateNavLabel(); load(); });

  qs('#config-toggle', container).addEventListener('click', () => {
    modoConfig = !modoConfig;
    qs('#config-area', container).classList.toggle('hidden', !modoConfig);
    qs('#config-toggle', container).textContent = modoConfig ? '✕ Fechar Config' : '⚙ Configurar';
    if (modoConfig) renderConfigArea();
  });

  qs('#duplicar-btn', container).addEventListener('click', () => openDuplicarModal());
  qs('#nova-tarefa-ciclo-btn', container).addEventListener('click', () => openNovaSessaoModal());

  async function load() {
    const data = await api.get(`/api/ciclo?semana=${semanaAtual}`);
    renderStats(data);
    renderDias(data);
  }

  function renderStats(data) {
    const total = data.itens.length;
    const feitos = data.itens.filter(i => i.realizado).length;
    const adiados = data.itens.filter(i => i.adiado).length;
    const pct = total > 0 ? Math.round((feitos / total) * 100) : 0;

    qs('#ciclo-stats', container).innerHTML = `
      <div class="ciclo-stat-card"><div class="ciclo-stat-val">${total}</div><div class="ciclo-stat-label">Tarefas planejadas</div></div>
      <div class="ciclo-stat-card"><div class="ciclo-stat-val" style="color:var(--green)">${feitos}</div><div class="ciclo-stat-label">Realizadas</div></div>
      <div class="ciclo-stat-card"><div class="ciclo-stat-val" style="color:var(--yellow)">${adiados}</div><div class="ciclo-stat-label">Adiadas</div></div>
      <div class="ciclo-stat-card"><div class="ciclo-stat-val">${pct}%</div><div class="ciclo-stat-label">Cumprimento</div></div>
    `;
  }

  function renderDias(data) {
    const body = qs('#ciclo-body', container);
    const dates = getWeekDates(semanaAtual);
    const hoje = todayISO();
    const hojeIdx = dates.indexOf(hoje); // -1 se semana não é a atual

    body.innerHTML = '<div class="ciclo-accordion-list" id="ciclo-accordion"></div>';
    const accordion = qs('#ciclo-accordion', container);

    // ── Card ATRASOS ──────────────────────────────────────────────────────────
    const atrasados = data.itens.filter(i => {
      if (i.realizado) return false;
      const diaDate = i.dia_semana !== null && i.dia_semana !== undefined ? dates[i.dia_semana] : null;
      return diaDate && diaDate < hoje;
    });

    if (atrasados.length > 0) {
      const cardAtraso = document.createElement('div');
      cardAtraso.className = 'ciclo-acc-card ciclo-acc-atraso open';
      cardAtraso.innerHTML = `
        <div class="ciclo-acc-header" data-toggle="atraso">
          <div class="ciclo-acc-header-left">
            <span class="ciclo-acc-icon">⚠️</span>
            <div>
              <div class="ciclo-acc-title" style="color:var(--red)">Tarefas em atraso</div>
              <div class="ciclo-acc-sub">${atrasados.length} tarefa${atrasados.length !== 1 ? 's' : ''} não realizadas</div>
            </div>
          </div>
          <div class="ciclo-acc-right">
            <span class="ciclo-acc-count ciclo-acc-count-red">${atrasados.length}</span>
            <span class="ciclo-acc-chevron">▼</span>
          </div>
        </div>
        <div class="ciclo-acc-body" id="acc-atraso">
          ${renderSessoesDia(atrasados, disciplinas, true)}
        </div>
      `;
      accordion.appendChild(cardAtraso);
    }

    // ── Cards por DIA ─────────────────────────────────────────────────────────
    DIAS_SEMANA.forEach((diaNome, idx) => {
      const dateISO = dates[idx];
      const isHoje = dateISO === hoje;
      const isPast = dateISO < hoje;
      const isFuture = dateISO > hoje;
      const sessoesDia = data.itens.filter(i => i.dia_semana === idx);
      const feitas = sessoesDia.filter(i => i.realizado).length;
      const total = sessoesDia.length;

      // Decide se abre ou fecha
      const startOpen = isHoje; // só hoje abre por padrão

      const card = document.createElement('div');
      card.className = `ciclo-acc-card ${startOpen ? 'open' : ''} ${isHoje ? 'ciclo-acc-hoje' : ''}`;
      card.dataset.dia = idx;

      // Ícone e cor do status
      let statusBadge = '';
      if (total === 0) {
        statusBadge = '<span class="ciclo-acc-count ciclo-acc-count-empty">—</span>';
      } else if (isPast || isHoje) {
        const pct = Math.round((feitas / total) * 100);
        const cor = feitas === total ? 'green' : feitas > 0 ? 'yellow' : 'red';
        statusBadge = `<span class="ciclo-acc-count ciclo-acc-count-${cor}">${feitas}/${total}</span>`;
      } else {
        statusBadge = `<span class="ciclo-acc-count ciclo-acc-count-empty">${total}</span>`;
      }

      card.innerHTML = `
        <div class="ciclo-acc-header" data-toggle="dia-${idx}">
          <div class="ciclo-acc-header-left">
            <div>
              <div class="ciclo-acc-title ${isHoje ? 'ciclo-acc-title-hoje' : ''}">
                ${diaNome}
                ${isHoje ? '<span class="ciclo-hoje-badge">hoje</span>' : ''}
              </div>
              <div class="ciclo-acc-sub">${formatDate(dateISO)}${total > 0 ? ` · ${total} tarefa${total !== 1 ? 's' : ''}` : ''}</div>
            </div>
          </div>
          <div class="ciclo-acc-right">
            ${statusBadge}
            <span class="ciclo-acc-chevron">${startOpen ? '▼' : '▶'}</span>
          </div>
        </div>
        <div class="ciclo-acc-body ${startOpen ? '' : 'hidden'}" id="acc-dia-${idx}">
          ${renderSessoesDia(sessoesDia, disciplinas)}
        </div>
      `;

      // Drag and drop
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

      accordion.appendChild(card);
    });

    // ── Card SEM DIA ──────────────────────────────────────────────────────────
    const semDia = data.itens.filter(i => i.dia_semana === null || i.dia_semana === undefined);
    if (semDia.length > 0) {
      const cardSemDia = document.createElement('div');
      cardSemDia.className = 'ciclo-acc-card';
      cardSemDia.innerHTML = `
        <div class="ciclo-acc-header" data-toggle="sem-dia">
          <div class="ciclo-acc-header-left">
            <div>
              <div class="ciclo-acc-title text-muted">Sem dia definido</div>
              <div class="ciclo-acc-sub">${semDia.length} tarefa${semDia.length !== 1 ? 's' : ''}</div>
            </div>
          </div>
          <div class="ciclo-acc-right">
            <span class="ciclo-acc-count ciclo-acc-count-empty">${semDia.length}</span>
            <span class="ciclo-acc-chevron">▶</span>
          </div>
        </div>
        <div class="ciclo-acc-body hidden" id="acc-sem-dia">
          ${renderSessoesDia(semDia, disciplinas)}
        </div>
      `;
      cardSemDia.addEventListener('dragover', e => { e.preventDefault(); cardSemDia.style.borderColor = 'var(--primary)'; });
      cardSemDia.addEventListener('dragleave', () => { cardSemDia.style.borderColor = ''; });
      cardSemDia.addEventListener('drop', async e => {
        e.preventDefault();
        cardSemDia.style.borderColor = '';
        const itemId = e.dataTransfer.getData('text/plain');
        if (!itemId) return;
        await api.put(`/api/ciclo/item/${itemId}`, { dia_semana: null });
        load();
      });
      accordion.appendChild(cardSemDia);
    }

    // Toggle accordion ao clicar no header
    qsa('.ciclo-acc-header', accordion).forEach(header => {
      header.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        const card = header.closest('.ciclo-acc-card');
        const bodyId = header.dataset.toggle;
        const body = qs(`#acc-${bodyId}`, accordion);
        const chevron = header.querySelector('.ciclo-acc-chevron');
        const isOpen = !body.classList.contains('hidden');
        body.classList.toggle('hidden', isOpen);
        if (chevron) chevron.textContent = isOpen ? '▶' : '▼';
        card.classList.toggle('open', !isOpen);
      });
    });

    bindSessaoActions(accordion, data.itens, disciplinas, concursos);
  }

  function renderSessoesDia(sessoes, disciplinas, isAtraso = false) {
    if (!sessoes.length) return '<div class="text-muted text-small" style="padding:12px 16px">Nenhuma tarefa para este dia.</div>';
    return sessoes.map(s => {
      const disc = disciplinas.find(d => d.id === s.disciplina_id);
      const assuntosStr = s.assuntos && s.assuntos.length ? s.assuntos.map(a => (a.codigo ? a.codigo + ' ' : '') + a.nome).join(', ') : '';
      const statusClass = s.realizado ? 'realizado' : s.adiado ? 'adiado' : '';
      const diaLabel = isAtraso && s.dia_semana !== null && s.dia_semana !== undefined ? DIAS_SEMANA[s.dia_semana] : '';
      return `
        <div class="ciclo-sessao-item ${statusClass}" draggable="true" data-item-id="${s.id}">
          <div class="ciclo-sessao-info">
            ${diaLabel ? `<div style="font-size:0.68rem;color:var(--red);font-weight:600;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px">${diaLabel}</div>` : ''}
            <div class="ciclo-sessao-disc">${s.disciplina_nome}</div>
            ${assuntosStr ? `<div class="ciclo-sessao-assuntos">${assuntosStr}</div>` : ''}
            ${s.tipo ? `<div class="ciclo-sessao-tipo">${s.tipo} · ${s.tempo_estimado}min</div>` : ''}
          </div>
          <div class="ciclo-sessao-actions">
            ${s.realizado
              ? `<button class="btn btn-sm acerto-green" data-action="unrealizar" data-id="${s.id}" title="Desmarcar como feito">✓</button>`
              : `<button class="btn btn-success btn-sm" data-action="realizar" data-id="${s.id}" title="Registrar sessão">✓</button>`
            }
            ${!s.realizado ? `<button class="btn btn-warning btn-sm" data-action="adiar" data-id="${s.id}" title="${s.adiado ? 'Desadiar' : 'Adiar'}">⏸</button>` : ''}
            <button class="btn btn-outline btn-sm" data-action="editar" data-id="${s.id}" title="Editar">✏</button>
            ${btnApagar('data-action="apagar" data-id="'+s.id+'"')}
          </div>
        </div>`;
    }).join('');
  }

  function bindSessaoActions(grid, todosItens, disciplinas, concursos) {
    // Drag start
    qsa('[draggable="true"]', grid).forEach(el => {
      el.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', el.dataset.itemId);
      });
    });

    // Realizar (abre modal de registro completo)
    qsa('[data-action="realizar"]', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        const item = todosItens.find(i => i.id == btn.dataset.id);
        if (item) openRegistrarSessaoModal(item, disciplinas, concursos, load);
      });
    });

    // Desmarcar
    qsa('[data-action="unrealizar"]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        await api.put(`/api/ciclo/item/${btn.dataset.id}`, { realizado: false });
        showToast('Desmarcado'); load();
      });
    });

    // Adiar
    qsa('[data-action="adiar"]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        const item = todosItens.find(i => i.id == btn.dataset.id);
        await api.put(`/api/ciclo/item/${btn.dataset.id}`, { adiado: !item?.adiado });
        showToast(item?.adiado ? 'Reativado' : 'Adiado');
        load();
      });
    });

    // Editar sessão do ciclo
    qsa('[data-action="editar"]', grid).forEach(btn => {
      btn.addEventListener('click', () => {
        const item = todosItens.find(i => i.id == btn.dataset.id);
        if (item) openEditarItemCicloModal(item, disciplinas, load);
      });
    });

    // Apagar
    qsa('[data-action="apagar"]', grid).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Remover do ciclo?')) return;
        // Não há rota delete de item, vamos marcar com realizado e remover visualmente
        // Usa delete via API fictícia — precisamos de uma rota, então vamos usar workaround
        await fetch(`/api/ciclo/item/${btn.dataset.id}`, { method: 'DELETE' });
        load();
      });
    });
  }

  function renderConfigArea() {
    const area = qs('#config-area', container);
    area.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div class="section-title" style="margin:0">Configurar Semana</div>
        <button class="btn btn-primary btn-sm" id="gerar-ciclo-btn">Gerar Ciclo</button>
      </div>
      <div style="font-size:0.82rem;color:var(--text-2);margin-bottom:14px">
        Configure quantas sessões de cada disciplina por semana e em quais dias.
      </div>
      <div id="config-disc-list">
        ${disciplinas.map(d => `
          <div class="config-disc-row" style="display:flex;align-items:center;gap:12px;padding:10px 0;border-bottom:1px solid var(--border)">
            <span style="flex:1;font-size:0.88rem;font-weight:500">${d.nome}</span>
            <label style="font-size:0.78rem;color:var(--text-3)">Sessões/semana</label>
            <input type="number" class="disc-sessoes-semana" data-disc="${d.id}" min="0" max="14" value="0" style="width:60px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 8px;text-align:center;font-weight:700;font-family:var(--font-display)">
          </div>
        `).join('')}
      </div>
    `;

    qs('#gerar-ciclo-btn', area).addEventListener('click', async () => {
      const sessoes = [];
      qsa('.disc-sessoes-semana', area).forEach(input => {
        const count = parseInt(input.value) || 0;
        const did = parseInt(input.dataset.disc);
        for (let i = 0; i < count; i++) sessoes.push({ disciplina_id: did });
      });
      if (!sessoes.length) { showToast('Configure ao menos uma sessão', 'error'); return; }
      await api.post('/api/ciclo/gerar', { semana: semanaAtual, sessoes });
      showToast('Ciclo gerado!', 'success');
      load();
    });
  }

  function openDuplicarModal() {
    const proxSemana = nextWeek(semanaAtual);
    openModal('Duplicar Ciclo', `
      <p style="font-size:0.84rem;color:var(--text-2);margin-bottom:14px">
        Duplica o ciclo atual para outra semana (mantém disciplinas e assuntos, reseta progresso).
      </p>
      <div class="form-group">
        <label>Semana de destino</label>
        <input type="date" id="dup-destino" value="${proxSemana}">
        <div class="text-small text-muted" id="dup-label" style="margin-top:4px"></div>
      </div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="dup-confirmar">Duplicar</button>
      </div>
    `);

    function updateDupLabel() {
      const val = qs('#dup-destino').value;
      if (!val) return;
      const monday = getMondayOf(new Date(val + 'T00:00:00')).toISOString().slice(0, 10);
      qs('#dup-label').innerHTML = getSemanaLabel(monday);
    }
    qs('#dup-destino').addEventListener('change', updateDupLabel);
    updateDupLabel();

    qs('#dup-confirmar').addEventListener('click', async () => {
      const raw = qs('#dup-destino').value;
      if (!raw) { showToast('Selecione uma data', 'error'); return; }
      const semana_destino = getMondayOf(new Date(raw + 'T00:00:00')).toISOString().slice(0, 10);
      await api.post('/api/ciclo/duplicar', { semana_origem: semanaAtual, semana_destino });
      closeModal();
      showToast('Ciclo duplicado!', 'success');
      semanaAtual = semana_destino;
      updateNavLabel();
      load();
    });
  }

  function openNovaSessaoModal() {
    openModal('Adicionar Tarefa ao Ciclo', `
      <div class="form-row">
        <div class="form-group"><label>Disciplina *</label>
          <select id="nc-disc">
            <option value="">Selecione...</option>
            ${disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Dia da semana</label>
          <select id="nc-dia">
            <option value="">Sem dia específico</option>
            ${DIAS_SEMANA.map((d, i) => `<option value="${i}">${d}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-group"><label>Assuntos</label><div id="nc-assuntos-wrap"><div class="multi-select-trigger" style="opacity:0.5">Selecione a disciplina...</div></div></div>
      <div class="form-row">
        <div class="form-group"><label>Tipo</label>
          <select id="nc-tipo">
            <option value="">—</option>
            <option value="questoes">Questões</option>
            <option value="teorico">Teórico</option>
            <option value="revisao">Revisão</option>
            <option value="simulado">Simulado</option>
          </select>
        </div>
        <div class="form-group"><label>Tempo estimado (min)</label><input type="number" id="nc-tempo" value="60" min="15" step="15"></div>
      </div>
      <div class="form-group"><label>Descrição (opcional)</label><input type="text" id="nc-desc" placeholder="Ex: Foco em questões CESPE..."></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="nc-salvar">Adicionar</button>
      </div>
    `);

    let assuntosDisp = [];
    const msId = 'nc-ms';

    qs('#nc-disc').addEventListener('change', async () => {
      const did = qs('#nc-disc').value;
      const wrap = qs('#nc-assuntos-wrap');
      if (!did) { wrap.innerHTML = '<div class="multi-select-trigger" style="opacity:0.5">Selecione a disciplina...</div>'; return; }
      assuntosDisp = await api.get('/api/assuntos?disciplina_id=' + did);
      const msResult = buildAssuntosMultiSelect(assuntosDisp, [], msId);
      wrap.innerHTML = msResult.html;
      // Bind eventos no dropdown recém-criado
      const dd = qs('#' + msId + '-dropdown');
      if (dd) dd.addEventListener('change', () => updateMultiSelectLabel(msId, assuntosDisp));
    });

    qs('#nc-salvar').addEventListener('click', async () => {
      const did = qs('#nc-disc').value;
      if (!did) { showToast('Selecione uma disciplina', 'error'); return; }
      const dia = qs('#nc-dia').value;
      const assunto_ids = getMultiSelectValues(msId);
      const sessao = {
        disciplina_id: parseInt(did),
        dia_semana: dia !== '' ? parseInt(dia) : null,
        assunto_ids,
        tipo: qs('#nc-tipo').value,
        tempo_estimado: parseInt(qs('#nc-tempo').value) || 60,
        descricao: qs('#nc-desc').value.trim(),
      };

      // Pega itens existentes e adiciona
      const data = await api.get(`/api/ciclo?semana=${semanaAtual}`);
      const sessoes = data.itens.map(i => ({
        disciplina_id: i.disciplina_id,
        dia_semana: i.dia_semana,
        assunto_ids: i.assuntos ? i.assuntos.map(a => a.id) : [],
        tipo: i.tipo,
        tempo_estimado: i.tempo_estimado,
        descricao: i.descricao,
      }));
      sessoes.push(sessao);

      await api.post('/api/ciclo/gerar', { semana: semanaAtual, sessoes });
      closeModal(); showToast('Tarefa adicionada!', 'success'); load();
    });
  }

  function openEditarItemCicloModal(item, disciplinas, onSave) {
    const assuntosIds = item.assuntos ? item.assuntos.map(a => a.id) : [];
    const msId = 'edit-ciclo-ms';

    openModal('Editar Item do Ciclo', `
      <div class="form-group"><label>Assuntos</label><div id="edit-ciclo-ass-wrap">Carregando...</div></div>
      <div class="form-row">
        <div class="form-group"><label>Dia da semana</label>
          <select id="ec-dia">
            <option value="">Sem dia</option>
            ${DIAS_SEMANA.map((d, i) => `<option value="${i}" ${item.dia_semana === i ? 'selected' : ''}>${d}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Tipo</label>
          <select id="ec-tipo">
            <option value="">—</option>
            <option value="questoes" ${item.tipo==='questoes'?'selected':''}>Questões</option>
            <option value="teorico" ${item.tipo==='teorico'?'selected':''}>Teórico</option>
            <option value="revisao" ${item.tipo==='revisao'?'selected':''}>Revisão</option>
            <option value="simulado" ${item.tipo==='simulado'?'selected':''}>Simulado</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Tempo estimado (min)</label><input type="number" id="ec-tempo" value="${item.tempo_estimado||60}" min="15" step="15"></div>
      <div class="form-group"><label>Descrição</label><input type="text" id="ec-desc" value="${item.descricao||''}"></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="ec-salvar">Salvar</button>
      </div>
    `);

    // Carrega assuntos
    api.get(`/api/assuntos?disciplina_id=${item.disciplina_id}`).then(assuntos => {
      const wrap = qs('#edit-ciclo-ass-wrap');
      const { html } = buildAssuntosMultiSelect(assuntos, assuntosIds, msId);
      wrap.innerHTML = html;
      wrap.addEventListener('change', () => updateMultiSelectLabel(msId, assuntos));
      // Atualiza label inicial
      setTimeout(() => updateMultiSelectLabel(msId, assuntos), 50);
    });

    qs('#ec-salvar').addEventListener('click', async () => {
      const dia = qs('#ec-dia').value;
      const assunto_ids = getMultiSelectValues(msId);
      await api.put(`/api/ciclo/item/${item.id}`, {
        dia_semana: dia !== '' ? parseInt(dia) : null,
        assunto_ids,
        tipo: qs('#ec-tipo').value,
        tempo_estimado: parseInt(qs('#ec-tempo').value) || 60,
        descricao: qs('#ec-desc').value.trim(),
      });
      closeModal(); showToast('Salvo!', 'success');
      if (onSave) onSave();
    });
  }

  async function openRegistrarSessaoModal(item, disciplinas, concursos, onSave) {
    // Abre o formulário completo de registro pré-preenchido com os dados do ciclo
    const concursoAlvoId = await getConcursoIdDoPlanoAtivo();
    const assuntosIds = item.assuntos ? item.assuntos.map(a => a.id) : [];
    const msId = 'ciclo-reg-ms';

    openModal(`Registrar: ${item.disciplina_nome}`, `
      <div class="form-row">
        <div class="form-group"><label>Data *</label><input type="date" id="cr-data" value="${todayISO()}"></div>
        <div class="form-group"><label>Tipo *</label>
          <select id="cr-tipo">
            <option value="questoes" ${item.tipo==='questoes'?'selected':''}>Questões</option>
            <option value="teorico" ${item.tipo==='teorico'?'selected':''}>Teórico</option>
            <option value="revisao" ${item.tipo==='revisao'?'selected':''}>Revisão</option>
            <option value="simulado" ${item.tipo==='simulado'?'selected':''}>Simulado</option>
          </select>
        </div>
      </div>
      <div class="form-group"><label>Concurso</label>
        <select id="cr-concurso">
          <option value="">Sem concurso</option>
          ${concursos.map(c => `<option value="${c.id}" ${String(c.id)===String(concursoAlvoId)?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Assuntos</label><div id="cr-ass-wrap">Carregando...</div></div>
      <div id="cr-questoes-fields">
        <div class="form-row-3">
          <div class="form-group"><label>Questões</label><input type="number" id="cr-total" value="0" min="0"></div>
          <div class="form-group"><label>Acertos</label><input type="number" id="cr-acertos" value="0" min="0"></div>
          <div class="form-group"><label>Banca</label>
            <select id="cr-banca">
              <option value="">—</option>
              ${BANCAS_PADRAO.map(b => `<option value="${b}">${b}</option>`).join('')}
            </select>
          </div>
        </div>
        <div id="cr-erros" class="text-small text-muted" style="margin-bottom:8px"></div>
      </div>
      <div class="form-group"><label>Observações *</label><textarea id="cr-obs" style="min-height:80px" placeholder="Como foi esse estudo? O que aprendeu?"></textarea></div>
      <div class="form-actions">
        <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary" id="cr-salvar">Registrar e marcar ✓</button>
      </div>
    `);

    // Carrega assuntos
    api.get(`/api/assuntos?disciplina_id=${item.disciplina_id}`).then(assuntos => {
      const wrap = qs('#cr-ass-wrap');
      const { html } = buildAssuntosMultiSelect(assuntos, assuntosIds, msId);
      wrap.innerHTML = html;
      wrap.addEventListener('change', () => updateMultiSelectLabel(msId, assuntos));
      setTimeout(() => updateMultiSelectLabel(msId, assuntos), 50);
    });

    // Atualiza erros
    function updateErros() {
      const t = parseInt(qs('#cr-total')?.value) || 0, a = parseInt(qs('#cr-acertos')?.value) || 0;
      const div = qs('#cr-erros');
      if (div) div.textContent = t > 0 ? `Erros: ${Math.max(0, t-a)} | Acerto: ${((a/t)*100).toFixed(1)}%` : '';
    }
    qs('#cr-total')?.addEventListener('input', updateErros);
    qs('#cr-acertos')?.addEventListener('input', updateErros);

    qs('#cr-salvar').addEventListener('click', async () => {
      const tipo = qs('#cr-tipo').value;
      const observacoes = qs('#cr-obs').value.trim();
      if (!observacoes) { showToast('Observações obrigatórias', 'error'); qs('#cr-obs').focus(); return; }

      const assunto_ids = getMultiSelectValues(msId);
      const payload = {
        data: qs('#cr-data').value,
        disciplina_id: item.disciplina_id,
        concurso_id: qs('#cr-concurso').value || null,
        tipo,
        total_questoes: parseInt(qs('#cr-total')?.value) || 0,
        acertos: parseInt(qs('#cr-acertos')?.value) || 0,
        banca: qs('#cr-banca')?.value || '',
        observacoes, assunto_ids,
        nota_liquida: null, ranking: '', controle_emocional: null, gestao_tempo: null,
      };

      await api.post('/api/sessoes', payload);
      await api.put(`/api/ciclo/item/${item.id}`, { realizado: true });
      closeModal(); showToast('Estudo registrado!', 'success');
      if (onSave) onSave();
    });
  }

  updateNavLabel();
  load();
}
