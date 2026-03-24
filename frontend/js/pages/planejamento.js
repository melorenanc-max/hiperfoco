// ── PLANEJAMENTO PAGE ─────────────────────────────────────────────────────────

async function renderPlanejamento(container) {
  const [planejamentos, alvoId] = await Promise.all([
    api.get('/api/planejamentos'),
    getConcursoAlvo()
  ]);

  const hoje = todayISO();
  const emUso = planejamentos.filter(p => String(p.id) === String(alvoId));
  const ativos = planejamentos.filter(p => String(p.id) !== String(alvoId) && p.data_prova >= hoje);
  const encerrados = planejamentos.filter(p => String(p.id) !== String(alvoId) && p.data_prova && p.data_prova < hoje);
  const semData = planejamentos.filter(p => String(p.id) !== String(alvoId) && !p.data_prova);

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Planejamento</div><div class="page-subtitle">Organize seu estudo por concurso</div></div>
      <button class="btn btn-primary" id="novo-plan-btn">+ Novo Planejamento</button>
    </div>
    <div id="plan-sections"></div>
  `;

  function renderCardSection(titulo, lista, isAtivo = false) {
    if (!lista.length) return;
    const sec = document.createElement('div');
    sec.style.marginBottom = '28px';

    const h = document.createElement('div');
    h.className = 'section-title';
    h.style.marginBottom = '12px';
    h.textContent = titulo;
    sec.appendChild(h);

    const grid = document.createElement('div');
    grid.className = 'plan-cards-grid';

    lista.forEach(p => {
      const semanas = semanasRestantes(p.data_prova);
      const semanasStr = semanas === null ? 'Sem data'
        : semanas > 0 ? `${semanas} sem. restantes`
        : semanas === 0 ? 'Esta semana!'
        : 'Encerrado';
      const pct = p.total_tarefas > 0 ? Math.round((p.tarefas_feitas / p.total_tarefas) * 100) : 0;

      const card = document.createElement('div');
      card.className = 'plan-card' + (isAtivo ? ' plan-card-ativo' : '');
      card.style.cursor = 'pointer';

      if (isAtivo) {
        const badge = document.createElement('div');
        badge.className = 'plan-card-ativo-badge';
        badge.textContent = '● Em uso';
        card.appendChild(badge);
      }

      const cardHeader = document.createElement('div');
      cardHeader.className = 'plan-card-header';
      cardHeader.innerHTML = `
        <div class="plan-card-nome">${p.nome}</div>
        <div class="plan-card-concurso">${p.data_prova ? '📅 ' + formatDate(p.data_prova) + ' · <strong>' + semanasStr + '</strong>' : '<span style="color:var(--text-3)">Sem data</span>'}</div>
      `;

      const cardBody = document.createElement('div');
      cardBody.className = 'plan-card-body';
      cardBody.innerHTML = `
        <div class="plan-card-stat"><span class="plan-card-stat-label">Disciplinas</span><span class="plan-card-stat-val">${p.total_disciplinas}</span></div>
        <div class="plan-card-stat"><span class="plan-card-stat-label">Tarefas</span><span class="plan-card-stat-val">${p.tarefas_feitas}/${p.total_tarefas}</span></div>
      `;

      const cardActions = document.createElement('div');
      cardActions.className = 'plan-card-actions';

      const editBtn = document.createElement('button');
      editBtn.className = 'btn-action btn-action-edit';
      editBtn.title = 'Editar';
      editBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`;
      editBtn.addEventListener('click', e => { e.stopPropagation(); openPlanModal(p.id, () => renderPlanejamento(container)); });

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-action btn-action-delete';
      delBtn.title = 'Apagar';
      delBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>`;
      delBtn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Apagar este planejamento e todos os dados vinculados?')) return;
        await api.delete(`/api/planejamentos/${p.id}`);
        showToast('Planejamento apagado'); renderPlanejamento(container);
      });

      const usarBtn = document.createElement('button');
      if (!isAtivo) {
        usarBtn.className = 'btn btn-outline btn-sm';
        usarBtn.textContent = 'Usar este';
        usarBtn.addEventListener('click', async e => {
          e.stopPropagation();
          await setConcursoAlvo(p.id);
          showToast('Planejamento ativo atualizado!', 'success');
          renderPlanejamento(container);
        });
        cardActions.appendChild(usarBtn);
      }

      cardActions.append(editBtn, delBtn);

      if (p.total_tarefas > 0) {
        const barWrap = document.createElement('div');
        barWrap.style.margin = '10px 0 4px';
        barWrap.innerHTML = `<div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pct}%"></div></div><div style="font-size:0.7rem;color:var(--text-3);margin-top:3px">${pct}% concluído</div>`;
        card.append(cardHeader, cardBody, barWrap, cardActions);
      } else {
        card.append(cardHeader, cardBody, cardActions);
      }

      card.addEventListener('click', () => window._app.navigate('planejamento-detalhe', { id: p.id }));
      grid.appendChild(card);
    });

    sec.appendChild(grid);
    qs('#plan-sections', container).appendChild(sec);
  }

  if (!planejamentos.length) {
    qs('#plan-sections', container).innerHTML = renderEmptyState('◈', 'Nenhum planejamento. Clique em "+ Novo Planejamento".');
  } else {
    renderCardSection('Em uso', emUso, true);
    renderCardSection('Ativos', [...ativos, ...semData]);
    renderCardSection('Encerrados', encerrados);
  }

  qs('#novo-plan-btn', container).addEventListener('click', () => openPlanModal(null, () => renderPlanejamento(container)));
}

