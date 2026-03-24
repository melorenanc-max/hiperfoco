// ── HISTÓRICO E ESTATÍSTICAS ──────────────────────────────────────────────────

async function renderHistorico(container) {
  const [concursos, disciplinas, bancasResp] = await Promise.all([
    api.get('/api/concursos'),
    api.get('/api/disciplinas'),
    api.get('/api/bancas'),
  ]);

  // Helpers para campos legados/novos
  const getQ   = s => s.questoes_feitas  ?? s.total_questoes  ?? 0;
  const getA   = s => s.questoes_acertadas ?? s.acertos       ?? 0;
  const getT   = s => s.tempo_gasto ?? 0;
  const getCF  = s => s.como_foi || s.observacoes || '';

  container.innerHTML = '';

  // ── HEADER ───────────────────────────────────────────────────────────────────
  const ph = document.createElement('div');
  ph.className = 'page-header';
  ph.innerHTML = `
    <div><div class="page-title">Histórico & Estatísticas</div>
    <div class="page-subtitle">Sessões de estudo e análise de desempenho</div></div>
    <button class="btn btn-danger btn-sm" id="btn-zerar-hist">🗑 Zerar histórico</button>
  `;
  container.appendChild(ph);

  // ── FILTERS ───────────────────────────────────────────────────────────────────
  const filtersBar = document.createElement('div');
  filtersBar.className = 'filters-bar';

  function makeFilter(label, id, inner) {
    const g = document.createElement('div');
    g.className = 'filter-group';
    g.innerHTML = `<label>${label}</label>`;
    inner.id = id;
    g.appendChild(inner);
    return g;
  }

  const fConcSelect = document.createElement('select');
  fConcSelect.innerHTML = `<option value="">Todos</option>` + concursos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('');

  const fDiscSelect = document.createElement('select');
  fDiscSelect.innerHTML = `<option value="">Todas</option>` + disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('');

  const fAssuntoSelect = document.createElement('select');
  fAssuntoSelect.innerHTML = '<option value="">Todos</option>';

  const fBancaSelect = document.createElement('select');
  fBancaSelect.innerHTML = `<option value="">Todas</option>` + bancasResp.map(b => `<option value="${b.nome}">${b.nome}</option>`).join('');

  const fTipoSelect = document.createElement('select');
  fTipoSelect.innerHTML = `<option value="">Todos</option><option value="questoes">Questões</option><option value="teoria">Teoria</option><option value="revisao">Revisão</option><option value="simulado">Simulado</option>`;

  const fInicioInput = document.createElement('input');
  fInicioInput.type = 'date';

  const fFimInput = document.createElement('input');
  fFimInput.type = 'date';

  filtersBar.appendChild(makeFilter('Concurso', 'h-concurso', fConcSelect));
  filtersBar.appendChild(makeFilter('Disciplina', 'h-disciplina', fDiscSelect));
  filtersBar.appendChild(makeFilter('Assunto', 'h-assunto', fAssuntoSelect));
  filtersBar.appendChild(makeFilter('Banca', 'h-banca', fBancaSelect));
  filtersBar.appendChild(makeFilter('Tipo', 'h-tipo', fTipoSelect));
  filtersBar.appendChild(makeFilter('De', 'h-data-inicio', fInicioInput));
  filtersBar.appendChild(makeFilter('Até', 'h-data-fim', fFimInput));
  container.appendChild(filtersBar);

  // ── 4 CARDS ───────────────────────────────────────────────────────────────────
  const cards4 = document.createElement('div');
  cards4.className = 'metrics-grid';
  container.appendChild(cards4);

  // ── TABS ─────────────────────────────────────────────────────────────────────
  const tabBar = document.createElement('div');
  tabBar.className = 'hist-tabs';

  const tabSessoes = document.createElement('button');
  tabSessoes.className = 'hist-tab active';
  tabSessoes.textContent = 'Sessões';
  const tabEstat = document.createElement('button');
  tabEstat.className = 'hist-tab';
  tabEstat.textContent = 'Estatísticas';
  tabBar.append(tabSessoes, tabEstat);
  container.appendChild(tabBar);

  const tabContent = document.createElement('div');
  container.appendChild(tabContent);

  // ── STATE ─────────────────────────────────────────────────────────────────────
  let allSessoes = [];
  let activeTab = 'sessoes';
  let sortCol = 'data', sortDir = -1;

  // ── LOAD ─────────────────────────────────────────────────────────────────────
  async function load() {
    const params = {
      concurso_id: fConcSelect.value,
      disciplina_id: fDiscSelect.value,
      assunto_id: fAssuntoSelect.value,
      banca: fBancaSelect.value,
      data_inicio: fInicioInput.value,
      data_fim: fFimInput.value,
    };
    if (fTipoSelect.value) params.tipo = fTipoSelect.value;

    allSessoes = await api.get('/api/sessoes' + qs_params(params));
    renderCards();
    renderTab();
  }

  // ── 4 CARDS ───────────────────────────────────────────────────────────────────
  function renderCards() {
    const total = allSessoes.length;
    const totalQ = allSessoes.reduce((s, x) => s + getQ(x), 0);
    const totalA = allSessoes.reduce((s, x) => s + getA(x), 0);
    const pctGeral = totalQ > 0 ? ((totalA / totalQ) * 100).toFixed(1) : null;
    const totalTempo = allSessoes.reduce((s, x) => s + getT(x), 0);
    const tempoStr = totalTempo >= 60
      ? `${Math.floor(totalTempo / 60)}h${totalTempo % 60 > 0 ? (totalTempo % 60) + 'min' : ''}`
      : totalTempo + 'min';

    cards4.innerHTML = `
      <div class="metric-card">
        <div class="metric-label">Sessões</div>
        <div class="metric-value">${total.toLocaleString('pt-BR')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total de Questões</div>
        <div class="metric-value">${totalQ.toLocaleString('pt-BR')}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">% Acerto Geral</div>
        <div class="metric-value">${pctGeral ? pctGeral + '%' : '—'}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Tempo Total</div>
        <div class="metric-value">${totalTempo > 0 ? tempoStr : '—'}</div>
      </div>
    `;
  }

  // ── TABS ─────────────────────────────────────────────────────────────────────
  function renderTab() {
    tabContent.innerHTML = '';
    if (activeTab === 'sessoes') renderSessoes();
    else renderEstatisticas();
  }

  tabSessoes.addEventListener('click', () => {
    activeTab = 'sessoes';
    tabSessoes.classList.add('active');
    tabEstat.classList.remove('active');
    renderTab();
  });
  tabEstat.addEventListener('click', () => {
    activeTab = 'estatisticas';
    tabEstat.classList.add('active');
    tabSessoes.classList.remove('active');
    renderTab();
  });

  // ── ABA SESSÕES: tabela flat ordenável ────────────────────────────────────────
  function renderSessoes() {
    if (!allSessoes.length) {
      tabContent.innerHTML = renderEmptyState('◷', 'Nenhum registro encontrado.');
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'card';

    const tableWrap = document.createElement('div');
    tableWrap.className = 'table-wrap';

    const table = document.createElement('table');
    table.innerHTML = `<thead><tr>
      <th class="sortable" data-col="data">Data</th>
      <th class="sortable" data-col="disciplina_nome">Disciplina</th>
      <th class="sortable" data-col="tipo">Tipo</th>
      <th class="sortable" data-col="banca">Banca</th>
      <th class="sortable td-right" data-col="q">Questões</th>
      <th class="sortable td-right" data-col="pct">Acerto</th>
      <th class="td-right sortable" data-col="tempo">Tempo</th>
      <th></th>
    </tr></thead>`;

    const tbody = document.createElement('tbody');

    function rebuildRows() {
      const sorted = [...allSessoes].sort((a, b) => {
        let va, vb;
        if (sortCol === 'q') { va = getQ(a); vb = getQ(b); }
        else if (sortCol === 'pct') {
          va = getQ(a) > 0 ? getA(a) / getQ(a) : -1;
          vb = getQ(b) > 0 ? getA(b) / getQ(b) : -1;
        }
        else if (sortCol === 'tempo') { va = getT(a); vb = getT(b); }
        else { va = a[sortCol] || ''; vb = b[sortCol] || ''; }
        if (typeof va === 'string') return va.localeCompare(vb) * sortDir;
        return (va - vb) * sortDir;
      });

      table.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
      const activeTh = table.querySelector(`thead th[data-col="${sortCol}"]`);
      if (activeTh) activeTh.classList.add(sortDir > 0 ? 'sort-asc' : 'sort-desc');

      tbody.innerHTML = '';
      sorted.forEach(s => {
        const q = getQ(s), a = getA(s), t = getT(s);
        const pct = q > 0 ? ((a / q) * 100).toFixed(1) : null;
        const tipoKey = (s.tipo || '').toLowerCase();
        const tipoCfg = TIPO_CONFIG[tipoKey] || { label: s.tipo || '—', color: '#9CA3AF', bg: '#F3F4F6' };

        const tr = document.createElement('tr');
        tr.style.cursor = 'pointer';
        tr.innerHTML = `
          <td>${formatDate(s.data)}</td>
          <td class="fw-600">${s.disciplina_nome || '—'}</td>
          <td><span style="font-size:0.78rem;font-weight:600;padding:2px 8px;border-radius:4px;color:${tipoCfg.color};background:${tipoCfg.bg}">${tipoCfg.label}</span></td>
          <td class="text-muted text-small">${s.banca || '—'}</td>
          <td class="td-right">${q > 0 ? q : '—'}</td>
          <td class="td-right">${acertoBadge(pct)}</td>
          <td class="td-right text-muted text-small">${t > 0 ? formatTempo(t) : '—'}</td>
          <td style="white-space:nowrap;text-align:right"></td>
        `;

        const actCell = tr.cells[tr.cells.length - 1];
        const btnEdit = document.createElement('button');
        btnEdit.className = 'btn-action btn-action-edit';
        btnEdit.title = 'Editar';
        btnEdit.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
        btnEdit.addEventListener('click', e => {
          e.stopPropagation();
          openEditSessaoModal(s.id, disciplinas, concursos, bancasResp.map(b => b.nome), load);
        });
        const btnDel = document.createElement('button');
        btnDel.className = 'btn-action btn-action-delete';
        btnDel.title = 'Apagar';
        btnDel.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
        btnDel.addEventListener('click', async e => {
          e.stopPropagation();
          if (!confirm('Apagar esta sessão?')) return;
          await api.delete(`/api/sessoes/${s.id}`);
          showToast('Sessão apagada');
          load();
        });
        actCell.append(btnEdit, btnDel);

        tr.addEventListener('click', e => {
          if (e.target.closest('.btn-action')) return;
          openDetalheModal(s);
        });

        tbody.appendChild(tr);
      });
    }

    table.addEventListener('click', e => {
      const th = e.target.closest('thead th.sortable');
      if (!th) return;
      const col = th.dataset.col;
      if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
      rebuildRows();
    });

    table.appendChild(tbody);
    tableWrap.appendChild(table);
    wrap.appendChild(tableWrap);
    tabContent.appendChild(wrap);

    rebuildRows();
  }

  // ── MODAL DETALHE SESSÃO ──────────────────────────────────────────────────────
  function openDetalheModal(s) {
    const q = getQ(s), a = getA(s), t = getT(s), cf = getCF(s);
    const pct = q > 0 ? ((a / q) * 100).toFixed(1) : null;

    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal-box';
    box.style.maxWidth = '480px';

    const h2 = document.createElement('h2');
    h2.className = 'modal-title';
    h2.textContent = s.disciplina_nome || 'Sessão';
    box.appendChild(h2);

    const meta = document.createElement('div');
    meta.style.cssText = 'display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:16px;';
    meta.innerHTML = `
      <span style="font-size:0.8rem;color:var(--text-3)">${formatDate(s.data)}</span>
      ${s.tipo ? `<span style="font-size:0.78rem;font-weight:600;padding:2px 8px;border-radius:4px;background:var(--primary-bg);color:var(--primary)">${s.tipo}</span>` : ''}
      ${s.banca ? `<span style="font-size:0.78rem;color:var(--text-2);background:var(--bg);padding:2px 8px;border-radius:4px;border:1px solid var(--border)">${s.banca}</span>` : ''}
      ${s.concurso_nome ? `<span style="font-size:0.78rem;color:var(--text-3)">${s.concurso_nome}</span>` : ''}
    `;
    box.appendChild(meta);

    const statsRow = document.createElement('div');
    statsRow.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;';
    [
      { label: 'Questões', val: q || '—' },
      { label: 'Acerto', val: pct ? pct + '%' : '—', badge: pct },
      { label: 'Tempo', val: t > 0 ? formatTempo(t) : '—' },
    ].forEach(item => {
      const d = document.createElement('div');
      d.style.cssText = 'background:var(--bg);border-radius:var(--radius-sm);padding:10px;text-align:center;';
      const v = document.createElement('div');
      v.style.cssText = 'font-family:var(--font-display);font-size:1.1rem;font-weight:700;';
      if (item.badge !== undefined) v.innerHTML = acertoBadge(item.badge);
      else v.textContent = item.val;
      const l = document.createElement('div');
      l.style.cssText = 'font-size:0.68rem;color:var(--text-3);text-transform:uppercase;letter-spacing:0.05em;margin-top:3px;';
      l.textContent = item.label;
      d.append(v, l);
      statsRow.appendChild(d);
    });
    box.appendChild(statsRow);

    if (s.assuntos && s.assuntos.length) {
      const assDiv = document.createElement('div');
      assDiv.style.cssText = 'margin-bottom:12px;';
      const assLabel = document.createElement('div');
      assLabel.style.cssText = 'font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-3);margin-bottom:6px;';
      assLabel.textContent = 'Assuntos';
      assDiv.appendChild(assLabel);
      const assList = document.createElement('div');
      assList.style.cssText = 'display:flex;flex-wrap:wrap;gap:4px;';
      s.assuntos.forEach(a => {
        const tag = document.createElement('span');
        tag.style.cssText = 'font-size:0.78rem;background:var(--bg);border:1px solid var(--border);padding:2px 8px;border-radius:4px;color:var(--text-2);';
        tag.textContent = (a.codigo ? a.codigo + ' ' : '') + a.nome;
        assList.appendChild(tag);
      });
      assDiv.appendChild(assList);
      box.appendChild(assDiv);
    }

    if (cf) {
      const cfDiv = document.createElement('div');
      cfDiv.style.cssText = 'background:var(--bg);border-radius:var(--radius-sm);padding:12px;margin-bottom:12px;';
      const cfLabel = document.createElement('div');
      cfLabel.style.cssText = 'font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-3);margin-bottom:6px;';
      cfLabel.textContent = 'Como foi';
      const cfText = document.createElement('p');
      cfText.style.cssText = 'font-size:0.84rem;color:var(--text-2);line-height:1.6;white-space:pre-wrap;';
      cfText.textContent = cf;
      cfDiv.append(cfLabel, cfText);
      box.appendChild(cfDiv);
    }

    const btnFechar = document.createElement('button');
    btnFechar.className = 'btn btn-outline';
    btnFechar.style.width = '100%';
    btnFechar.textContent = 'Fechar';
    btnFechar.addEventListener('click', () => modal.remove());
    box.appendChild(btnFechar);

    modal.appendChild(box);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    document.body.appendChild(modal);
  }

  // ── ABA ESTATÍSTICAS ─────────────────────────────────────────────────────────
  function renderEstatisticas() {
    if (!allSessoes.length) {
      tabContent.innerHTML = renderEmptyState('📊', 'Registre sessões de estudo para ver estatísticas.');
      return;
    }

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;flex-direction:column;gap:20px;';
    tabContent.appendChild(wrap);

    // Stats por disciplina
    const byDisc = {};
    allSessoes.forEach(s => {
      if (!byDisc[s.disciplina_id]) {
        const disc = disciplinas.find(d => d.id === s.disciplina_id);
        byDisc[s.disciplina_id] = {
          id: s.disciplina_id,
          nome: s.disciplina_nome || '—',
          meta: disc ? (disc.meta_acerto || 70) : 70,
          q: 0, a: 0, sessoes: 0, tempoTotal: 0,
        };
      }
      byDisc[s.disciplina_id].q += getQ(s);
      byDisc[s.disciplina_id].a += getA(s);
      byDisc[s.disciplina_id].sessoes++;
      byDisc[s.disciplina_id].tempoTotal += getT(s);
    });
    const discStats = Object.values(byDisc).sort((a, b) => b.q - a.q);

    // Linha de evolução (últimas 12 semanas)
    const evolCard = document.createElement('div');
    evolCard.className = 'card';
    evolCard.style.padding = '18px';
    const evolTitle = document.createElement('div');
    evolTitle.style.cssText = 'font-family:var(--font-display);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);margin-bottom:12px;';
    evolTitle.textContent = 'Evolução semanal — últimas 12 semanas';
    evolCard.appendChild(evolTitle);
    evolCard.appendChild(buildEvolucaoChart(allSessoes));
    wrap.appendChild(evolCard);

    // Radar SVG
    if (discStats.length >= 3) {
      const radarCard = document.createElement('div');
      radarCard.className = 'card';
      radarCard.style.cssText = 'padding:18px;display:flex;flex-direction:column;align-items:center;';
      const radarTitle = document.createElement('div');
      radarTitle.style.cssText = 'font-family:var(--font-display);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);margin-bottom:12px;align-self:flex-start;';
      radarTitle.textContent = 'Radar de desempenho por disciplina';
      radarCard.appendChild(radarTitle);
      radarCard.appendChild(buildRadarChart(discStats));
      wrap.appendChild(radarCard);
    }

    // Tabela por disciplina (expansível)
    const tabelaCard = document.createElement('div');
    tabelaCard.className = 'card';
    const tabelaHeader = document.createElement('div');
    tabelaHeader.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:14px 18px 0;margin-bottom:4px;';
    const tabelaTitle = document.createElement('div');
    tabelaTitle.style.cssText = 'font-family:var(--font-display);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);';
    tabelaTitle.textContent = 'Por disciplina';
    tabelaHeader.appendChild(tabelaTitle);
    tabelaCard.appendChild(tabelaHeader);
    discStats.forEach(d => tabelaCard.appendChild(buildDiscAccordionRow(d)));
    wrap.appendChild(tabelaCard);

    // Por banca (se há dados)
    const bancaStats = {};
    allSessoes.forEach(s => {
      const b = s.banca || 'Sem banca';
      if (!bancaStats[b]) bancaStats[b] = { q: 0, a: 0, sessoes: 0 };
      bancaStats[b].q += getQ(s);
      bancaStats[b].a += getA(s);
      bancaStats[b].sessoes++;
    });
    const bancaList = Object.entries(bancaStats).filter(([, v]) => v.q > 0).sort((a, b) => b[1].q - a[1].q);

    if (bancaList.length > 1) {
      const bancaCard = document.createElement('div');
      bancaCard.className = 'card';
      const bancaCardHeader = document.createElement('div');
      bancaCardHeader.style.cssText = 'padding:14px 18px 10px;';
      const bct = document.createElement('div');
      bct.style.cssText = 'font-family:var(--font-display);font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.07em;color:var(--text-3);margin-bottom:10px;';
      bct.textContent = 'Por banca';
      bancaCardHeader.appendChild(bct);
      const bancaTable = document.createElement('div');
      bancaTable.style.cssText = 'overflow-x:auto;';
      const bt = document.createElement('table');
      bt.innerHTML = `<thead><tr><th>Banca</th><th class="td-right">Questões</th><th class="td-right">Acerto</th><th class="td-right">Sessões</th></tr></thead>`;
      const btbody = document.createElement('tbody');
      bancaList.forEach(([banca, st]) => {
        const pct = st.q > 0 ? ((st.a / st.q) * 100).toFixed(1) : null;
        const tr = document.createElement('tr');
        tr.innerHTML = `<td class="fw-600">${banca}</td><td class="td-right">${st.q.toLocaleString('pt-BR')}</td><td class="td-right">${acertoBadge(pct)}</td><td class="td-right text-muted">${st.sessoes}</td>`;
        btbody.appendChild(tr);
      });
      bt.appendChild(btbody);
      bancaTable.appendChild(bt);
      bancaCardHeader.appendChild(bancaTable);
      bancaCard.appendChild(bancaCardHeader);
      wrap.appendChild(bancaCard);
    }
  }

  function buildDiscAccordionRow(d) {
    const pct = d.q > 0 ? ((d.a / d.q) * 100).toFixed(1) : null;

    const item = document.createElement('div');
    item.style.cssText = 'border-top:1px solid var(--border);';

    const header = document.createElement('div');
    header.style.cssText = 'display:flex;align-items:center;gap:10px;padding:11px 18px;cursor:pointer;';
    header.innerHTML = `
      <span style="flex:1;font-weight:600;font-size:0.88rem">${d.nome}</span>
      <span class="text-small text-muted">${d.q.toLocaleString('pt-BR')} questões</span>
      ${acertoBadge(pct)}
      <span class="text-small text-muted">${d.sessoes} sess.</span>
      <span style="color:var(--text-3);font-size:0.7rem">▶</span>
    `;

    const body = document.createElement('div');
    body.className = 'hidden';
    body.style.cssText = 'padding:0 18px 14px;';

    // Breakdown por sessão
    const sessoesDaDisciplina = allSessoes.filter(s => s.disciplina_id === d.id);
    sessoesDaDisciplina.sort((a, b) => b.data.localeCompare(a.data));

    const listEl = document.createElement('div');
    sessoesDaDisciplina.slice(0, 10).forEach(s => {
      const q2 = getQ(s), a2 = getA(s), pct2 = q2 > 0 ? ((a2 / q2) * 100).toFixed(1) : null;
      const row = document.createElement('div');
      row.style.cssText = 'display:flex;align-items:center;gap:10px;padding:5px 0;border-bottom:1px solid var(--border);font-size:0.82rem;';
      row.innerHTML = `
        <span style="color:var(--text-3);min-width:80px">${formatDate(s.data)}</span>
        <span style="color:var(--text-2)">${s.tipo || '—'}</span>
        ${s.banca ? `<span style="color:var(--text-3)">${s.banca}</span>` : ''}
        <span style="margin-left:auto">${q2 > 0 ? q2 + ' q' : '—'}</span>
        ${acertoBadge(pct2)}
      `;
      listEl.appendChild(row);
    });
    if (sessoesDaDisciplina.length > 10) {
      const more = document.createElement('div');
      more.style.cssText = 'font-size:0.78rem;color:var(--text-3);padding-top:6px;text-align:center;';
      more.textContent = `+ ${sessoesDaDisciplina.length - 10} sessões anteriores`;
      listEl.appendChild(more);
    }
    body.appendChild(listEl);
    item.append(header, body);

    header.addEventListener('click', () => {
      const isOpen = !body.classList.contains('hidden');
      body.classList.toggle('hidden', isOpen);
      header.querySelector('span:last-child').textContent = isOpen ? '▶' : '▼';
    });

    return item;
  }

  // ── EVOLUÇÃO LINE CHART ───────────────────────────────────────────────────────
  function buildEvolucaoChart(sessoes) {
    const hoje = todayISO();
    const weeks = 12;
    const data = [];

    for (let i = weeks - 1; i >= 0; i--) {
      const monday = getMondayISO(hoje, i);
      const sunday = getSundayOfISO(monday);
      const week = sessoes.filter(s => s.data >= monday && s.data <= sunday);
      const q = week.reduce((s, x) => s + getQ(x), 0);
      const a = week.reduce((s, x) => s + getA(x), 0);
      data.push({ label: formatDate(monday).slice(0, 5), q, pct: q > 0 ? (a / q) * 100 : null });
    }

    const W = 600, H = 120, PADL = 30, PADR = 10, PADT = 10, PADB = 28;
    const innerW = W - PADL - PADR;
    const innerH = H - PADT - PADB;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', H);

    // Grid lines
    [0, 25, 50, 75, 100].forEach(val => {
      const y = PADT + innerH * (1 - val / 100);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', PADL); line.setAttribute('x2', W - PADR);
      line.setAttribute('y1', y); line.setAttribute('y2', y);
      line.setAttribute('stroke', 'var(--border)'); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', PADL - 4); text.setAttribute('y', y + 3);
      text.setAttribute('text-anchor', 'end'); text.setAttribute('font-size', '9');
      text.setAttribute('fill', 'var(--text-3)'); text.textContent = val + '%';
      svg.appendChild(text);
    });

    // Points and line
    const points = data.map((d, i) => ({
      x: PADL + (i / (data.length - 1)) * innerW,
      y: d.pct !== null ? PADT + innerH * (1 - d.pct / 100) : null,
    }));

    // Draw line segments only between non-null points
    let pathD = '';
    points.forEach((p, i) => {
      if (p.y === null) return;
      const prev = points.slice(0, i).reverse().find(p2 => p2.y !== null);
      if (!prev) pathD += `M ${p.x} ${p.y}`;
      else pathD += ` L ${p.x} ${p.y}`;
    });

    if (pathD) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', pathD);
      path.setAttribute('fill', 'none');
      path.setAttribute('stroke', 'var(--primary)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('stroke-linecap', 'round');
      svg.appendChild(path);
    }

    // Dots + labels
    points.forEach((p, i) => {
      // X label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', p.x); text.setAttribute('y', H - 8);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('font-size', '9');
      text.setAttribute('fill', 'var(--text-3)'); text.textContent = data[i].label;
      svg.appendChild(text);

      if (p.y !== null) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', p.x); circle.setAttribute('cy', p.y);
        circle.setAttribute('r', '3.5');
        circle.setAttribute('fill', 'var(--primary)');
        svg.appendChild(circle);
      }
    });

    return svg;
  }

  // ── RADAR CHART ───────────────────────────────────────────────────────────────
  function buildRadarChart(discStats) {
    const items = discStats.slice(0, 8);
    const n = items.length;
    const CX = 160, CY = 140, R = 110;
    const W = 320, H = 280;

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.setAttribute('width', Math.min(360, W));
    svg.setAttribute('height', H);

    const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const px = (i, r) => CX + r * Math.cos(angle(i));
    const py = (i, r) => CY + r * Math.sin(angle(i));

    // Grid circles
    [0.25, 0.5, 0.75, 1].forEach(frac => {
      const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const pts = items.map((_, i) => `${px(i, R * frac)},${py(i, R * frac)}`).join(' ');
      poly.setAttribute('points', pts);
      poly.setAttribute('fill', 'none');
      poly.setAttribute('stroke', 'var(--border)');
      poly.setAttribute('stroke-width', '1');
      svg.appendChild(poly);
    });

    // Spokes + labels
    items.forEach((d, i) => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', CX); line.setAttribute('y1', CY);
      line.setAttribute('x2', px(i, R)); line.setAttribute('y2', py(i, R));
      line.setAttribute('stroke', 'var(--border)'); line.setAttribute('stroke-width', '1');
      svg.appendChild(line);

      const lx = px(i, R + 18), ly = py(i, R + 18);
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', lx); text.setAttribute('y', ly);
      text.setAttribute('text-anchor', 'middle'); text.setAttribute('dominant-baseline', 'middle');
      text.setAttribute('font-size', '9'); text.setAttribute('fill', 'var(--text-2)');
      text.setAttribute('font-weight', '600');
      text.textContent = d.nome.substring(0, 10);
      svg.appendChild(text);
    });

    // Meta polygon (dashed)
    const metaPts = items.map((d, i) => `${px(i, R * (d.meta / 100))},${py(i, R * (d.meta / 100))}`).join(' ');
    const metaPoly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    metaPoly.setAttribute('points', metaPts);
    metaPoly.setAttribute('fill', 'rgba(16,185,129,0.05)');
    metaPoly.setAttribute('stroke', 'var(--green)');
    metaPoly.setAttribute('stroke-width', '1.5');
    metaPoly.setAttribute('stroke-dasharray', '4,3');
    svg.appendChild(metaPoly);

    // Actual polygon
    const acertoPts = items.map((d, i) => {
      const pct = d.q > 0 ? d.a / d.q : 0;
      return `${px(i, R * pct)},${py(i, R * pct)}`;
    }).join(' ');
    const poly = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    poly.setAttribute('points', acertoPts);
    poly.setAttribute('fill', 'rgba(79,70,229,0.15)');
    poly.setAttribute('stroke', 'var(--primary)');
    poly.setAttribute('stroke-width', '2');
    svg.appendChild(poly);

    // Legend
    const legend = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const makeRect = (x, y, color, label) => {
      const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      rect.setAttribute('x', x); rect.setAttribute('y', y);
      rect.setAttribute('width', '8'); rect.setAttribute('height', '8');
      rect.setAttribute('rx', '2'); rect.setAttribute('fill', color);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      t.setAttribute('x', x + 12); t.setAttribute('y', y + 7);
      t.setAttribute('font-size', '9'); t.setAttribute('fill', 'var(--text-2)');
      t.textContent = label;
      legend.append(rect, t);
    };
    makeRect(20, H - 20, 'rgba(79,70,229,0.5)', 'Acerto atual');
    makeRect(110, H - 20, 'var(--green)', 'Meta');
    svg.appendChild(legend);

    return svg;
  }

  // ── HELPERS ───────────────────────────────────────────────────────────────────
  function getMondayISO(baseISO, weeksAgo) {
    const d = new Date(baseISO + 'T00:00:00');
    const day = d.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    d.setDate(d.getDate() + diff - (weeksAgo * 7));
    return d.toISOString().slice(0, 10);
  }
  function getSundayOfISO(mondayISO) {
    const d = new Date(mondayISO + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    return d.toISOString().slice(0, 10);
  }

  // ── EVENT BINDINGS ────────────────────────────────────────────────────────────
  fDiscSelect.addEventListener('change', async () => {
    const did = fDiscSelect.value;
    if (!did) {
      fAssuntoSelect.innerHTML = '<option value="">Todos</option>';
    } else {
      const assuntos = await api.get(`/api/assuntos?disciplina_id=${did}`);
      fAssuntoSelect.innerHTML = '<option value="">Todos</option>' +
        assuntos.map(a => `<option value="${a.id}">${a.codigo ? a.codigo + ' ' : ''}${a.nome}</option>`).join('');
    }
    load();
  });

  [fConcSelect, fBancaSelect, fTipoSelect, fInicioInput, fFimInput, fAssuntoSelect].forEach(el => {
    el.addEventListener('change', load);
  });

  qs('#btn-zerar-hist', container).addEventListener('click', async () => {
    if (!confirm('Zerar todo o histórico de estudos? Esta ação não pode ser desfeita.')) return;
    await api.post('/api/usuario/zerar-historico', {});
    showToast('Histórico zerado!', 'success');
    load();
  });

  load();
}
