// ── DASHBOARD PAGE ────────────────────────────────────────────────────────────

async function renderDashboard(container) {
  const [planejamentos, planAtivoId] = await Promise.all([
    api.get('/api/planejamentos'),
    getConcursoAlvo()
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Dashboard</div><div class="page-subtitle">Visão geral do seu desempenho</div></div>
    </div>
    <div class="dash-layout">
      <div class="dash-main">
        <div class="concurso-foco-card" id="foco-card">
          <div class="concurso-foco-top">
            <select class="concurso-foco-selector" id="foco-selector">
              <option value="">Selecione um planejamento...</option>
              ${planejamentos.map(p => `<option value="${p.id}" ${String(p.id)===String(planAtivoId)?'selected':''}>${p.nome}</option>`).join('')}
            </select>
          </div>
          <div id="foco-info"></div>
        </div>
        <div id="dash-metrics" class="metrics-grid"></div>
        <div class="filters-bar" id="dash-filters">
          <div class="filter-group"><label>Planejamento</label>
            <select id="f-concurso">
              <option value="">Todos</option>
              ${planejamentos.map(p => `<option value="${p.id}" ${String(p.id)===String(planAtivoId)?'selected':''}>${p.nome}</option>`).join('')}
            </select>
          </div>
          <div class="filter-group"><label>Banca</label><select id="f-banca"><option value="">Todas</option></select></div>
          <div class="filter-group"><label>De</label><input type="date" id="f-data-inicio"></div>
          <div class="filter-group"><label>Até</label><input type="date" id="f-data-fim"></div>
        </div>
        <div class="card">
          <div class="table-wrap">
            <table id="dash-table">
              <thead><tr>
                <th class="sortable" data-col="nome">Disciplina</th>
                <th class="sortable" data-col="prova">Prova</th>
                <th class="sortable td-right" data-col="pct_peso">Peso</th>
                <th class="sortable td-right" data-col="pct_acerto">% Acerto</th>
                <th class="sortable td-right" data-col="total_questoes">Questões</th>
                <th class="sortable td-right" data-col="pct_avanco">Avanço</th>
              </tr></thead>
              <tbody id="dash-tbody"></tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="dash-sidebar">
        <div class="resumo-semanal-card" id="resumo-semanal">
          <div class="resumo-semanal-title">Resumo Semanal</div>
          <div id="resumo-semanal-body"><div style="color:var(--text-3);font-size:0.82rem;text-align:center;padding:20px">Carregando...</div></div>
        </div>
      </div>
    </div>
  `;

  // Bancas
  try {
    const bancas = await api.get('/api/bancas');
    const fBanca = qs('#f-banca', container);
    BANCAS_PADRAO.concat(bancas.filter(b => !BANCAS_PADRAO.includes(b))).forEach(b => {
      fBanca.innerHTML += `<option value="${b}">${b}</option>`;
    });
  } catch(e) {}

  let currentStats = null;
  let sortCol = 'nome', sortDir = 1;
  let provaFilter = null;

  const focoSel = qs('#foco-selector', container);
  const fConc = qs('#f-concurso', container);

  async function renderFocoInfo(planId) {
    const infoDiv = qs('#foco-info', container);
    if (!planId) {
      infoDiv.innerHTML = '<div style="margin-top:12px;opacity:0.6;font-size:0.88rem">Selecione um planejamento para ver o resumo</div>';
      return;
    }
    const plan = planejamentos.find(p => String(p.id) === String(planId));
    if (!plan) return;

    const stats = await api.get('/api/stats/dashboard-plan?plan_id=' + planId);
    const dias = diasFaltando(plan.data_prova);
    const diasStr = dias === null ? 'Sem data' : dias > 0 ? `${dias} dias` : dias === 0 ? 'Hoje!' : 'Encerrado';

    resetProvaColors();
    // Pega provas únicas das disciplinas
    const provas = [...new Set(stats.disciplinas.map(d => d.prova).filter(Boolean))];

    infoDiv.innerHTML = `
      <div class="concurso-foco-nome">${plan.nome}</div>
      <div class="concurso-foco-meta">${plan.data_prova ? formatDate(plan.data_prova) : ''}</div>
      <div class="concurso-foco-stats">
        <div class="foco-stat"><div class="foco-stat-val">${diasStr}</div><div class="foco-stat-label">Faltando</div></div>
        <div class="foco-stat"><div class="foco-stat-val">${stats.pct_acerto_geral ? stats.pct_acerto_geral+'%' : '—'}</div><div class="foco-stat-label">Acerto geral</div></div>
        <div class="foco-stat"><div class="foco-stat-val">${stats.pct_avanco_edital ? stats.pct_avanco_edital+'%' : '—'}</div><div class="foco-stat-label">Avanço</div></div>
        <div class="foco-stat"><div class="foco-stat-val">${stats.disciplinas_na_meta}/${stats.total_disciplinas}</div><div class="foco-stat-label">Na meta</div></div>
      </div>
      ${provas.length > 0 ? `<div class="foco-provas">${provas.map(p => `<button class="foco-prova-tag-btn" data-prova="${p}">${p}</button>`).join('')}</div>` : ''}
    `;

    qsa('.foco-prova-tag-btn', infoDiv).forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.prova;
        provaFilter = provaFilter === p ? null : p;
        qsa('.foco-prova-tag-btn', infoDiv).forEach(b => b.classList.toggle('active', b.dataset.prova === provaFilter));
        renderTabela();
      });
    });
  }

  async function loadTabela() {
    const plan_id = fConc.value;
    const banca = fBanca.value;
    const data_inicio = qs('#f-data-inicio', container).value;
    const data_fim = qs('#f-data-fim', container).value;

    const url = '/api/stats/dashboard-plan' + qs_params({ plan_id, banca, data_inicio, data_fim });
    currentStats = await api.get(url);

    const s = currentStats;
    qs('#dash-metrics', container).innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Total de Questões ${tooltip('Total respondido em questões e simulados')}</div>
        <div class="metric-value">${(s.total_questoes||0).toLocaleString('pt-BR')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">% Acerto Geral ${tooltip('Acerto consolidado de todas as disciplinas')}</div>
        <div class="metric-value">${s.pct_acerto_geral ? s.pct_acerto_geral+'%' : '—'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Disciplinas na Meta ${tooltip('Disciplinas que atingiram 75% de acerto')}</div>
        <div class="metric-value">${s.disciplinas_na_meta}/${s.total_disciplinas}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Avanço no Edital ${tooltip('% das questões do edital que você já praticou')}</div>
        <div class="metric-value">${s.pct_avanco_edital ? s.pct_avanco_edital+'%' : '—'}</div>
      </div>
    `;
    renderTabela();
  }

  function renderTabela() {
    if (!currentStats) return;
    let disciplinas = [...(currentStats.disciplinas||[])];
    if (provaFilter) disciplinas = disciplinas.filter(d => d.prova === provaFilter);

    disciplinas.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va===null||va===undefined) va = sortDir>0 ? Infinity : -Infinity;
      if (vb===null||vb===undefined) vb = sortDir>0 ? Infinity : -Infinity;
      if (typeof va==='string') return va.localeCompare(vb)*sortDir;
      return (parseFloat(va)-parseFloat(vb))*sortDir;
    });

    qsa('thead th', container).forEach(th => th.classList.remove('sort-asc','sort-desc'));
    const activeTh = qs(`thead th[data-col="${sortCol}"]`, container);
    if (activeTh) activeTh.classList.add(sortDir>0?'sort-asc':'sort-desc');

    const tbody = qs('#dash-tbody', container);
    if (!disciplinas.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">Nenhum dado ainda.</td></tr>`;
      return;
    }
    tbody.innerHTML = disciplinas.map(d => `
      <tr class="clickable" data-id="${d.id}">
        <td class="fw-600">${d.nome}</td>
        <td>${d.prova ? provaTag(d.prova) : '<span class="text-muted">—</span>'}</td>
        <td class="td-right text-muted">${d.pct_peso ? d.pct_peso+'%' : '—'}</td>
        <td class="td-right">${acertoBadge(d.pct_acerto)}</td>
        <td class="td-right">${(d.total_questoes||0).toLocaleString('pt-BR')}</td>
        <td class="td-right">${d.pct_avanco ? d.pct_avanco+'%' : '—'}</td>
      </tr>`).join('');

    qsa('#dash-tbody tr.clickable', container).forEach(row => {
      row.addEventListener('click', () => window._app.navigate('disciplina-detalhe', { id: row.dataset.id, plan_id: fConc.value }));
    });
  }

  async function loadResumoSemanal() {
    try {
      const s = await api.get('/api/stats/semana');
      const semNum = getWeekNumber(new Date());
      const pct = s.tarefas_ciclo > 0 ? Math.round((s.tarefas_ciclo_feitas/s.tarefas_ciclo)*100) : 0;
      qs('#resumo-semanal-body', container).innerHTML = `
        <div class="resumo-sem-semana">Semana ${semNum}</div>
        <div class="resumo-sem-item">
          <div class="resumo-sem-label">Tarefas (ciclo)</div>
          <div class="resumo-sem-val">${s.tarefas_ciclo_feitas} <span class="resumo-sem-total">/ ${s.tarefas_ciclo}</span></div>
          <div class="resumo-sem-bar"><div class="resumo-sem-bar-fill" style="width:${pct}%"></div></div>
        </div>
        <div class="resumo-sem-item">
          <div class="resumo-sem-label">Questões feitas</div>
          <div class="resumo-sem-val">${(s.questoes_feitas||0).toLocaleString('pt-BR')}</div>
        </div>
        <div class="resumo-sem-item">
          <div class="resumo-sem-label">Acertos</div>
          <div class="resumo-sem-val">${(s.acertos||0).toLocaleString('pt-BR')}</div>
        </div>
        <div class="resumo-sem-item resumo-sem-destaque">
          <div class="resumo-sem-label">Desempenho</div>
          <div class="resumo-sem-val-big ${acertoClass(s.pct_desempenho)}">${s.pct_desempenho ? s.pct_desempenho+'%' : '—'}</div>
        </div>
      `;
    } catch(e) {}
  }

  qsa('thead th.sortable', container).forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol===col) sortDir*=-1; else { sortCol=col; sortDir=1; }
      renderTabela();
    });
  });

  focoSel.addEventListener('change', async () => {
    const pid = focoSel.value;
    if (pid) { await setConcursoAlvo(pid); fConc.value = pid; }
    provaFilter = null;
    renderFocoInfo(pid||null);
    loadTabela();
  });

  ['#f-concurso','#f-banca','#f-data-inicio','#f-data-fim'].forEach(sel => {
    qs(sel, container)?.addEventListener('change', loadTabela);
  });

  if (planAtivoId) { renderFocoInfo(planAtivoId); }
  else { renderFocoInfo(null); }
  loadTabela();
  loadResumoSemanal();
}