// ── PLANEJAMENTO DETALHE ──────────────────────────────────────────────────────
async function renderPlanejamentoDetalhe(container, params = {}) {
  const { id } = params;
  const [plan, statsData] = await Promise.all([
    api.get(`/api/planejamentos/${id}`),
    api.get(`/api/stats/dashboard-plan?plan_id=${id}`).catch(() => ({ disciplinas: [] }))
  ]);

  const hoje = todayISO();
  const semRest = semanasRestantes(plan.data_prova);
  const dataInicio = plan.created_at ? plan.created_at.slice(0, 10) : hoje;
  const semPass = semanasPassadas(dataInicio);
  const semTotal = semRest !== null ? semPass + semRest : semPass;
  const pctTempo = semTotal > 0 ? Math.min(100, Math.round((semPass / semTotal) * 100)) : 0;

  const statsMap = {};
  (statsData.disciplinas || []).forEach(d => { statsMap[d.id] = d; });

  resetProvaColors();
  container.innerHTML = '';

  // ── Cabeçalho
  const header = document.createElement('div');
  header.style.marginBottom = '22px';
  header.innerHTML = `
    <a class="back-link" id="back-btn" style="cursor:pointer;display:inline-block;margin-bottom:10px;font-size:0.84rem;color:var(--text-3)">← Planejamentos</a>
    <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div>
        <div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;letter-spacing:-0.5px">${plan.nome}</div>
        <div style="font-size:0.82rem;color:var(--text-3);margin-top:3px">${plan.data_prova ? formatDate(plan.data_prova) : 'Sem data definida'}</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
        <div style="font-size:0.84rem;color:var(--text-2)">Semana <strong>${semPass}</strong> de <strong>${semTotal || '?'}</strong> · <strong>${semRest !== null ? semRest : '—'} sem. restantes</strong></div>
        ${semTotal > 0 ? `<div style="width:240px;max-width:100%">
          <div class="progress-bar-wrap" style="position:relative;height:8px">
            <div class="progress-bar-fill" style="width:${pctTempo}%"></div>
          </div>
          <div style="display:flex;justify-content:space-between;font-size:0.68rem;color:var(--text-3);margin-top:2px">
            <span>Início</span><span>Hoje</span><span>Prova</span>
          </div>
        </div>` : ''}
        <button class="btn btn-outline btn-sm" id="edit-plan-btn">Editar planejamento</button>
      </div>
    </div>
  `;
  container.appendChild(header);

  qs('#back-btn', container).addEventListener('click', () => window._app.navigate('planejamento'));
  qs('#edit-plan-btn', container).addEventListener('click', () => openPlanModal(id, () => renderPlanejamentoDetalhe(container, params)));

  // ── Tabela do Edital
  const tabelaSection = document.createElement('div');
  tabelaSection.style.marginBottom = '24px';
  renderTabelaEdital(plan, statsMap, tabelaSection, container, params);
  container.appendChild(tabelaSection);

  // ── Seção Disciplinas
  const discsSection = document.createElement('div');
  const discsTit = document.createElement('div');
  discsTit.className = 'section-title';
  discsTit.style.marginBottom = '12px';
  discsTit.textContent = 'Disciplinas';
  discsSection.appendChild(discsTit);

  if (!plan.disciplinas.length) {
    discsSection.innerHTML += renderEmptyState('▹', 'Nenhuma disciplina. Edite o planejamento para adicionar.');
  } else {
    plan.disciplinas.forEach(d => {
      const s = statsMap[d.disciplina_id] || {};
      discsSection.appendChild(buildPlanDiscAccordion(d, s, plan, container, params));
    });
  }

  container.appendChild(discsSection);
}

function renderTabelaEdital(plan, statsMap, sectionEl, container, params) {
  const totalPontos = plan.disciplinas.reduce((s, d) => s + ((d.num_questoes || 0) * (d.peso || 1)), 0);

  const card = document.createElement('div');
  card.className = 'card';

  const cardHeader = document.createElement('div');
  cardHeader.style.cssText = 'padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;';
  cardHeader.innerHTML = `<div style="font-family:var(--font-display);font-weight:700;font-size:0.88rem">Edital</div>`;

  const toggleWrap = document.createElement('div');
  toggleWrap.style.cssText = 'display:flex;gap:0;border:1px solid var(--border-strong);border-radius:var(--radius-sm);overflow:hidden;';
  const btnProva = document.createElement('button');
  btnProva.textContent = 'Por prova';
  btnProva.className = 'btn btn-sm';
  btnProva.style.cssText = 'border:none;border-radius:0;background:var(--primary);color:#fff;';
  const btnConsol = document.createElement('button');
  btnConsol.textContent = 'Consolidado';
  btnConsol.className = 'btn btn-sm';
  btnConsol.style.cssText = 'border:none;border-radius:0;background:transparent;color:var(--text-2);';

  let modoProva = true;
  const renderTabela = () => {
    tableWrap.innerHTML = '';
    tableWrap.appendChild(buildTabelaEdital(plan.disciplinas, statsMap, totalPontos, modoProva));
  };

  btnProva.addEventListener('click', () => {
    modoProva = true;
    btnProva.style.cssText = 'border:none;border-radius:0;background:var(--primary);color:#fff;';
    btnConsol.style.cssText = 'border:none;border-radius:0;background:transparent;color:var(--text-2);';
    renderTabela();
  });
  btnConsol.addEventListener('click', () => {
    modoProva = false;
    btnConsol.style.cssText = 'border:none;border-radius:0;background:var(--primary);color:#fff;';
    btnProva.style.cssText = 'border:none;border-radius:0;background:transparent;color:var(--text-2);';
    renderTabela();
  });

  toggleWrap.append(btnProva, btnConsol);
  cardHeader.appendChild(toggleWrap);
  card.appendChild(cardHeader);

  const tableWrap = document.createElement('div');
  tableWrap.className = 'table-wrap';
  renderTabela();
  card.appendChild(tableWrap);

  // Bind edit/del events
  card.addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'edit-disc') {
      const d = plan.disciplinas.find(x => x.id == btn.dataset.id);
      if (d) openEditDiscModal(d, () => renderPlanejamentoDetalhe(container, params));
    }
    if (btn.dataset.action === 'del-disc') {
      if (!confirm('Remover disciplina do planejamento?')) return;
      await api.delete(`/api/plan-disciplinas/${btn.dataset.id}`);
      showToast('Removida'); renderPlanejamentoDetalhe(container, params);
    }
  });

  sectionEl.appendChild(card);
}

