// ── REGISTRAR ESTUDO PAGE ─────────────────────────────────────────────────────

async function renderRegistro(container) {
  const [concursos, disciplinas, concursoAlvoId, planId, bancasUsadas] = await Promise.all([
    api.get('/api/concursos'),
    api.get('/api/disciplinas'),
    getConcursoIdDoPlanoAtivo(),
    getConcursoAlvo(),
    api.get('/api/bancas')
  ]);

  // Bancas: principais + usuário já usou antes (salvas no banco)
  const bancasExtras = bancasUsadas.filter(b => !BANCAS_PADRAO.includes(b));

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Registrar Estudo</div><div class="page-subtitle">Registre o que você estudou</div></div>
    </div>
    <div class="registro-form-card">
      <div class="form-row">
        <div class="form-group"><label>Data *</label><input type="date" id="r-data" value="${todayISO()}" required></div>
        <div class="form-group"><label>Planejamento</label>
          <select id="r-concurso">
            <option value="">Sem planejamento</option>
            ${concursos.map(c => `<option value="${c.id}" ${c.id == concursoAlvoId ? 'selected' : ''}>${c.nome}</option>`).join('')}
          </select>
        </div>
      </div>
      <div class="form-row">
        <div class="form-group"><label>Disciplina *</label>
          <select id="r-disciplina" required>
            <option value="">Selecione...</option>
            ${disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}
          </select>
        </div>
        <div class="form-group"><label>Tipo *</label>
          <select id="r-tipo" required>
            <option value="">Selecione...</option>
            <option value="questoes">Questões</option>
            <option value="teorico">Teórico</option>
            <option value="revisao">Revisão</option>
            <option value="simulado">Simulado</option>
          </select>
        </div>
      </div>

      <div class="form-group">
        <label>Assuntos</label>
        <div id="r-assuntos-wrap">
          <div class="multi-select-trigger" style="opacity:0.5;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:9px 12px">Selecione a disciplina primeiro</div>
        </div>
      </div>

      <div id="r-questoes-fields" class="hidden">
        <div class="form-row-3">
          <div class="form-group"><label>Total de Questões</label><input type="number" id="r-total" min="0" value="0"></div>
          <div class="form-group"><label>Acertos</label><input type="number" id="r-acertos" min="0" value="0"></div>
          <div class="form-group">
            <label>Banca</label>
            <select id="r-banca">
              <option value="">Sem banca</option>
              <optgroup label="Principais">
                ${BANCAS_PADRAO.map(b => `<option value="${b}">${b}</option>`).join('')}
              </optgroup>
              ${bancasExtras.length ? `<optgroup label="Outras usadas">${bancasExtras.map(b => `<option value="${b}">${b}</option>`).join('')}</optgroup>` : ''}
              <option value="__outra__">+ Outra banca...</option>
            </select>
            <input type="text" id="r-banca-outra" class="hidden" placeholder="Nome da banca" style="margin-top:6px">
          </div>
        </div>
        <div id="r-erros-display" class="text-small text-muted" style="margin-bottom:8px"></div>
      </div>

      <div id="r-simulado-fields" class="hidden">
        <div class="form-row">
          <div class="form-group"><label>Nota Líquida</label><input type="number" id="r-nota" step="0.01"></div>
          <div class="form-group"><label>Ranking</label><input type="text" id="r-ranking" placeholder="Ex: 42º / 1500"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Controle Emocional (1–5)</label><input type="number" id="r-emocional" min="1" max="5"></div>
          <div class="form-group"><label>Gestão de Tempo (1–5)</label><input type="number" id="r-gestao-tempo" min="1" max="5"></div>
        </div>
      </div>

      <div class="form-group">
        <label>Observações gerais</label>
        <textarea id="r-obs" placeholder="Como foi esse estudo? Dificuldades gerais, pontos de atenção..." style="min-height:80px"></textarea>
      </div>

      <div class="form-actions">
        <button class="btn btn-outline" id="r-clear">Limpar</button>
        <button class="btn btn-primary" id="r-salvar">Salvar Estudo</button>
      </div>
    </div>

    <div class="registro-historico">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;margin-bottom:14px">
        <div class="registro-historico-title" style="margin:0">Histórico Recente</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm filtro-rapido" data-filtro="">Tudo</button>
          <button class="btn btn-outline btn-sm filtro-rapido active" data-filtro="semana">Esta semana</button>
          <button class="btn btn-outline btn-sm filtro-rapido" data-filtro="mes">Este mês</button>
        </div>
      </div>
      <div class="filters-bar" style="margin-bottom:14px">
        <div class="filter-group"><label>Disciplina</label>
          <select id="rh-disciplina">
            <option value="">Todas</option>
            ${disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}
          </select>
        </div>
        <div class="filter-group"><label>Tipo</label>
          <select id="rh-tipo">
            <option value="">Todos</option>
            <option value="questoes">Questões</option>
            <option value="teorico">Teórico</option>
            <option value="revisao">Revisão</option>
            <option value="simulado">Simulado</option>
          </select>
        </div>
        <div class="filter-group"><label>De</label><input type="date" id="rh-de"></div>
        <div class="filter-group"><label>Até</label><input type="date" id="rh-ate"></div>
      </div>
      <div id="rh-list"></div>
    </div>
  `;

  // Assuntos do plano ativo para destacar
  let assuntosDoPlano = new Set();
  if (planId) {
    try {
      const plan = await api.get('/api/planejamentos/' + planId);
      plan.disciplinas?.forEach(d => {
        d.assuntos?.forEach(a => assuntosDoPlano.add(a.assunto_id ?? a.id));
      });
    } catch(e) {}
  }

  let currentAssuntos = [];
  let currentAssuntosId = null;

  const rDisciplina = qs('#r-disciplina', container);
  const rTipo = qs('#r-tipo', container);
  const rConcurso = qs('#r-concurso', container);
  const rBanca = qs('#r-banca', container);
  const rBancaOutra = qs('#r-banca-outra', container);

  // Banca "outra"
  rBanca.addEventListener('change', () => {
    rBancaOutra.classList.toggle('hidden', rBanca.value !== '__outra__');
    if (rBanca.value === '__outra__') rBancaOutra.focus();
  });

  rDisciplina.addEventListener('change', async () => {
    const did = rDisciplina.value;
    const wrap = qs('#r-assuntos-wrap', container);
    if (!did) {
      wrap.innerHTML = '<div class="multi-select-trigger" style="opacity:0.5;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:9px 12px">Selecione a disciplina primeiro</div>';
      currentAssuntos = [];
      currentAssuntosId = null;
      return;
    }
    currentAssuntos = await api.get('/api/assuntos?disciplina_id=' + did);
    // Ordena: assuntos do plano primeiro, depois os demais
    currentAssuntos.sort((a, b) => {
      const aNoPlano = assuntosDoPlano.has(a.id) ? 0 : 1;
      const bNoPlano = assuntosDoPlano.has(b.id) ? 0 : 1;
      return aNoPlano - bNoPlano;
    });
    currentAssuntosId = 'r-assuntos-ms';
    const { id, html: msHtml } = buildAssuntosMultiSelect(currentAssuntos, [], currentAssuntosId);
    wrap.innerHTML = msHtml;
    const dd = document.getElementById(id + '-dropdown');
    if (dd) dd.addEventListener('change', () => updateMultiSelectLabel(id, currentAssuntos));
  });

  rTipo.addEventListener('change', () => {
    const tipo = rTipo.value;
    qs('#r-questoes-fields', container).classList.toggle('hidden', tipo === 'teorico' || tipo === 'revisao' || tipo === '');
    qs('#r-simulado-fields', container).classList.toggle('hidden', tipo !== 'simulado');
  });

  const rTotal = qs('#r-total', container);
  const rAcertos = qs('#r-acertos', container);
  function updateErros() {
    const t = parseInt(rTotal?.value) || 0, a = parseInt(rAcertos?.value) || 0;
    const errosDiv = qs('#r-erros-display', container);
    if (errosDiv) errosDiv.textContent = t > 0 ? `Erros: ${Math.max(0, t-a)} | Acerto: ${((a/t)*100).toFixed(1)}%` : '';
  }
  rTotal?.addEventListener('input', updateErros);
  rAcertos?.addEventListener('input', updateErros);

  function getBancaValue() {
    if (rBanca.value === '__outra__') return rBancaOutra.value.trim();
    return rBanca.value;
  }

  function clearForm() {
    qs('#r-data', container).value = todayISO();
    rDisciplina.value = '';
    rTipo.value = '';
    rBanca.value = '';
    rBancaOutra.value = '';
    rBancaOutra.classList.add('hidden');
    qs('#r-assuntos-wrap', container).innerHTML = '<div class="multi-select-trigger" style="opacity:0.5;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:9px 12px">Selecione a disciplina primeiro</div>';
    currentAssuntos = [];
    currentAssuntosId = null;
    if (rTotal) rTotal.value = 0;
    if (rAcertos) rAcertos.value = 0;
    qs('#r-obs', container).value = '';
    qs('#r-questoes-fields', container).classList.add('hidden');
    qs('#r-simulado-fields', container).classList.add('hidden');
    if (concursoAlvoId) rConcurso.value = concursoAlvoId;
  }

  qs('#r-clear', container).addEventListener('click', clearForm);

  qs('#r-salvar', container).addEventListener('click', async () => {
    const data = qs('#r-data', container).value;
    const disciplina_id = rDisciplina.value;
    const tipo = rTipo.value;

    if (!data || !disciplina_id || !tipo) { showToast('Preencha os campos obrigatórios', 'error'); return; }

    const total = parseInt(rTotal?.value) || 0;
    const acertos = parseInt(rAcertos?.value) || 0;
    if ((tipo === 'questoes' || tipo === 'simulado') && acertos > total) {
      showToast('Acertos não pode ser maior que total', 'error'); return;
    }

    const banca = getBancaValue();
    const assunto_ids = currentAssuntosId ? getMultiSelectValues(currentAssuntosId) : [];
    const observacoes = qs('#r-obs', container).value.trim();

    const payload = {
      data,
      concurso_id: rConcurso.value || null,
      disciplina_id,
      tipo,
      total_questoes: ['questoes','simulado'].includes(tipo) ? total : 0,
      acertos: ['questoes','simulado'].includes(tipo) ? acertos : 0,
      banca,
      nota_liquida: tipo === 'simulado' ? qs('#r-nota', container)?.value || null : null,
      ranking: tipo === 'simulado' ? qs('#r-ranking', container)?.value || '' : '',
      controle_emocional: tipo === 'simulado' ? qs('#r-emocional', container)?.value || null : null,
      gestao_tempo: tipo === 'simulado' ? qs('#r-gestao-tempo', container)?.value || null : null,
      observacoes,
      assunto_ids
    };

    try {
      await api.post('/api/sessoes', payload);
      showToast('Estudo registrado!', 'success');
      clearForm();
      loadHistorico();
    } catch(e) { showToast('Erro ao salvar: ' + e.message, 'error'); }
  });

  // Filtros rápidos
  let filtroRapido = 'semana';
  function aplicarFiltroRapido(filtro) {
    filtroRapido = filtro;
    qsa('.filtro-rapido', container).forEach(b => b.classList.toggle('active', b.dataset.filtro === filtro));
    const hoje = new Date();
    const deInput = qs('#rh-de', container);
    const ateInput = qs('#rh-ate', container);
    if (filtro === 'semana') {
      deInput.value = getMondayOf(hoje).toISOString().slice(0,10);
      ateInput.value = getSundayOf(deInput.value);
    } else if (filtro === 'mes') {
      deInput.value = new Date(hoje.getFullYear(), hoje.getMonth(), 1).toISOString().slice(0,10);
      ateInput.value = new Date(hoje.getFullYear(), hoje.getMonth()+1, 0).toISOString().slice(0,10);
    } else {
      deInput.value = '';
      ateInput.value = '';
    }
    loadHistorico();
  }

  qsa('.filtro-rapido', container).forEach(btn => {
    btn.addEventListener('click', () => aplicarFiltroRapido(btn.dataset.filtro));
  });

  async function loadHistorico() {
    const params = {
      disciplina_id: qs('#rh-disciplina', container).value,
      data_inicio: qs('#rh-de', container).value,
      data_fim: qs('#rh-ate', container).value,
    };
    const tipo = qs('#rh-tipo', container).value;
    const sessoes = await api.get('/api/sessoes' + qs_params(params));
    const filtradas = tipo ? sessoes.filter(s => s.tipo === tipo) : sessoes;
    const listEl = qs('#rh-list', container);

    if (!filtradas.length) { listEl.innerHTML = '<p class="text-muted text-small">Nenhum estudo encontrado.</p>'; return; }

    const [todasDiscsLocal, todosConcsLocal, bancas2] = await Promise.all([
      api.get('/api/disciplinas'), api.get('/api/concursos'), api.get('/api/bancas')
    ]);
    const bancasTodasLocal = BANCAS_PADRAO.concat(bancas2.filter(b => !BANCAS_PADRAO.includes(b)));

    listEl.innerHTML = filtradas.map(s => {
      const pct = s.total_questoes > 0 ? ((s.acertos/s.total_questoes)*100).toFixed(1) : null;
      const assuntosHtml = s.assuntos && s.assuntos.length
        ? s.assuntos.map(a => `<span class="assunto-link-chip" data-id="${a.id}" data-nome="${a.nome}">${a.nome}</span>`).join('')
        : '<span class="text-muted">—</span>';
      return `<div class="sessao-card">
        <div class="sessao-card-header">
          <div class="sessao-card-info">
            <div class="sessao-card-data">${formatDate(s.data)}</div>
            <div class="sessao-card-disc">${s.disciplina_nome}</div>
            <div class="sessao-card-assuntos">${assuntosHtml}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;flex-shrink:0;flex-wrap:wrap">
            <span class="acerto-badge acerto-none">${s.tipo}</span>
            ${s.total_questoes > 0 ? `<span class="text-small">${s.total_questoes}q</span>` : ''}
            ${acertoBadge(pct)}
            ${btnEditar('data-id="'+s.id+'" class="edit-estudo-btn"')}
            ${btnApagar('data-id="'+s.id+'" class="del-estudo-btn"')}
          </div>
        </div>
        ${s.observacoes ? `<div class="sessao-card-obs">💬 ${s.observacoes}</div>` : ''}
      </div>`;
    }).join('');

    qsa('.assunto-link-chip', listEl).forEach(chip => {
      chip.addEventListener('click', e => {
        e.stopPropagation();
        openHistoricoAssuntoModal(chip.dataset.id, chip.dataset.nome);
      });
    });

    qsa('.edit-estudo-btn', listEl).forEach(btn => {
      btn.addEventListener('click', () => openEditEstudoModal(btn.dataset.id, todasDiscsLocal, todosConcsLocal, bancasTodasLocal, loadHistorico));
    });

    qsa('.del-estudo-btn', listEl).forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Apagar este estudo?')) return;
        await api.delete(`/api/sessoes/${btn.dataset.id}`);
        showToast('Estudo apagado'); loadHistorico();
      });
    });
  }

  ['#rh-disciplina','#rh-tipo','#rh-de','#rh-ate'].forEach(sel => {
    qs(sel, container)?.addEventListener('change', loadHistorico);
  });

  aplicarFiltroRapido('semana');
}

// Modal de histórico por assunto
async function openHistoricoAssuntoModal(assuntoId, assuntoNome) {
  openModal(`Histórico: ${assuntoNome}`, `<div style="padding:8px 0;color:var(--text-3);font-size:0.84rem">Carregando...</div>`);
  try {
    const sessoes = await api.get('/api/sessoes?assunto_id=' + assuntoId);
    if (!sessoes.length) {
      qs('#modal-body').innerHTML = '<div class="empty-state"><div class="empty-icon">◷</div><p>Nenhum estudo registrado para este assunto.</p></div>';
      return;
    }
    const totalQ = sessoes.reduce((s,x) => s + (x.total_questoes||0), 0);
    const totalA = sessoes.reduce((s,x) => s + (x.acertos||0), 0);
    const pctGeral = totalQ > 0 ? ((totalA/totalQ)*100).toFixed(1) : null;
    qs('#modal-body').innerHTML = `
      <div style="display:flex;gap:16px;margin-bottom:16px;flex-wrap:wrap">
        <div class="metric-card" style="flex:1;min-width:100px"><div class="metric-label">Total questões</div><div class="metric-value" style="font-size:1.4rem">${totalQ}</div></div>
        <div class="metric-card" style="flex:1;min-width:100px"><div class="metric-label">Acerto geral</div><div class="metric-value" style="font-size:1.4rem">${pctGeral ? pctGeral + '%' : '—'}</div></div>
        <div class="metric-card" style="flex:1;min-width:100px"><div class="metric-label">Estudos</div><div class="metric-value" style="font-size:1.4rem">${sessoes.length}</div></div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Data</th><th>Disciplina</th><th>Tipo</th><th class="td-right">Questões</th><th class="td-right">Acerto</th></tr></thead>
        <tbody>
          ${sessoes.map(s => {
            const pct = s.total_questoes > 0 ? ((s.acertos/s.total_questoes)*100).toFixed(1) : null;
            return `<tr>
              <td>${formatDate(s.data)}</td>
              <td class="fw-600">${s.disciplina_nome}</td>
              <td><span class="acerto-badge acerto-none">${s.tipo}</span></td>
              <td class="td-right">${s.total_questoes||0}</td>
              <td class="td-right">${acertoBadge(pct)}</td>
            </tr>
            ${s.observacoes ? `<tr><td colspan="5"><div class="hist-obs-box" style="margin:0 0 6px">💬 ${s.observacoes}</div></td></tr>` : ''}`;
          }).join('')}
        </tbody>
      </table></div>
    `;
  } catch(e) {
    qs('#modal-body').innerHTML = '<p class="text-muted">Erro ao carregar histórico.</p>';
  }
}

// Modal de editar estudo
async function openEditEstudoModal(sessaoId, disciplinas, concursos, todasBancas, onSave) {
  const s = await api.get(`/api/sessoes/${sessaoId}`);
  if (!s) return;

  const assuntos = s.disciplina_id ? await api.get(`/api/assuntos?disciplina_id=${s.disciplina_id}`) : [];
  const selectedIds = s.assuntos ? s.assuntos.map(a => a.id) : [];
  const msId = 'edit-estudo-ms';
  const { html: msHtml } = buildAssuntosMultiSelect(assuntos, selectedIds, msId);

  const bancaEhOutra = s.banca && !BANCAS_PADRAO.includes(s.banca) && s.banca !== '';

  openModal('Editar Estudo', `
    <div class="form-row">
      <div class="form-group"><label>Data *</label><input type="date" id="ee-data" value="${s.data}"></div>
      <div class="form-group"><label>Tipo *</label>
        <select id="ee-tipo">
          <option value="questoes" ${s.tipo==='questoes'?'selected':''}>Questões</option>
          <option value="teorico" ${s.tipo==='teorico'?'selected':''}>Teórico</option>
          <option value="revisao" ${s.tipo==='revisao'?'selected':''}>Revisão</option>
          <option value="simulado" ${s.tipo==='simulado'?'selected':''}>Simulado</option>
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Disciplina *</label>
        <select id="ee-disc">
          ${disciplinas.map(d => `<option value="${d.id}" ${d.id==s.disciplina_id?'selected':''}>${d.nome}</option>`).join('')}
        </select>
      </div>
      <div class="form-group"><label>Planejamento</label>
        <select id="ee-conc">
          <option value="">—</option>
          ${concursos.map(c => `<option value="${c.id}" ${c.id==s.concurso_id?'selected':''}>${c.nome}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-group"><label>Assuntos</label>${msHtml}</div>
    <div class="form-row-3">
      <div class="form-group"><label>Questões</label><input type="number" id="ee-total" value="${s.total_questoes||0}" min="0"></div>
      <div class="form-group"><label>Acertos</label><input type="number" id="ee-acertos" value="${s.acertos||0}" min="0"></div>
      <div class="form-group"><label>Banca</label>
        <select id="ee-banca">
          <option value="">—</option>
          ${BANCAS_PADRAO.map(b => `<option value="${b}" ${b===s.banca?'selected':''}>${b}</option>`).join('')}
          ${bancaEhOutra ? `<option value="${s.banca}" selected>${s.banca}</option>` : ''}
          <option value="__outra__">+ Outra banca...</option>
        </select>
        <input type="text" id="ee-banca-outra" class="${bancaEhOutra ? '' : 'hidden'}" value="${bancaEhOutra ? s.banca : ''}" style="margin-top:6px">
      </div>
    </div>
    <div class="form-group"><label>Observações</label><textarea id="ee-obs" style="min-height:80px">${s.observacoes||''}</textarea></div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-edit-estudo">Salvar</button>
    </div>
  `);

  qs('#ee-banca')?.addEventListener('change', () => {
    const outra = qs('#ee-banca-outra');
    outra.classList.toggle('hidden', qs('#ee-banca').value !== '__outra__');
    if (qs('#ee-banca').value === '__outra__') outra.focus();
  });

  qs('#save-edit-estudo').addEventListener('click', async () => {
    const banca = qs('#ee-banca').value === '__outra__' ? qs('#ee-banca-outra').value.trim() : qs('#ee-banca').value;
    const assunto_ids = getMultiSelectValues(msId);
    await api.put(`/api/sessoes/${sessaoId}`, {
      data: qs('#ee-data').value,
      disciplina_id: qs('#ee-disc').value,
      concurso_id: qs('#ee-conc').value || null,
      tipo: qs('#ee-tipo').value,
      total_questoes: parseInt(qs('#ee-total').value)||0,
      acertos: parseInt(qs('#ee-acertos').value)||0,
      banca,
      observacoes: qs('#ee-obs').value.trim(),
      assunto_ids,
      nota_liquida: s.nota_liquida,
      ranking: s.ranking,
      controle_emocional: s.controle_emocional,
      gestao_tempo: s.gestao_tempo
    });
    closeModal();
    showToast('Estudo atualizado!', 'success');
    if (onSave) onSave();
  });
}

// Alias usado por historico.js
function openEditSessaoModal(sessaoId, disciplinas, concursos, todasBancas, onSave) {
  return openEditEstudoModal(sessaoId, disciplinas, concursos, todasBancas, onSave);
}
