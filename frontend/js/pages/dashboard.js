// ── DASHBOARD PAGE ────────────────────────────────────────────────────────────

async function renderDashboard(container) {
  const [planejamentos, planAtivoId] = await Promise.all([
    api.get('/api/planejamentos'),
    getConcursoAlvo()
  ]);

  container.innerHTML = '';

  // ── HEADER ───────────────────────────────────────────────────────────────────
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `<div><div class="page-title">Dashboard</div><div class="page-subtitle">Visão geral do seu desempenho</div></div>`;
  container.appendChild(header);

  // ── LAYOUT ───────────────────────────────────────────────────────────────────
  const layout = document.createElement('div');
  layout.className = 'dash-layout';
  container.appendChild(layout);

  const main = document.createElement('div');
  main.className = 'dash-main';
  layout.appendChild(main);

  const sidebar = document.createElement('div');
  sidebar.className = 'dash-sidebar';
  layout.appendChild(sidebar);

  // ── FOCO CARD (branco, compacto) ─────────────────────────────────────────────
  const focoCard = document.createElement('div');
  focoCard.className = 'dash-foco-card';
  main.appendChild(focoCard);

  // Selector
  const focoTop = document.createElement('div');
  focoTop.className = 'dash-foco-top';
  const focoSel = document.createElement('select');
  focoSel.className = 'dash-foco-selector';
  const optNone = document.createElement('option');
  optNone.value = '';
  optNone.textContent = 'Selecione um planejamento...';
  focoSel.appendChild(optNone);
  planejamentos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    if (String(p.id) === String(planAtivoId)) opt.selected = true;
    focoSel.appendChild(opt);
  });
  focoTop.appendChild(focoSel);
  focoCard.appendChild(focoTop);

  const focoInfo = document.createElement('div');
  focoInfo.id = 'foco-info';
  focoCard.appendChild(focoInfo);

  // ── METRICS GRID ─────────────────────────────────────────────────────────────
  const metricsGrid = document.createElement('div');
  metricsGrid.className = 'metrics-grid';
  main.appendChild(metricsGrid);

  // ── FILTERS BAR ──────────────────────────────────────────────────────────────
  const filtersBar = document.createElement('div');
  filtersBar.className = 'filters-bar';

  const fConcursoGrp = document.createElement('div');
  fConcursoGrp.className = 'filter-group';
  fConcursoGrp.innerHTML = '<label>Planejamento</label>';
  const fConc = document.createElement('select');
  fConc.id = 'f-concurso';
  const optAllPlan = document.createElement('option');
  optAllPlan.value = '';
  optAllPlan.textContent = 'Todos';
  fConc.appendChild(optAllPlan);
  planejamentos.forEach(p => {
    const opt = document.createElement('option');
    opt.value = p.id;
    opt.textContent = p.nome;
    if (String(p.id) === String(planAtivoId)) opt.selected = true;
    fConc.appendChild(opt);
  });
  fConcursoGrp.appendChild(fConc);
  filtersBar.appendChild(fConcursoGrp);

  const fBancaGrp = document.createElement('div');
  fBancaGrp.className = 'filter-group';
  fBancaGrp.innerHTML = '<label>Banca</label>';
  const fBanca = document.createElement('select');
  fBanca.id = 'f-banca';
  fBanca.innerHTML = '<option value="">Todas</option>';
  fBancaGrp.appendChild(fBanca);
  filtersBar.appendChild(fBancaGrp);

  const fInicioGrp = document.createElement('div');
  fInicioGrp.className = 'filter-group';
  fInicioGrp.innerHTML = '<label>De</label>';
  const fInicio = document.createElement('input');
  fInicio.type = 'date';
  fInicio.id = 'f-data-inicio';
  fInicioGrp.appendChild(fInicio);
  filtersBar.appendChild(fInicioGrp);

  const fFimGrp = document.createElement('div');
  fFimGrp.className = 'filter-group';
  fFimGrp.innerHTML = '<label>Até</label>';
  const fFim = document.createElement('input');
  fFim.type = 'date';
  fFim.id = 'f-data-fim';
  fFimGrp.appendChild(fFim);
  filtersBar.appendChild(fFimGrp);

  main.appendChild(filtersBar);

  // ── TABELA COM TOGGLE ─────────────────────────────────────────────────────────
  const tableCard = document.createElement('div');
  tableCard.className = 'card';
  main.appendChild(tableCard);

  const tableCardHeader = document.createElement('div');
  tableCardHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px 0;flex-wrap:wrap;gap:8px;';

  const tableTitle = document.createElement('div');
  tableTitle.style.cssText = 'font-family:var(--font-display);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);';
  tableTitle.textContent = 'Disciplinas';

  // Toggle Por prova / Consolidado
  const toggleWrap = document.createElement('div');
  toggleWrap.className = 'modo-toggle';
  const btnConsolidado = document.createElement('button');
  btnConsolidado.className = 'modo-toggle-btn active';
  btnConsolidado.textContent = 'Consolidado';
  const btnPorProva = document.createElement('button');
  btnPorProva.className = 'modo-toggle-btn';
  btnPorProva.textContent = 'Por prova';
  toggleWrap.append(btnConsolidado, btnPorProva);

  tableCardHeader.append(tableTitle, toggleWrap);
  tableCard.appendChild(tableCardHeader);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  const table = document.createElement('table');
  table.id = 'dash-table';
  table.innerHTML = `<thead><tr>
    <th class="sortable" data-col="nome">Disciplina</th>
    <th class="sortable" data-col="prova">Prova</th>
    <th class="sortable td-right" data-col="pct_peso">Peso</th>
    <th class="sortable td-right" data-col="pct_acerto">% Acerto</th>
    <th class="sortable td-right" data-col="total_questoes">Questões</th>
    <th class="sortable td-right" data-col="pct_avanco">Avanço</th>
  </tr></thead>`;
  const tbody = document.createElement('tbody');
  tbody.id = 'dash-tbody';
  table.appendChild(tbody);
  tableWrap.appendChild(table);
  tableCard.appendChild(tableWrap);

  // ── SIDEBAR ───────────────────────────────────────────────────────────────────
  buildSidebar(sidebar);

  // ── STATE ─────────────────────────────────────────────────────────────────────
  let currentStats = null;
  let sortCol = 'nome', sortDir = 1;
  let provaFilter = null;
  let modoTabela = 'consolidado'; // 'consolidado' | 'prova'

  // Bancas
  try {
    const bancasResp = await api.get('/api/bancas');
    bancasResp.forEach(b => {
      const opt = document.createElement('option');
      opt.value = b.nome;
      opt.textContent = b.nome;
      fBanca.appendChild(opt);
    });
  } catch(e) {}

  // ── FOCO INFO ─────────────────────────────────────────────────────────────────
  async function renderFocoInfo(planId) {
    if (!planId) {
      focoInfo.innerHTML = '<div style="padding:10px 0;opacity:0.6;font-size:0.88rem">Selecione um planejamento para ver o resumo</div>';
      return;
    }
    const plan = planejamentos.find(p => String(p.id) === String(planId));
    if (!plan) return;

    const stats = await api.get('/api/stats/dashboard-plan?plan_id=' + planId);
    const semanas = semanasRestantes(plan.data_prova);
    const semStr = semanas === null ? 'Sem data'
      : semanas > 0 ? `${semanas} sem.`
      : semanas === 0 ? 'Esta semana!'
      : 'Encerrado';

    resetProvaColors();
    const provas = [...new Set(stats.disciplinas.map(d => d.prova).filter(Boolean))];

    focoInfo.innerHTML = '';

    const infoRow = document.createElement('div');
    infoRow.style.cssText = 'display:flex;align-items:baseline;gap:10px;flex-wrap:wrap;margin-top:8px;';

    const nomePlan = document.createElement('span');
    nomePlan.className = 'dash-foco-nome';
    nomePlan.textContent = plan.nome;

    const dataPlan = document.createElement('span');
    dataPlan.className = 'dash-foco-data';
    dataPlan.textContent = plan.data_prova ? formatDate(plan.data_prova) : '';

    infoRow.append(nomePlan, dataPlan);
    focoInfo.appendChild(infoRow);

    const statsRow = document.createElement('div');
    statsRow.className = 'dash-foco-stats';
    [
      { val: semStr, label: 'Faltando' },
      { val: stats.pct_acerto_geral ? stats.pct_acerto_geral + '%' : '—', label: 'Acerto geral' },
      { val: stats.pct_avanco_edital ? stats.pct_avanco_edital + '%' : '—', label: 'Avanço edital' },
      { val: `${stats.disciplinas_na_meta}/${stats.total_disciplinas}`, label: 'Na meta' },
    ].forEach(s => {
      const item = document.createElement('div');
      item.className = 'dash-foco-stat';
      const val = document.createElement('div');
      val.className = 'dash-foco-stat-val';
      val.textContent = s.val;
      const lbl = document.createElement('div');
      lbl.className = 'dash-foco-stat-label';
      lbl.textContent = s.label;
      item.append(val, lbl);
      statsRow.appendChild(item);
    });
    focoInfo.appendChild(statsRow);

    if (provas.length > 0) {
      const provasRow = document.createElement('div');
      provasRow.className = 'foco-provas';
      provas.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'foco-prova-tag-btn';
        btn.dataset.prova = p;
        btn.textContent = p;
        btn.addEventListener('click', () => {
          provaFilter = provaFilter === p ? null : p;
          provasRow.querySelectorAll('.foco-prova-tag-btn').forEach(b => b.classList.toggle('active', b.dataset.prova === provaFilter));
          renderTabela();
        });
        provasRow.appendChild(btn);
      });
      focoInfo.appendChild(provasRow);
    }
  }

  // ── LOAD TABELA ───────────────────────────────────────────────────────────────
  async function loadTabela() {
    const plan_id = fConc.value;
    const banca = fBanca.value;
    const data_inicio = fInicio.value;
    const data_fim = fFim.value;
    const url = '/api/stats/dashboard-plan' + qs_params({ plan_id, banca, data_inicio, data_fim });
    currentStats = await api.get(url);

    const s = currentStats;
    metricsGrid.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Total de Questões ${tooltip('Total respondido em questões e simulados')}</div>
        <div class="metric-value">${(s.total_questoes||0).toLocaleString('pt-BR')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">% Acerto Geral ${tooltip('Acerto consolidado de todas as disciplinas')}</div>
        <div class="metric-value">${s.pct_acerto_geral ? s.pct_acerto_geral+'%' : '—'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Disciplinas na Meta ${tooltip('Disciplinas que atingiram a meta de acerto')}</div>
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
    let disciplinas = [...(currentStats.disciplinas || [])];
    if (provaFilter) disciplinas = disciplinas.filter(d => d.prova === provaFilter);

    disciplinas.sort((a, b) => {
      let va = a[sortCol], vb = b[sortCol];
      if (va === null || va === undefined) va = sortDir > 0 ? Infinity : -Infinity;
      if (vb === null || vb === undefined) vb = sortDir > 0 ? Infinity : -Infinity;
      if (typeof va === 'string') return va.localeCompare(vb) * sortDir;
      return (parseFloat(va) - parseFloat(vb)) * sortDir;
    });

    table.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
    const activeTh = table.querySelector(`thead th[data-col="${sortCol}"]`);
    if (activeTh) activeTh.classList.add(sortDir > 0 ? 'sort-asc' : 'sort-desc');

    tbody.innerHTML = '';
    if (!disciplinas.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:32px;color:var(--text-3)">Nenhum dado ainda.</td></tr>`;
      return;
    }

    if (modoTabela === 'prova') {
      // Agrupado por prova
      const provas = [...new Set(disciplinas.map(d => d.prova || '—'))];
      provas.forEach(prova => {
        const grupo = disciplinas.filter(d => (d.prova || '—') === prova);
        const groupHeader = document.createElement('tr');
        groupHeader.className = 'table-group-header';
        groupHeader.innerHTML = `<td colspan="6" style="background:var(--primary-bg);color:var(--primary);font-weight:700;font-family:var(--font-display);font-size:0.78rem;padding:7px 12px;letter-spacing:0.04em;">${provaTag(prova !== '—' ? prova : '')} ${prova}</td>`;
        tbody.appendChild(groupHeader);
        grupo.forEach(d => tbody.appendChild(buildDiscRow(d)));
      });
    } else {
      disciplinas.forEach(d => tbody.appendChild(buildDiscRow(d)));
    }
  }

  function buildDiscRow(d) {
    const tr = document.createElement('tr');
    tr.className = 'clickable';
    tr.dataset.id = d.id;
    tr.innerHTML = `
      <td class="fw-600">${d.nome}</td>
      <td>${d.prova ? provaTag(d.prova) : '<span class="text-muted">—</span>'}</td>
      <td class="td-right text-muted">${d.pct_peso ? d.pct_peso + '%' : '—'}</td>
      <td class="td-right">${acertoBadge(d.pct_acerto)}</td>
      <td class="td-right">${(d.total_questoes || 0).toLocaleString('pt-BR')}</td>
      <td class="td-right">${d.pct_avanco ? d.pct_avanco + '%' : '—'}</td>
    `;
    tr.addEventListener('click', () => window._app.navigate('disciplina-detalhe', { id: d.id, plan_id: fConc.value }));
    return tr;
  }

  // ── SIDEBAR BUILDER ───────────────────────────────────────────────────────────
  async function buildSidebar(el) {
    el.innerHTML = '';

    // Esta semana card
    const semCard = document.createElement('div');
    semCard.className = 'dash-sem-card';

    const semTitle = document.createElement('div');
    semTitle.className = 'dash-sem-title';
    semTitle.textContent = 'Esta semana';
    semCard.appendChild(semTitle);

    const semBody = document.createElement('div');
    semBody.className = 'dash-sem-body';
    semBody.textContent = 'Carregando...';
    semCard.appendChild(semBody);

    el.appendChild(semCard);

    // Sequência card
    const seqCard = document.createElement('div');
    seqCard.className = 'dash-seq-card';
    el.appendChild(seqCard);

    // Mini gráfico card
    const chartCard = document.createElement('div');
    chartCard.className = 'dash-chart-card';
    const chartTitle = document.createElement('div');
    chartTitle.className = 'dash-sem-title';
    chartTitle.textContent = 'Últimos 30 dias';
    chartCard.appendChild(chartTitle);
    const chartArea = document.createElement('div');
    chartArea.id = 'dash-mini-chart';
    chartCard.appendChild(chartArea);
    el.appendChild(chartCard);

    try {
      const [semStats, atv] = await Promise.all([
        api.get('/api/stats/semana'),
        api.get('/api/stats/atividade'),
      ]);

      // Esta semana
      const pct = semStats.tarefas_ciclo > 0 ? Math.round((semStats.tarefas_ciclo_feitas / semStats.tarefas_ciclo) * 100) : 0;
      semBody.innerHTML = '';
      [
        { label: 'Tarefas ciclo', val: `${semStats.tarefas_ciclo_feitas}/${semStats.tarefas_ciclo}`, bar: pct },
        { label: 'Questões', val: (semStats.questoes_feitas || 0).toLocaleString('pt-BR') },
        { label: 'Desempenho', val: semStats.pct_desempenho ? semStats.pct_desempenho + '%' : '—', highlight: true },
      ].forEach(item => {
        const row = document.createElement('div');
        row.className = 'dash-sem-row';
        const lbl = document.createElement('span');
        lbl.className = 'dash-sem-row-label';
        lbl.textContent = item.label;
        const val = document.createElement('span');
        val.className = 'dash-sem-row-val' + (item.highlight ? ' ' + acertoClass(semStats.pct_desempenho) : '');
        val.textContent = item.val;
        row.append(lbl, val);
        semBody.appendChild(row);
        if (item.bar !== undefined) {
          const barWrap = document.createElement('div');
          barWrap.className = 'dash-sem-bar';
          const barFill = document.createElement('div');
          barFill.className = 'dash-sem-bar-fill';
          barFill.style.width = item.bar + '%';
          barWrap.appendChild(barFill);
          semBody.appendChild(barWrap);
        }
      });

      // Sequência
      const streak = atv.streak || 0;
      seqCard.innerHTML = '';
      const seqNum = document.createElement('div');
      seqNum.className = 'dash-seq-num';
      seqNum.textContent = streak;
      const seqLbl = document.createElement('div');
      seqLbl.className = 'dash-seq-label';
      seqLbl.textContent = `dia${streak !== 1 ? 's' : ''} seguidos`;
      const seqSublbl = document.createElement('div');
      seqSublbl.className = 'dash-seq-sublabel';
      seqSublbl.textContent = streak > 0 ? 'Continue assim! 🔥' : 'Estude hoje para começar uma sequência';
      seqCard.append(seqNum, seqLbl, seqSublbl);

      // Mini gráfico (últimos 30 dias)
      chartArea.appendChild(buildMiniChart(atv.dias));

    } catch(e) {
      semBody.textContent = 'Erro ao carregar.';
    }
  }

  function buildMiniChart(dias) {
    const W = 180, H = 60, PAD = 4;
    const n = 30;
    // Preenche array dos últimos 30 dias
    const hoje = todayISO();
    const arr = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(hoje + 'T00:00:00');
      d.setDate(d.getDate() - i);
      const iso = d.toISOString().slice(0, 10);
      const entry = dias.find(r => r.data === iso);
      arr.push(entry ? (entry.questoes || 0) : 0);
    }

    const maxVal = Math.max(...arr, 1);
    const barW = (W - PAD * 2) / n;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', W);
    svg.setAttribute('height', H);
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.style.cssText = 'display:block;margin-top:8px;';

    arr.forEach((val, idx) => {
      const barH = val > 0 ? Math.max(3, ((val / maxVal) * (H - PAD * 2))) : 0;
      const x = PAD + idx * barW + 1;
      const y = H - PAD - barH;
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x);
      rect.setAttribute('y', y);
      rect.setAttribute('width', Math.max(1, barW - 2));
      rect.setAttribute('height', barH);
      rect.setAttribute('rx', '2');
      rect.setAttribute('fill', val > 0 ? 'var(--primary)' : 'var(--border)');
      rect.setAttribute('opacity', val > 0 ? '0.85' : '0.4');
      svg.appendChild(rect);
    });

    return svg;
  }

  // ── EVENT BINDINGS ────────────────────────────────────────────────────────────
  table.querySelectorAll('thead th.sortable').forEach(th => {
    th.addEventListener('click', () => {
      const col = th.dataset.col;
      if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
      renderTabela();
    });
  });

  btnConsolidado.addEventListener('click', () => {
    modoTabela = 'consolidado';
    btnConsolidado.classList.add('active');
    btnPorProva.classList.remove('active');
    renderTabela();
  });

  btnPorProva.addEventListener('click', () => {
    modoTabela = 'prova';
    btnPorProva.classList.add('active');
    btnConsolidado.classList.remove('active');
    renderTabela();
  });

  focoSel.addEventListener('change', async () => {
    const pid = focoSel.value;
    if (pid) { await setConcursoAlvo(pid); fConc.value = pid; }
    provaFilter = null;
    renderFocoInfo(pid || null);
    loadTabela();
  });

  [fConc, fBanca, fInicio, fFim].forEach(el => el.addEventListener('change', loadTabela));

  // ── INIT ──────────────────────────────────────────────────────────────────────
  renderFocoInfo(planAtivoId || null);
  loadTabela();
}