function buildTabelaEdital(disciplinas, statsMap, totalPontos, modoProva) {
  const table = document.createElement('table');
  const thead = document.createElement('thead');
  thead.innerHTML = `<tr>
    <th>Disciplina</th><th>Prova</th><th class="td-right">Peso</th>
    <th class="td-right">% Acerto</th><th class="td-right">Questões</th>
    <th class="td-right">Avanço</th><th class="td-center">Meta</th><th></th>
  </tr>`;
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  const renderRow = (d) => {
    const s = statsMap[d.disciplina_id] || {};
    const pct = s.pct_acerto ? parseFloat(s.pct_acerto) : null;
    const pontos = (d.num_questoes || 0) * (d.peso || 1);
    const pctProva = totalPontos > 0 ? ((pontos / totalPontos) * 100).toFixed(1) : '—';
    const meta = d.meta_pct ? parseFloat(d.meta_pct) : null;
    const indicador = buildMetaIndicator(pct, meta);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="fw-600">${d.disciplina_nome}</td>
      <td>${d.prova ? provaTag(d.prova) : '—'}</td>
      <td class="td-right">${d.peso || 1}</td>
      <td class="td-right">${pct !== null ? `<span class="acerto-badge ${acertoClass(pct)}">${pct.toFixed(1)}%</span>` : '—'}</td>
      <td class="td-right">${(s.total_questoes || 0)} / ${d.num_questoes || 0}</td>
      <td class="td-right">${s.pct_avanco ? s.pct_avanco + '%' : '—'}</td>
      <td class="td-center"></td>
      <td style="white-space:nowrap">
        <button class="btn-action btn-action-edit" data-action="edit-disc" data-id="${d.id}" title="Editar">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        </button>
        <button class="btn-action btn-action-delete" data-action="del-disc" data-id="${d.id}" title="Remover">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
        </button>
      </td>
    `;
    tr.querySelector('.td-center').appendChild(indicador);
    return tr;
  };

  if (modoProva) {
    const provas = [...new Set(disciplinas.map(d => d.prova).filter(Boolean))].sort();
    provas.forEach(prova => {
      const discs = disciplinas.filter(d => d.prova === prova);
      const cor = getProvaColor(prova);
      const provaPontos = discs.reduce((s, d) => s + ((d.num_questoes||0)*(d.peso||1)), 0);
      const provaQ = discs.reduce((s, d) => s + (d.num_questoes || 0), 0);
      const provaPct = totalPontos > 0 ? ((provaPontos/totalPontos)*100).toFixed(1) : '—';
      const groupRow = document.createElement('tr');
      groupRow.style.background = cor;
      groupRow.innerHTML = `<td colspan="2" style="color:#fff;font-weight:700;font-size:0.78rem;padding:8px 14px">${prova}</td>
        <td></td><td></td>
        <td class="td-right" style="color:#fff;font-weight:700">${provaQ}</td>
        <td></td><td></td><td></td>`;
      tbody.appendChild(groupRow);
      discs.forEach(d => tbody.appendChild(renderRow(d)));
    });
    const semProva = disciplinas.filter(d => !d.prova);
    if (semProva.length) {
      const spRow = document.createElement('tr');
      spRow.style.background = '#9CA3AF';
      spRow.innerHTML = `<td colspan="8" style="color:#fff;font-weight:700;font-size:0.72rem;padding:6px 14px">SEM PROVA</td>`;
      tbody.appendChild(spRow);
      semProva.forEach(d => tbody.appendChild(renderRow(d)));
    }
  } else {
    disciplinas.forEach(d => tbody.appendChild(renderRow(d)));
  }

  // Total
  const totalQ = disciplinas.reduce((s, d) => s + (d.num_questoes || 0), 0);
  const totalRow = document.createElement('tr');
  totalRow.style.cssText = 'background:var(--primary-bg);font-weight:700;border-top:2px solid var(--border)';
  totalRow.innerHTML = `<td colspan="2" style="font-family:var(--font-display)">TOTAL</td>
    <td></td><td></td>
    <td class="td-right">${totalQ}</td>
    <td></td><td></td><td></td>`;
  tbody.appendChild(totalRow);
  table.appendChild(tbody);
  return table;
}

function buildPlanDiscAccordion(d, s, plan, container, params) {
  const tarefas = d.tarefas || [];
  const tarefasFeitas = tarefas.filter(t => t.concluida).length;
  const totalTarefas = tarefas.length;
  const pct = totalTarefas > 0 ? Math.round((tarefasFeitas / totalTarefas) * 100) : 0;
  const assuntos = d.assuntos || [];
  const assuntosPais = assuntos.filter(a => !a.parent_id);
  const acertoPct = s.pct_acerto ? parseFloat(s.pct_acerto) : null;
  const meta = d.meta_pct ? parseFloat(d.meta_pct) : null;

  const item = document.createElement('div');
  item.className = 'accordion-item';
  item.style.marginBottom = '10px';

  const header = document.createElement('div');
  header.className = 'accordion-header';
  header.style.cssText = 'display:flex;align-items:center;gap:8px;';

  const chevron = document.createElement('span');
  chevron.className = 'accordion-arrow';
  chevron.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  const nome = document.createElement('span');
  nome.className = 'disc-acc-nome';
  nome.textContent = d.disciplina_nome;

  const badges = document.createElement('div');
  badges.className = 'disc-acc-badges';
  badges.style.display = 'flex';
  badges.style.gap = '8px';
  badges.style.alignItems = 'center';
  if (d.prova) badges.appendChild((() => { const s2 = document.createElement('span'); s2.innerHTML = provaTag(d.prova); return s2; })());

  const assSpan = document.createElement('span');
  assSpan.className = 'text-small text-muted';
  assSpan.textContent = `${assuntosPais.length || assuntos.length} assuntos`;
  badges.appendChild(assSpan);

  const tarefaSpan = document.createElement('span');
  tarefaSpan.className = 'text-small text-muted';
  tarefaSpan.textContent = `${tarefasFeitas}/${totalTarefas} tarefas`;
  badges.appendChild(tarefaSpan);

  if (acertoPct !== null) {
    const ab = document.createElement('span');
    ab.className = `acerto-badge ${acertoClass(acertoPct)}`;
    ab.textContent = acertoPct.toFixed(1) + '%';
    badges.appendChild(ab);
  }

  badges.appendChild(buildMetaIndicator(acertoPct, meta));

  header.append(chevron, nome, badges);
  item.appendChild(header);

  // Barra de avanço logo abaixo do cabeçalho
  const barWrap = document.createElement('div');
  barWrap.style.cssText = 'height:3px;background:var(--border);border-radius:0;overflow:hidden;';
  const barFill = document.createElement('div');
  barFill.style.cssText = `height:100%;background:var(--primary);width:${pct}%;transition:width 0.3s;`;
  barWrap.appendChild(barFill);
  item.appendChild(barWrap);

  const body = document.createElement('div');
  body.className = 'accordion-body';

  // Seção Assuntos (recolhível)
  const assSection = buildSubSection('Assuntos', () => {
    if (!assuntos.length) {
      const p = document.createElement('p');
      p.className = 'text-muted text-small';
      p.style.padding = '8px 0';
      p.textContent = 'Nenhum assunto vinculado.';
      return p;
    }
    const normalizedAssuntos = assuntos.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
    return buildAssuntoAccordion(normalizedAssuntos);
  });
  body.appendChild(assSection);

  // Seção Tarefas (recolhível)
  const tarefasSection = buildSubSection('Tarefas', () => {
    const wrap = document.createElement('div');
    const addBtn = document.createElement('button');
    addBtn.className = 'btn btn-outline btn-sm';
    addBtn.style.marginBottom = '10px';
    addBtn.textContent = '+ Nova Tarefa';
    addBtn.addEventListener('click', () => openTarefaModal(null, d, assuntos, () => renderPlanejamentoDetalhe(container, params)));
    wrap.appendChild(addBtn);

    const pendentes = tarefas.filter(t => !t.concluida);
    const concluidas = tarefas.filter(t => t.concluida);

    if (!tarefas.length) {
      const p = document.createElement('p');
      p.className = 'text-muted text-small';
      p.textContent = 'Nenhuma tarefa criada.';
      wrap.appendChild(p);
      return wrap;
    }

    pendentes.forEach(t => {
      wrap.appendChild(buildTaskCard(t, {
        mode: 'planejamento',
        draggable: true,
        onEdit: () => openTarefaModal(t, d, assuntos, () => renderPlanejamentoDetalhe(container, params)),
        onDelete: async () => {
          if (!confirm('Apagar tarefa?')) return;
          await api.delete(`/api/plan-tarefas/${t.id}`);
          showToast('Tarefa apagada'); renderPlanejamentoDetalhe(container, params);
        }
      }));
    });

    if (concluidas.length) {
      const concDiv = document.createElement('div');
      concDiv.style.marginTop = '12px';
      const concToggle = document.createElement('button');
      concToggle.className = 'btn btn-outline btn-sm';
      concToggle.textContent = `Concluídas (${concluidas.length})`;
      const concList = document.createElement('div');
      concList.classList.add('hidden');
      concList.style.marginTop = '8px';
      concluidas.forEach(t => {
        concList.appendChild(buildTaskCard(t, {
          mode: 'planejamento',
          onDelete: async () => {
            if (!confirm('Apagar tarefa?')) return;
            await api.delete(`/api/plan-tarefas/${t.id}`);
            showToast('Tarefa apagada'); renderPlanejamentoDetalhe(container, params);
          }
        }));
      });
      concToggle.addEventListener('click', () => concList.classList.toggle('hidden'));
      concDiv.append(concToggle, concList);
      wrap.appendChild(concDiv);
    }
    return wrap;
  }, true); // tarefas aberto por padrão
  body.appendChild(tarefasSection);

  item.appendChild(body);

  header.addEventListener('click', () => {
    const isOpen = item.classList.toggle('open');
    chevron.style.transform = isOpen ? 'rotate(90deg)' : '';
  });

  return item;
}

function buildSubSection(titulo, contentBuilder, openByDefault = false) {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'border-top:1px solid var(--border);padding:12px 0;';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;cursor:pointer;';

  const title = document.createElement('div');
  title.style.cssText = 'font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--text-3);font-family:var(--font-display);';
  title.textContent = titulo;

  const chevronBtn = document.createElement('span');
  chevronBtn.style.cssText = 'color:var(--text-3);transition:transform 0.18s;display:flex;align-items:center;';
  chevronBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>`;

  header.append(title, chevronBtn);
  wrap.appendChild(header);

  const content = document.createElement('div');
  if (!openByDefault) content.classList.add('hidden');
  else chevronBtn.style.transform = 'rotate(90deg)';

  let built = false;
  header.addEventListener('click', () => {
    const isOpen = content.classList.toggle('hidden');
    if (!isOpen) {
      chevronBtn.style.transform = 'rotate(90deg)';
      if (!built) { content.appendChild(contentBuilder()); built = true; }
    } else {
      chevronBtn.style.transform = '';
    }
  });

  if (openByDefault) {
    content.appendChild(contentBuilder());
    built = true;
  }

  wrap.appendChild(content);
  return wrap;
}

// ── PLANEJAMENTO DISCIPLINA (page mantida para compatibilidade) ────────────────
async function renderPlanejamentoDisciplina(container, params = {}) {
  // Redireciona para detalhe do planejamento
  window._app.navigate('planejamento-detalhe', { id: params.plan_id });
}

// ── MODAIS ────────────────────────────────────────────────────────────────────

async function openPlanModal(id, onSave) {
  const [todasDiscs, todosPlans] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get('/api/planejamentos')
  ]);
  let plan = null;
  if (id) plan = await api.get(`/api/planejamentos/${id}`);

  const bodyEl = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = id ? 'Editar Planejamento' : 'Novo Planejamento';
  bodyEl.innerHTML = '';

  const form = document.createElement('div');

  // Nome e data
  const rowTop = document.createElement('div');
  rowTop.className = 'form-row';
  const nomeInput = Object.assign(document.createElement('input'), { type: 'text', value: plan?.nome || '', placeholder: 'Ex: SEFAZ GO 2026' });
  nomeInput.className = 'form-control';
  const dataInput = Object.assign(document.createElement('input'), { type: 'date', value: plan?.data_prova || '' });
  dataInput.className = 'form-control';
  const g1 = document.createElement('div'); g1.className = 'form-group'; g1.style.flex = '2';
  const l1 = document.createElement('label'); l1.textContent = 'Nome do Concurso *'; g1.append(l1, nomeInput);
  const g2 = document.createElement('div'); g2.className = 'form-group';
  const l2 = document.createElement('label'); l2.textContent = 'Data da Prova'; g2.append(l2, dataInput);
  rowTop.append(g1, g2);
  form.appendChild(rowTop);

  // Disciplinas
  const discTitle = document.createElement('div');
  discTitle.className = 'section-title';
  discTitle.style.cssText = 'margin:12px 0 8px;';
  discTitle.textContent = 'Disciplinas do Edital';
  form.appendChild(discTitle);

  const colsHeader = document.createElement('div');
  colsHeader.style.cssText = 'font-size:0.7rem;color:var(--text-3);margin-bottom:4px;display:grid;grid-template-columns:1fr 70px 60px 60px 70px;gap:6px;padding:0 4px;';
  colsHeader.innerHTML = '<span>Disciplina</span><span style="text-align:center">Prova</span><span style="text-align:center">Questões</span><span style="text-align:center">Peso</span><span style="text-align:center">Meta Q</span>';
  form.appendChild(colsHeader);

  const discList = document.createElement('div');
  discList.style.cssText = 'max-height:220px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 8px;';
  discList.id = 'pl-discs-list';

  todasDiscs.forEach(d => {
    const cd = plan?.disciplinas?.find(pd => pd.disciplina_id === d.id) || {};
    const checked = !!cd.disciplina_id;
    const row = document.createElement('div');
    row.className = 'plan-disc-config-row';

    const lbl = document.createElement('label');
    lbl.style.cssText = 'display:flex;align-items:center;gap:8px;flex:1;cursor:pointer;';
    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', className: 'pd-check', value: d.id, checked });
    cb.style.cssText = 'accent-color:var(--primary);width:14px;height:14px;';
    const span = document.createElement('span');
    span.style.cssText = 'font-size:0.86rem;font-weight:500;';
    span.textContent = d.nome;
    lbl.append(cb, span);

    const prova = document.createElement('select');
    prova.className = 'pd-prova';
    prova.dataset.disc = d.id;
    prova.style.cssText = 'width:70px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:4px;font-size:0.8rem;';
    [['', '—'], ...PROVAS_OPCOES.map(p => [p, p])].forEach(([val, txt]) => {
      const opt = document.createElement('option');
      opt.value = val; opt.textContent = txt; if (cd.prova === val) opt.selected = true;
      prova.appendChild(opt);
    });

    const questoes = Object.assign(document.createElement('input'), { type: 'number', className: 'pd-questoes', value: cd.num_questoes || '', placeholder: 'Q', min: '0' });
    questoes.dataset.disc = d.id;
    questoes.style.cssText = 'width:60px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:4px 6px;font-size:0.8rem;text-align:center;';

    const peso = Object.assign(document.createElement('input'), { type: 'number', className: 'pd-peso', value: cd.peso || 1, placeholder: 'Peso', min: '0', step: '0.5' });
    peso.dataset.disc = d.id;
    peso.style.cssText = 'width:60px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:4px 6px;font-size:0.8rem;text-align:center;';

    const metaQ = Object.assign(document.createElement('input'), { type: 'number', className: 'pd-meta', value: cd.meta_questoes || '', placeholder: 'Meta', min: '0' });
    metaQ.dataset.disc = d.id;
    metaQ.style.cssText = 'width:70px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:4px 6px;font-size:0.8rem;text-align:center;';

    row.append(lbl, prova, questoes, peso, metaQ);
    discList.appendChild(row);
  });

  form.appendChild(discList);

  // Actions
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
    const nomeDup = todosPlans.some(p => p.nome.toLowerCase() === nome.toLowerCase() && (!id || String(p.id) !== String(id)));
    if (nomeDup) { showToast('Já existe um planejamento com este nome!', 'error'); return; }
    const data_prova = dataInput.value;
    const disciplinas = qsa('.pd-check:checked', discList).map(cb => {
      const did = cb.value;
      const num_questoes = parseInt(qs(`.pd-questoes[data-disc="${did}"]`, discList)?.value) || 0;
      const meta_questoes = parseInt(qs(`.pd-meta[data-disc="${did}"]`, discList)?.value) || null;
      const meta_pct = (meta_questoes && num_questoes) ? parseFloat(((meta_questoes / num_questoes) * 100).toFixed(1)) : null;
      return {
        disciplina_id: parseInt(did),
        prova: qs(`.pd-prova[data-disc="${did}"]`, discList)?.value || '',
        num_questoes,
        peso: parseFloat(qs(`.pd-peso[data-disc="${did}"]`, discList)?.value) || 1,
        meta_questoes,
        meta_pct,
      };
    });
    if (id) {
      await api.put(`/api/planejamentos/${id}`, { nome, concurso_id: plan?.concurso_id, data_prova });
      if (disciplinas.length) await api.post(`/api/planejamentos/${id}/disciplinas`, { disciplinas });
      // Atualiza meta para cada disciplina
      if (plan) {
        for (const d of disciplinas) {
          const pd = plan.disciplinas?.find(x => x.disciplina_id === d.disciplina_id);
          if (pd) await api.put(`/api/plan-disciplinas/${pd.id}`, d).catch(() => {});
        }
      }
    } else {
      const res = await api.post('/api/planejamentos', { nome, data_prova });
      if (disciplinas.length) await api.post(`/api/planejamentos/${res.id}/disciplinas`, { disciplinas });
    }
    closeModal(); showToast('Planejamento salvo!', 'success'); if (onSave) onSave();
  });
  actions.append(cancelBtn, saveBtn);
  form.appendChild(actions);
  bodyEl.appendChild(form);
  nomeInput.focus();
  document.getElementById('modal-overlay').classList.remove('hidden');
}

function openEditDiscModal(d, onSave) {
  const bodyEl = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = 'Editar Disciplina no Plano';
  bodyEl.innerHTML = '';

  const form = document.createElement('div');
  const discNome = document.createElement('div');
  discNome.style.cssText = 'font-weight:700;margin-bottom:14px;font-size:1rem;';
  discNome.textContent = d.disciplina_nome;
  form.appendChild(discNome);

  const row = document.createElement('div');
  row.className = 'form-row';

  const makeGroup = (label, type, val, extra = {}) => {
    const g = document.createElement('div'); g.className = 'form-group';
    const l = document.createElement('label'); l.textContent = label;
    const inp = Object.assign(document.createElement('input'), { type, value: val || '', ...extra });
    inp.className = 'form-control';
    g.append(l, inp); return { g, inp };
  };

  const provaG = document.createElement('div'); provaG.className = 'form-group';
  const provaL = document.createElement('label'); provaL.textContent = 'Prova';
  const provaSel = document.createElement('select'); provaSel.className = 'form-control';
  [['', '—'], ...PROVAS_OPCOES.map(p => [p, p])].forEach(([v, t]) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = t;
    if (d.prova === v) opt.selected = true; provaSel.appendChild(opt);
  });
  provaG.append(provaL, provaSel);

  const { g: qG, inp: qInp } = makeGroup('Questões no Edital', 'number', d.num_questoes || 0, { min: 0 });
  const { g: pG, inp: pInp } = makeGroup('Peso', 'number', d.peso || 1, { min: 0, step: '0.5' });
  const { g: mG, inp: mInp } = makeGroup('Meta de acertos (Q)', 'number', d.meta_questoes || '', { min: 0, placeholder: 'Ex: 10' });

  // Calcula % da meta em tempo real
  const metaInfo = document.createElement('div');
  metaInfo.style.cssText = 'font-size:0.78rem;color:var(--text-3);margin-top:4px;';
  const calcMeta = () => {
    const q = parseInt(qInp.value) || 0;
    const m = parseInt(mInp.value) || 0;
    metaInfo.textContent = q > 0 && m > 0 ? `Meta: ${((m/q)*100).toFixed(1)}%` : '';
  };
  qInp.addEventListener('input', calcMeta); mInp.addEventListener('input', calcMeta);
  mG.appendChild(metaInfo); calcMeta();

  row.append(provaG, qG, pG, mG);
  form.appendChild(row);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline'; cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary'; saveBtn.textContent = 'Salvar';
  saveBtn.addEventListener('click', async () => {
    const num_questoes = parseInt(qInp.value) || 0;
    const meta_questoes = parseInt(mInp.value) || null;
    const meta_pct = (meta_questoes && num_questoes) ? parseFloat(((meta_questoes/num_questoes)*100).toFixed(1)) : null;
    await api.put(`/api/plan-disciplinas/${d.id}`, {
      prova: provaSel.value,
      peso: parseFloat(pInp.value) || 1,
      num_questoes,
      meta_questoes,
      meta_pct,
    });
    closeModal(); showToast('Salvo!', 'success'); if (onSave) onSave();
  });
  actions.append(cancelBtn, saveBtn);
  form.appendChild(actions);
  bodyEl.appendChild(form);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

async function openTarefaModal(tarefa, planDisc, allAssuntos, onSave) {
  const t = tarefa || {};
  const isEdit = !!t.id;
  const assuntosIds = t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : [];
  const assuntosNormalizados = allAssuntos.map(a => ({ ...a, id: a.assunto_id ?? a.id }));

  const bodyEl = document.getElementById('modal-body');
  document.getElementById('modal-title').textContent = isEdit ? 'Editar Tarefa' : 'Nova Tarefa';
  bodyEl.innerHTML = '';

  const form = document.createElement('div');

  // Tipo
  const tipoG = document.createElement('div'); tipoG.className = 'form-group';
  const tipoL = document.createElement('label'); tipoL.textContent = 'Tipo';
  const tipoSel = document.createElement('select'); tipoSel.className = 'form-control';
  [['', '— Tipo —'], ['questoes', 'Questões'], ['teoria', 'Teoria'], ['revisao', 'Revisão'], ['simulado', 'Simulado']].forEach(([v, lbl]) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = lbl;
    if ((t.tipo || '') === v) opt.selected = true; tipoSel.appendChild(opt);
  });
  tipoG.append(tipoL, tipoSel);

  // Tempo + Quantidade
  const row2 = document.createElement('div'); row2.className = 'form-row';
  const tempoG = document.createElement('div'); tempoG.className = 'form-group';
  const tempoL = document.createElement('label'); tempoL.textContent = 'Tempo estimado';
  const tempoSel = document.createElement('select'); tempoSel.className = 'form-control';
  [['30', '30min'], ['60', '1h'], ['90', '1h30'], ['120', '2h'], ['150', 'Mais de 2h']].forEach(([v, lbl]) => {
    const opt = document.createElement('option'); opt.value = v; opt.textContent = lbl;
    if (String(t.tempo_estimado || 60) === v) opt.selected = true; tempoSel.appendChild(opt);
  });
  tempoG.append(tempoL, tempoSel);

  const qG = document.createElement('div'); qG.className = 'form-group';
  const qL = document.createElement('label'); qL.textContent = 'Quantidade de questões';
  const qInp = Object.assign(document.createElement('input'), { type: 'number', value: t.quantidade_questoes || '', min: '0', className: 'form-control', placeholder: 'Opcional' });
  qG.append(qL, qInp);
  row2.append(tempoG, qG);

  // Link caderno
  const linkG = document.createElement('div'); linkG.className = 'form-group';
  const linkL = document.createElement('label'); linkL.textContent = 'Link do Caderno';
  const linkInp = Object.assign(document.createElement('input'), { type: 'url', value: t.link_caderno || '', className: 'form-control', placeholder: 'https://...' });
  linkG.append(linkL, linkInp);

  // Assuntos multi-select
  const assG = document.createElement('div'); assG.className = 'form-group';
  const assL = document.createElement('label'); assL.textContent = 'Assuntos';
  const { id: msId, html: msHtml } = buildAssuntosMultiSelect(assuntosNormalizados, assuntosIds);
  const msWrap = document.createElement('div');
  msWrap.innerHTML = msHtml;
  assG.append(assL, msWrap);

  // Comando
  const cmdG = document.createElement('div'); cmdG.className = 'form-group';
  const cmdL = document.createElement('label'); cmdL.textContent = 'Comando';
  const cmdTa = Object.assign(document.createElement('textarea'), { rows: 3, className: 'form-control', placeholder: 'O que deve ser feito nesta tarefa...' });
  cmdTa.value = t.comando || t.o_que_fazer || '';
  cmdG.append(cmdL, cmdTa);

  // Hiperdica
  const hdG = document.createElement('div'); hdG.className = 'form-group';
  const hdL = document.createElement('label'); hdL.textContent = 'Hiperdica';
  const hdTa = Object.assign(document.createElement('textarea'), { rows: 2, className: 'form-control', placeholder: 'Dica rápida para esta tarefa...' });
  hdTa.value = t.hiperdica || '';
  hdG.append(hdL, hdTa);

  // Observação
  const obsG = document.createElement('div'); obsG.className = 'form-group';
  const obsL = document.createElement('label'); obsL.textContent = 'Observação (opcional)';
  const obsTa = Object.assign(document.createElement('textarea'), { rows: 2, className: 'form-control' });
  obsTa.value = t.observacao || '';
  obsG.append(obsL, obsTa);

  form.append(tipoG, row2, linkG, assG, cmdG, hdG, obsG);

  // Init multi-select
  msWrap.querySelectorAll('.ms-check').forEach(cb => {
    cb.addEventListener('change', () => updateMultiSelectLabel(msId, assuntosNormalizados));
  });
  updateMultiSelectLabel(msId, assuntosNormalizados);

  const actions = document.createElement('div');
  actions.className = 'form-actions';
  const cancelBtn = document.createElement('button');
  cancelBtn.className = 'btn btn-outline'; cancelBtn.textContent = 'Cancelar';
  cancelBtn.addEventListener('click', closeModal);
  const saveBtn = document.createElement('button');
  saveBtn.className = 'btn btn-primary';
  saveBtn.textContent = isEdit ? 'Salvar' : 'Criar Tarefa';
  saveBtn.addEventListener('click', async () => {
    const assunto_ids = getMultiSelectValues(msId);
    const payload = {
      tipo: tipoSel.value,
      tempo_estimado: parseInt(tempoSel.value) || 60,
      quantidade_questoes: parseInt(qInp.value) || 0,
      link_caderno: linkInp.value.trim(),
      assunto_ids,
      comando: cmdTa.value.trim(),
      hiperdica: hdTa.value.trim(),
      observacao: obsTa.value.trim(),
    };
    if (isEdit) {
      await api.put(`/api/plan-tarefas/${t.id}`, payload);
    } else {
      await api.post(`/api/plan-disciplinas/${planDisc.id}/tarefas`, payload);
    }
    closeModal(); showToast(isEdit ? 'Tarefa salva!' : 'Tarefa criada!', 'success'); if (onSave) onSave();
  });
  actions.append(cancelBtn, saveBtn);
  form.appendChild(actions);
  bodyEl.appendChild(form);
  document.getElementById('modal-overlay').classList.remove('hidden');
}

// Helpers do planejamento antigo mantidos para compatibilidade
function buildAssuntosTree(assuntos) {
  const norm = assuntos.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
  const raizes = norm.filter(a => !a.parent_id);
  const filhosMap = {};
  norm.forEach(a => { if (a.parent_id) { if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = []; filhosMap[a.parent_id].push(a); } });
  return { raizes, filhosMap, norm };
}
function renderAssuntosTreeHTML(assuntos, opcoes = {}) {
  const { checkable = false, checkedIds = new Set(), jaPlanejadosIds = new Set(), toggleClass = 'ass-toggle', checkClass = 'ass-check', filhosPrefix = 'filhos' } = opcoes;
  const { raizes, filhosMap } = buildAssuntosTree(assuntos);
  function renderNode(a, nivel = 0) {
    const filhos = filhosMap[a.id] || [];
    const pad = nivel * 20;
    const checked = checkedIds.has ? checkedIds.has(a.id) : checkedIds.includes(a.id);
    if (checkable) {
      return `<div><div style="display:flex;align-items:center;gap:8px;padding:7px 8px 7px ${8+pad}px;border-bottom:1px solid var(--border)">
        <input type="checkbox" class="${checkClass}" value="${a.id}" ${checked?'checked':''} ${filhos.length?'data-has-filhos="1"':''} style="accent-color:var(--primary);cursor:pointer;flex-shrink:0;width:15px;height:15px">
        ${filhos.length ? `<span class="${toggleClass}" data-id="${a.id}" data-prefix="${filhosPrefix}" style="cursor:pointer;color:var(--text-3);font-size:0.72rem;width:14px;flex-shrink:0;user-select:none">▶</span>` : '<span style="width:14px;flex-shrink:0;display:inline-block"></span>'}
        <span style="font-size:0.86rem;${nivel===0?'font-weight:600':''}"">${a.nome}</span>
      </div>${filhos.length?`<div class="${filhosPrefix}-${a.id} ${checked?'':'hidden'}" style="border-left:2px solid var(--border);margin-left:${20+pad}px">${filhos.map(f=>renderNode(f,nivel+1)).join('')}</div>`:''}</div>`;
    }
    return `<div><div style="display:flex;align-items:center;gap:8px;padding:6px 8px 6px ${8+pad}px;border-bottom:1px solid var(--border)">
      ${filhos.length?`<span class="${toggleClass}" data-id="${a.id}" data-prefix="${filhosPrefix}" style="cursor:pointer;color:var(--text-3);font-size:0.72rem;width:14px;flex-shrink:0;user-select:none">▶</span>`:'<span style="width:14px;flex-shrink:0;display:inline-block"></span>'}
      <span style="font-size:0.84rem;${nivel===0?'font-weight:600':''}"">${a.nome}</span>
    </div>${filhos.length?`<div class="${filhosPrefix}-${a.id} hidden" style="border-left:2px solid var(--border);margin-left:${20+pad}px">${filhos.map(f=>renderNode(f,nivel+1)).join('')}</div>`:''}</div>`;
  }
  if (!raizes.length) return buildAssuntosTree(assuntos).norm.map(a=>renderNode(a,0)).join('');
  return raizes.map(a => renderNode(a, 0)).join('');
}
function bindTreeToggles(container, prefix) {
  qsa(`[data-prefix="${prefix}"]`, container).forEach(toggle => {
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const div = container.querySelector(`.${prefix}-${toggle.dataset.id}`);
      if (div) { div.classList.toggle('hidden'); toggle.textContent = div.classList.contains('hidden') ? '▶' : '▼'; }
    });
  });
}
function bindTreeCheckboxes(container, checkClass, filhosPrefix, onChange) {
  qsa(`.${checkClass}[data-has-filhos]`, container).forEach(cb => {
    cb.addEventListener('change', () => {
      const div = container.querySelector(`.${filhosPrefix}-${cb.value}`);
      if (div) qsa(`.${checkClass}`, div).forEach(f => f.checked = cb.checked);
      if (onChange) onChange();
    });
  });
}
