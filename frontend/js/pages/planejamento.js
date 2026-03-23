// ── PLANEJAMENTO PAGE ─────────────────────────────────────────────────────────

async function renderPlanejamento(container) {
  const [planejamentos, alvoId] = await Promise.all([
    api.get('/api/planejamentos'),
    getConcursoAlvo()
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Planejamento</div><div class="page-subtitle">Organize seu estudo por concurso</div></div>
      <button class="btn btn-primary" id="novo-plan-btn">+ Novo Planejamento</button>
    </div>
    <div class="plan-cards-grid" id="plan-cards">
      ${planejamentos.length === 0 ? renderEmptyState('◈', 'Nenhum planejamento ainda. Clique em "+ Novo Planejamento" para começar.') : ''}
    </div>
  `;

  const grid = qs('#plan-cards', container);
  if (planejamentos.length > 0) {
    // Planejamento ativo = o que tem o mesmo id que alvoId (guardamos plan_id no config)
    const ativoId = alvoId;

    grid.innerHTML = planejamentos.map(p => {
      const dias = diasFaltando(p.data_prova);
      const diasStr = dias === null ? 'Sem data' : dias > 0 ? `${dias} dias` : dias === 0 ? 'Hoje!' : 'Encerrado';
      const pct = p.total_tarefas > 0 ? Math.round((p.tarefas_feitas / p.total_tarefas) * 100) : 0;
      const isAtivo = String(p.id) === String(ativoId);
      return `
        <div class="plan-card ${isAtivo ? 'plan-card-ativo' : ''}" data-id="${p.id}">
          ${isAtivo ? '<div class="plan-card-ativo-badge">● Em uso</div>' : ''}
          <div class="plan-card-header">
            <div class="plan-card-nome">${p.nome}</div>
            ${p.data_prova ? '<div class="plan-card-concurso">📅 ' + formatDate(p.data_prova) + ' · <strong>' + diasStr + '</strong></div>' : '<div class="plan-card-concurso" style="color:var(--text-3)">Sem data definida</div>'}
          </div>
          <div class="plan-card-body">
            <div class="plan-card-stat"><span class="plan-card-stat-label">Disciplinas</span><span class="plan-card-stat-val">${p.total_disciplinas}</span></div>
            <div class="plan-card-stat"><span class="plan-card-stat-label">Tarefas</span><span class="plan-card-stat-val">${p.tarefas_feitas}/${p.total_tarefas}</span></div>
          </div>
          ${p.total_tarefas > 0 ? '<div style="margin:10px 0 4px"><div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:' + pct + '%"></div></div><div style="font-size:0.7rem;color:var(--text-3);margin-top:3px">' + pct + '% concluído</div></div>' : ''}
          <div class="plan-card-actions">
            ${btnEditar('data-id="'+p.id+'" class="edit-plan-btn"')}
            ${btnApagar('data-id="'+p.id+'" class="del-plan-btn"')}
          </div>
        </div>`;
    }).join('');

    qsa('.plan-card', grid).forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('button')) return;
        window._app.navigate('planejamento-detalhe', { id: card.dataset.id });
      });
    });
    qsa('.edit-plan-btn', grid).forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); openPlanModal(btn.dataset.id, () => renderPlanejamento(container)); });
    });
    qsa('.del-plan-btn', grid).forEach(btn => {
      btn.addEventListener('click', async e => {
        e.stopPropagation();
        if (!confirm('Apagar este planejamento e todos os dados vinculados?')) return;
        await api.delete(`/api/planejamentos/${btn.dataset.id}`);
        showToast('Planejamento apagado'); renderPlanejamento(container);
      });
    });
  }
  qs('#novo-plan-btn', container).addEventListener('click', () => openPlanModal(null, () => renderPlanejamento(container)));
}

// ── PLANEJAMENTO DETALHE ──────────────────────────────────────────────────────

async function renderPlanejamentoDetalhe(container, params = {}) {
  const { id } = params;
  const [plan, todasDiscs] = await Promise.all([
    api.get(`/api/planejamentos/${id}`),
    api.get('/api/disciplinas')
  ]);

  const totalQ = plan.disciplinas.reduce((s, d) => s + (d.num_questoes || 0), 0);
  const totalPontos = plan.disciplinas.reduce((s, d) => s + ((d.num_questoes || 0) * (d.peso || 1)), 0);
  const dias = diasFaltando(plan.data_prova);
  const diasStr = dias === null ? 'Sem data' : dias > 0 ? `${dias} dias` : dias === 0 ? 'Hoje!' : 'Encerrado';
  const totalTarefas = plan.disciplinas.reduce((s, d) => s + (d.tarefas?.length || 0), 0);
  const tarefasFeitas = plan.disciplinas.reduce((s, d) => s + (d.tarefas?.filter(t => t.concluida).length || 0), 0);
  const pctConclusao = totalTarefas > 0 ? Math.round((tarefasFeitas / totalTarefas) * 100) : 0;
  resetProvaColors();

  container.innerHTML = `
    <a class="back-link" id="back-btn">← Planejamentos</a>
    <div class="page-header">
      <div><div class="page-title">${plan.nome}</div>
        <div class="page-subtitle">${plan.data_prova ? formatDate(plan.data_prova) + ' · ' + diasStr : 'Sem data definida'}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
        ${btnEditar('id="edit-plan-btn"')}
        <button class="btn btn-primary btn-sm" id="add-disc-btn">+ Disciplina</button>
      </div>
    </div>
    <div class="plan-detalhe-layout">
      <div class="plan-detalhe-main">
        <div class="card" style="margin-bottom:16px">
          <div style="padding:14px 20px;border-bottom:1px solid var(--border)">
            <div style="font-family:var(--font-display);font-weight:700;font-size:0.88rem">Edital</div>
          </div>
          <div class="table-wrap">
            <table><thead><tr>
              <th>Disciplina</th><th>Prova</th>
              <th class="td-right">Questões</th><th class="td-right">Peso</th>
              <th class="td-right">Pontos</th><th class="td-right">% Prova</th><th></th>
            </tr></thead>
            <tbody id="plan-disc-tbody">${renderTabelaDiscs(plan.disciplinas, totalPontos)}</tbody>
            </table>
          </div>
        </div>
      </div>
      <div class="plan-detalhe-side">
        <div class="card card-pad">
          <div style="font-family:var(--font-display);font-weight:700;font-size:0.78rem;text-transform:uppercase;letter-spacing:0.08em;color:var(--primary);margin-bottom:14px">Resumo</div>
          <div class="plan-resumo-item"><span>Data da prova</span><span>${plan.data_prova ? formatDate(plan.data_prova) : '—'}</span></div>
          <div class="plan-resumo-item"><span>Faltando</span><strong>${diasStr}</strong></div>
          <div class="plan-resumo-item"><span>Disciplinas</span><span>${plan.disciplinas.length}</span></div>
          <div class="plan-resumo-item"><span>Questões</span><span>${totalQ}</span></div>
          <div class="plan-resumo-item"><span>Tarefas</span><span>${tarefasFeitas}/${totalTarefas}</span></div>
          <div style="margin-top:12px">
            <div class="progress-label">${pctConclusao}% concluído</div>
            <div class="progress-bar-wrap"><div class="progress-bar-fill" style="width:${pctConclusao}%"></div></div>
          </div>
        </div>
      </div>
    </div>
    <div style="margin-top:8px">
      <div class="section-title" style="margin-bottom:12px">Disciplinas</div>
      <div id="plan-discs-list"></div>
    </div>
  `;

  qs('#back-btn', container).addEventListener('click', () => window._app.navigate('planejamento'));
  qs('#edit-plan-btn', container).addEventListener('click', () => openPlanModal(id, () => renderPlanejamentoDetalhe(container, params)));
  qs('#add-disc-btn', container).addEventListener('click', () => openAddDiscModal(id, todasDiscs, plan.disciplinas, () => renderPlanejamentoDetalhe(container, params)));

  qs('#plan-disc-tbody', container).addEventListener('click', async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    if (btn.dataset.action === 'del-disc') {
      if (!confirm('Remover disciplina?')) return;
      await api.delete(`/api/plan-disciplinas/${btn.dataset.id}`);
      showToast('Removida'); renderPlanejamentoDetalhe(container, params);
    }
    if (btn.dataset.action === 'edit-disc') {
      const d = plan.disciplinas.find(x => x.id == btn.dataset.id);
      if (d) openEditDiscModal(d, () => renderPlanejamentoDetalhe(container, params));
    }
  });

  renderDiscAccordions(plan.disciplinas, container, params);
}

function renderTabelaDiscs(disciplinas, totalPontos) {
  if (!disciplinas.length) return `<tr><td colspan="7" style="text-align:center;padding:24px;color:var(--text-3)">Nenhuma disciplina adicionada.</td></tr>`;
  const provas = [...new Set(disciplinas.map(d => d.prova).filter(Boolean))].sort();
  let rows = '';

  const renderDiscRow = (d) => {
    const pontos = (d.num_questoes||0) * (d.peso||1);
    const pct = totalPontos > 0 ? ((pontos/totalPontos)*100).toFixed(1) : '—';
    return `<tr>
      <td class="fw-600">${d.disciplina_nome}</td>
      <td>${d.prova ? provaTag(d.prova) : '—'}</td>
      <td class="td-right">${d.num_questoes||0}</td>
      <td class="td-right">${d.peso||1}</td>
      <td class="td-right">${pontos.toFixed(1)}</td>
      <td class="td-right">${pct !== '—' ? pct+'%' : '—'}</td>
      <td style="white-space:nowrap">
        ${btnEditar('data-action="edit-disc" data-id="'+d.id+'"')}
        ${btnApagar('data-action="del-disc" data-id="'+d.id+'"')}
      </td>
    </tr>`;
  };

  if (provas.length > 0) {
    provas.forEach(prova => {
      const discs = disciplinas.filter(d => d.prova === prova);
      const cor = getProvaColor(prova);
      const provaPontos = discs.reduce((s,d) => s+((d.num_questoes||0)*(d.peso||1)), 0);
      const provaQ = discs.reduce((s,d) => s+(d.num_questoes||0), 0);
      const provaPct = totalPontos > 0 ? ((provaPontos/totalPontos)*100).toFixed(1) : '—';
      rows += `<tr style="background:${cor}">
        <td colspan="2" style="color:#fff;font-weight:700;font-size:0.78rem;padding:8px 14px;letter-spacing:0.05em">${prova}</td>
        <td class="td-right" style="color:#fff;font-weight:700">${provaQ}</td>
        <td style="color:#fff"></td>
        <td class="td-right" style="color:#fff;font-weight:700">${provaPontos.toFixed(1)}</td>
        <td class="td-right" style="color:#fff;font-weight:700">${provaPct !== '—' ? provaPct+'%' : '—'}</td>
        <td style="background:${cor}"></td>
      </tr>`;
      discs.forEach(d => { rows += renderDiscRow(d); });
    });
    const semProva = disciplinas.filter(d => !d.prova);
    if (semProva.length) {
      rows += `<tr style="background:var(--text-3)"><td colspan="7" style="color:#fff;font-weight:700;font-size:0.72rem;padding:6px 14px">SEM PROVA</td></tr>`;
      semProva.forEach(d => { rows += renderDiscRow(d); });
    }
  } else {
    disciplinas.forEach(d => { rows += renderDiscRow(d); });
  }

  const totalDiscs = disciplinas.reduce((s,d) => s+(d.num_questoes||0), 0);
  rows += `<tr style="background:var(--primary-bg);font-weight:700;border-top:2px solid var(--border)">
    <td colspan="2" style="font-family:var(--font-display)">TOTAL</td>
    <td class="td-right">${totalDiscs}</td><td></td>
    <td class="td-right">${totalPontos.toFixed(1)}</td>
    <td class="td-right">100%</td><td></td>
  </tr>`;
  return rows;
}

function renderDiscAccordions(disciplinas, container, params) {
  const listEl = qs('#plan-discs-list', container);
  if (!disciplinas.length) { listEl.innerHTML = renderEmptyState('▹', 'Adicione disciplinas ao planejamento.'); return; }
  listEl.innerHTML = '';
  disciplinas.forEach(d => {
    const tarefasFeitas = (d.tarefas||[]).filter(t=>t.concluida).length;
    const totalTarefas = (d.tarefas||[]).length;
    const pct = totalTarefas > 0 ? Math.round((tarefasFeitas/totalTarefas)*100) : 0;
    const assuntos = d.assuntos || [];
    const assuntosPais = assuntos.filter(a => !a.parent_id);
    const numAssuntos = assuntosPais.length || assuntos.length;

    const item = document.createElement('div');
    item.className = 'accordion-item';
    item.innerHTML = `
      <div class="accordion-header">
        <span class="accordion-arrow">▶</span>
        <span class="disc-acc-nome">${d.disciplina_nome}</span>
        <div class="disc-acc-badges">
          ${d.prova ? provaTag(d.prova) : ''}
          <span class="text-small text-muted">${numAssuntos} assunto${numAssuntos!==1?'s':''}</span>
          <span class="text-small text-muted">${tarefasFeitas}/${totalTarefas} tarefas</span>
          ${totalTarefas > 0 ? '<span class="acerto-badge ' + (pct>=100?'acerto-green-dark':pct>0?'acerto-yellow':'acerto-none') + '">' + pct + '%</span>' : ''}
        </div>
      </div>
      <div class="accordion-body" id="plan-disc-body-${d.id}">
        ${renderDiscBodyAccordion(d)}
      </div>`;
    listEl.appendChild(item);

    const header = item.querySelector('.accordion-header');
    header.addEventListener('click', () => item.classList.toggle('open'));

    const bodyEl = item.querySelector(`#plan-disc-body-${d.id}`);

    bodyEl.querySelectorAll('.acc-tarefa-topico-header').forEach(h => {
      h.addEventListener('click', () => {
        const paiId = h.dataset.paiId;
        const filhosEl = bodyEl.querySelector(`.tt-filhos-${paiId}`);
        const arrow = h.querySelector('.tt-arrow');
        if (filhosEl) {
          filhosEl.classList.toggle('hidden');
          if (arrow) arrow.textContent = filhosEl.classList.contains('hidden') ? '▶' : '▼';
        }
      });
    });

    const ntToggle = bodyEl.querySelector('.nt-toggle-btn');
    const ntForm = bodyEl.querySelector('.nt-form');
    if (ntToggle && ntForm) {
      const ntCancelar = ntForm.querySelector('.nt-cancelar-btn');
      const ntSalvar = ntForm.querySelector('.nt-salvar-btn');
      ntToggle.addEventListener('click', () => ntForm.classList.toggle('hidden'));
      ntCancelar.addEventListener('click', () => {
        ntForm.classList.add('hidden');
        ntForm.querySelector('.nt-data').value = '';
        ntForm.querySelector('.nt-tipo').value = '';
        ntForm.querySelectorAll('.nt-assunto-check').forEach(cb => { cb.checked = false; });
      });
      ntSalvar.addEventListener('click', async () => {
        const data_execucao = ntForm.querySelector('.nt-data').value;
        const tipo = ntForm.querySelector('.nt-tipo').value;
        const assunto_ids = [...ntForm.querySelectorAll('.nt-assunto-check:checked')].map(cb => parseInt(cb.value));
        await api.post(`/api/plan-disciplinas/${d.id}/tarefas`, { data_execucao, tipo, assunto_ids });
        showToast('Tarefa criada!');
        renderPlanejamentoDetalhe(container, params);
      });
    }
  });
}

// Helper: constrói árvore hierárquica de assuntos a partir de lista plana
// Os assuntos do backend têm {assunto_id, nome, codigo, parent_id}
function buildAssuntosTree(assuntos) {
  // normaliza: garante que .id existe
  const norm = assuntos.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
  const raizes = norm.filter(a => !a.parent_id);
  const filhosMap = {};
  norm.forEach(a => {
    if (a.parent_id) {
      if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
      filhosMap[a.parent_id].push(a);
    }
  });
  return { raizes, filhosMap, norm };
}

function renderAssuntosTreeHTML(assuntos, opcoes = {}) {
  const { checkable = false, checkedIds = new Set(), jaPlanejadosIds = new Set(), toggleClass = 'ass-toggle', checkClass = 'ass-check', filhosPrefix = 'filhos' } = opcoes;
  const { raizes, filhosMap } = buildAssuntosTree(assuntos);

  function renderNode(a, nivel = 0) {
    const filhos = filhosMap[a.id] || [];
    const pad = nivel * 20;
    const checked = checkedIds.has(a.id);
    const jaPlanejado = jaPlanejadosIds.has(a.id) && !checked;

    if (checkable) {
      return `<div>
        <div style="display:flex;align-items:center;gap:8px;padding:7px 8px 7px ${8+pad}px;border-bottom:1px solid var(--border)">
          <input type="checkbox" class="${checkClass}" value="${a.id}" ${checked?'checked':''} ${filhos.length?'data-has-filhos="1"':''} style="accent-color:var(--primary);cursor:pointer;flex-shrink:0;width:15px;height:15px">
          ${filhos.length
            ? `<span class="${toggleClass}" data-id="${a.id}" data-prefix="${filhosPrefix}" style="cursor:pointer;color:var(--text-3);font-size:0.72rem;width:14px;flex-shrink:0;user-select:none">${checked?'▼':'▶'}</span>`
            : '<span style="width:14px;flex-shrink:0;display:inline-block"></span>'}
          <span style="font-size:0.72rem;color:var(--text-3);min-width:40px;flex-shrink:0">${a.codigo||''}</span>
          <span style="font-size:0.86rem;${nivel===0?'font-weight:600':''}">${a.nome}</span>
          ${jaPlanejado ? '<span style="font-size:0.68rem;background:var(--green-bg);color:var(--green-dark);padding:1px 7px;border-radius:10px;margin-left:auto;flex-shrink:0;white-space:nowrap">✓ planejado</span>' : ''}
        </div>
        ${filhos.length ? `<div class="${filhosPrefix}-${a.id} ${checked?'':'hidden'}" style="border-left:2px solid var(--border);margin-left:${20+pad}px">${filhos.map(f=>renderNode(f,nivel+1)).join('')}</div>` : ''}
      </div>`;
    } else {
      return `<div>
        <div style="display:flex;align-items:center;gap:8px;padding:6px 8px 6px ${8+pad}px;border-bottom:1px solid var(--border)">
          ${filhos.length
            ? `<span class="${toggleClass}" data-id="${a.id}" data-prefix="${filhosPrefix}" style="cursor:pointer;color:var(--text-3);font-size:0.72rem;width:14px;flex-shrink:0;user-select:none">▶</span>`
            : '<span style="width:14px;flex-shrink:0;display:inline-block"></span>'}
          <span style="font-size:0.72rem;color:var(--text-3);min-width:40px;flex-shrink:0">${a.codigo||''}</span>
          <span style="font-size:0.84rem;${nivel===0?'font-weight:600':''}">${a.nome}</span>
        </div>
        ${filhos.length ? `<div class="${filhosPrefix}-${a.id} hidden" style="border-left:2px solid var(--border);margin-left:${20+pad}px">${filhos.map(f=>renderNode(f,nivel+1)).join('')}</div>` : ''}
      </div>`;
    }
  }

  if (!raizes.length) {
    // fallback: mostra todos sem hierarquia se não há raizes
    const { norm } = buildAssuntosTree(assuntos);
    return norm.map(a => renderNode(a, 0)).join('');
  }
  return raizes.map(a => renderNode(a, 0)).join('');
}

function bindTreeToggles(container, prefix) {
  qsa(`[data-prefix="${prefix}"]`, container).forEach(toggle => {
    toggle.addEventListener('click', e => {
      e.stopPropagation();
      const div = container.querySelector(`.${prefix}-${toggle.dataset.id}`);
      if (div) {
        div.classList.toggle('hidden');
        toggle.textContent = div.classList.contains('hidden') ? '▶' : '▼';
      }
    });
  });
}

function bindTreeCheckboxes(container, checkClass, filhosPrefix, onChange) {
  // Pai → marca/desmarca todos os filhos (SEM expandir automaticamente)
  qsa(`.${checkClass}[data-has-filhos]`, container).forEach(cb => {
    cb.addEventListener('change', () => {
      const div = container.querySelector(`.${filhosPrefix}-${cb.value}`);
      if (div) {
        // NÃO expande/recolhe — só marca/desmarca os filhos mantendo estado visual atual
        qsa(`.${checkClass}`, div).forEach(f => f.checked = cb.checked);
      }
      if (onChange) onChange();
    });
  });
  // Filho → ao marcar, garante que o pai apareça marcado (sem marcar outros filhos)
  qsa(`.${checkClass}:not([data-has-filhos])`, container).forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        // Sobe na DOM para encontrar o pai
        let el = cb.closest(`[class*="${filhosPrefix}-"]`);
        while (el) {
          // Extrai o id do pai do nome da classe
          const match = el.className.match(new RegExp(`${filhosPrefix}-(\\d+)`));
          if (match) {
            const paiId = match[1];
            const paiCheck = container.querySelector(`.${checkClass}[value="${paiId}"]`);
            if (paiCheck && !paiCheck.checked) {
              paiCheck.checked = true;
              // Mostra os filhos
              const filhosDiv = container.querySelector(`.${filhosPrefix}-${paiId}`);
              if (filhosDiv) filhosDiv.classList.remove('hidden');
              const toggle = container.querySelector(`[data-prefix="${filhosPrefix}"][data-id="${paiId}"]`);
              if (toggle) toggle.textContent = '▼';
            }
          }
          el = el.parentElement?.closest(`[class*="${filhosPrefix}-"]`);
        }
      }
      if (onChange) onChange();
    });
  });
}

function renderDiscBodyAccordion(d) {
  const raw = d.assuntos || [];
  const assuntos = raw.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
  const pais = assuntos.filter(a => !a.parent_id);
  const filhosMap = {};
  assuntos.forEach(a => {
    if (a.parent_id) {
      if (!filhosMap[a.parent_id]) filhosMap[a.parent_id] = [];
      filhosMap[a.parent_id].push(a);
    }
  });

  const assuntosHtml = pais.length
    ? pais.map(a => `<div style="display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid var(--border)">
        <span style="font-size:0.72rem;color:var(--text-3);min-width:40px;flex-shrink:0">${a.codigo||''}</span>
        <span style="font-size:0.85rem;font-weight:600">${a.nome}</span>
      </div>`).join('')
    : '<span class="text-muted text-small">Nenhum assunto vinculado.</span>';

  const tarefas = d.tarefas || [];
  const tiposOpcoes = ['estratégia', 'vídeo', 'exercícios', 'revisão', 'simulado'];

  function renderTarefaRow(t, idx) {
    const tIds = t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : [];
    const paisDaTarefa = pais.filter(p => tIds.includes(p.id));
    const tipoLabel = t.tipo ? `<span class="acerto-badge acerto-none" style="font-size:0.68rem">${t.tipo}</span>` : '';
    const dataLabel = t.data_execucao ? `<span style="font-size:0.72rem;color:var(--text-3)">📅 ${formatDate(t.data_execucao)}</span>` : '';
    const isDone = !!t.concluida;
    const doneStyle = isDone ? 'opacity:0.55;' : '';
    const strikeStyle = isDone ? 'text-decoration:line-through;color:var(--text-3);' : '';
    const checkIcon = isDone ? '<span style="color:var(--green);font-weight:700;font-size:0.78rem;flex-shrink:0" title="Concluída">✓</span>' : '';
    const topicosHtml = paisDaTarefa.map(pai => {
      const filhosDoPai = (filhosMap[pai.id] || []).filter(f => tIds.includes(f.id));
      return `<div class="acc-tarefa-topico">
        <div class="acc-tarefa-topico-header" data-pai-id="${pai.id}" style="display:flex;align-items:center;gap:6px;cursor:pointer;padding:3px 0">
          ${filhosDoPai.length ? '<span class="tt-arrow" style="font-size:0.7rem;color:var(--text-3)">▶</span>' : '<span style="width:10px;display:inline-block"></span>'}
          <span style="font-size:0.82rem;font-weight:600;${strikeStyle}">${pai.nome}</span>
        </div>
        ${filhosDoPai.length ? `<div class="tt-filhos-${pai.id} hidden" style="padding-left:14px;border-left:2px solid var(--border)">
          ${filhosDoPai.map(f => `<div style="font-size:0.79rem;padding:2px 0;color:var(--text-2);${strikeStyle}">${f.nome}</div>`).join('')}
        </div>` : ''}
      </div>`;
    }).join('');
    return `<div style="padding:8px 0;border-bottom:1px solid var(--border);${doneStyle}">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:${topicosHtml ? '6px' : '0'}">
        ${checkIcon}
        <span style="font-weight:700;color:${isDone ? 'var(--green)' : 'var(--primary)'};font-size:0.8rem;min-width:18px;${strikeStyle}">${idx+1}.</span>
        ${tipoLabel}${dataLabel}
      </div>
      ${topicosHtml}
    </div>`;
  }

  const tarefasHtml = tarefas.length
    ? tarefas.map((t, i) => renderTarefaRow(t, i)).join('')
    : '<div class="text-muted text-small" style="padding:6px 0">Nenhuma tarefa.</div>';

  const checkboxesAssuntos = pais.map(p => `
    <label style="display:flex;align-items:center;gap:6px;font-size:0.83rem;cursor:pointer">
      <input type="checkbox" class="nt-assunto-check" value="${p.id}" style="accent-color:var(--primary)">
      ${p.nome}
    </label>`).join('');

  return `<div style="padding:16px 20px">
    <div style="display:grid;grid-template-columns:1fr 1.5fr;gap:20px">
      <div>
        <div class="section-title" style="margin-bottom:10px">Assuntos</div>
        ${assuntosHtml}
      </div>
      <div>
        <div class="section-title" style="margin-bottom:10px">Tarefas</div>
        <div class="acc-tarefas-list">${tarefasHtml}</div>
        <div style="margin-top:12px">
          <button class="btn btn-outline btn-sm nt-toggle-btn">+ Nova tarefa</button>
          <div class="nt-form hidden" style="margin-top:10px;padding:12px;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-2)">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:10px">
              <div class="form-group" style="margin:0">
                <label style="font-size:0.78rem">Data</label>
                <input type="date" class="nt-data">
              </div>
              <div class="form-group" style="margin:0">
                <label style="font-size:0.78rem">Tipo</label>
                <select class="nt-tipo">
                  <option value="">— tipo —</option>
                  ${tiposOpcoes.map(tp => `<option value="${tp}">${tp}</option>`).join('')}
                </select>
              </div>
            </div>
            ${pais.length ? `<div style="margin-bottom:10px">
              <div style="font-size:0.78rem;color:var(--text-3);margin-bottom:6px">Assuntos</div>
              <div style="display:flex;flex-direction:column;gap:4px">${checkboxesAssuntos}</div>
            </div>` : ''}
            <div style="display:flex;gap:8px">
              <button class="btn btn-primary btn-sm nt-salvar-btn">Salvar</button>
              <button class="btn btn-outline btn-sm nt-cancelar-btn">Cancelar</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

// Bind toggles no accordion body depois de renderizar
function bindAccordionBodyToggles(container, discId) {
  const bodyEl = qs(`#plan-disc-body-${discId}`, container);
  if (bodyEl) bindTreeToggles(bodyEl, 'acc-filhos');
}

// ── PLANEJAMENTO DISCIPLINA ───────────────────────────────────────────────────

async function renderPlanejamentoDisciplina(container, params = {}) {
  const { plan_id, disc_id } = params;
  const plan = await api.get(`/api/planejamentos/${plan_id}`);
  const planDisc = plan.disciplinas.find(d => d.id == disc_id);
  if (!planDisc) { container.innerHTML = '<p>Disciplina não encontrada.</p>'; return; }

  const allAssuntos = await api.get(`/api/assuntos?disciplina_id=${planDisc.disciplina_id}`);
  const assuntosVinculados = planDisc.assuntos || [];
  const tarefas = planDisc.tarefas || [];

  // Assuntos já planejados (ids presentes em alguma tarefa)
  const assuntosJaPlanejados = new Set();
  tarefas.forEach(t => {
    if (t.assunto_ids) t.assunto_ids.split(',').filter(Boolean).forEach(id => assuntosJaPlanejados.add(parseInt(id)));
  });

  // Conta pais vinculados
  const { raizes: raizsVinc } = buildAssuntosTree(assuntosVinculados);
  const totalVinculados = raizsVinc.length || assuntosVinculados.length;
  // Pai está planejado se ele ou qualquer filho está na lista
  const vinculadosNorm = assuntosVinculados.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
  const filhosMapVinc = {};
  vinculadosNorm.forEach(a => { if(a.parent_id){if(!filhosMapVinc[a.parent_id])filhosMapVinc[a.parent_id]=[];filhosMapVinc[a.parent_id].push(a);} });
  const totalPlanejados = raizsVinc.filter(pai => {
    if (assuntosJaPlanejados.has(pai.id)) return true;
    return (filhosMapVinc[pai.id] || []).some(f => assuntosJaPlanejados.has(f.id));
  }).length;

  container.innerHTML = `
    <a class="back-link" id="back-btn">← ${plan.nome}</a>
    <div class="page-header">
      <div>
        <div class="page-title">${planDisc.disciplina_nome}</div>
        <div class="page-subtitle">${plan.nome}${planDisc.prova ? ' · ' + planDisc.prova : ''}</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" id="gerir-assuntos-btn">📚 Assuntos</button>
        <button class="btn btn-primary" id="nova-tarefa-btn">+ Criar Tarefa</button>
      </div>
    </div>
    <div class="metrics-grid" style="margin-bottom:20px">
      ${renderMetricCard('Assuntos vinculados', totalVinculados)}
      ${renderMetricCard('Assuntos planejados', `${totalPlanejados}/${totalVinculados}`, totalVinculados > 0 ? Math.round((totalPlanejados/totalVinculados)*100)+'%' : '')}
      ${renderMetricCard('Tarefas', tarefas.length)}
      ${renderMetricCard('Concluídas', `${tarefas.filter(t=>t.concluida).length}/${tarefas.length}`)}
    </div>
    <div id="assuntos-section" style="margin-bottom:20px"></div>
    <div id="tarefas-container"></div>
  `;

  qs('#back-btn', container).addEventListener('click', () => window._app.navigate('planejamento-detalhe', { id: plan_id }));
  qs('#gerir-assuntos-btn', container).addEventListener('click', () => openAssuntosVinculadosModal(disc_id, planDisc.disciplina_id, assuntosVinculados, allAssuntos, () => renderPlanejamentoDisciplina(container, params)));
  qs('#nova-tarefa-btn', container).addEventListener('click', () => openTarefaModal(null, disc_id, allAssuntos, assuntosVinculados, assuntosJaPlanejados, () => renderPlanejamentoDisciplina(container, params)));

  // Renderiza seção de assuntos ANTES das tarefas
  renderAssuntosSection(assuntosVinculados, assuntosJaPlanejados, container, tarefas);
  renderTarefasLista(tarefas, planDisc, allAssuntos, container, params);
}


function renderAssuntosSection(assuntosVinculados, assuntosJaPlanejados, container, tarefas) {
  const sec = qs('#assuntos-section', container);
  if (!sec) return;

  if (!assuntosVinculados.length) {
    sec.innerHTML = '';
    return;
  }

  // Constrói árvore dos assuntos vinculados
  const norm = assuntosVinculados.map(a => ({ ...a, id: a.assunto_id ?? a.id }));
  const raizes = norm.filter(a => !a.parent_id);
  const filhosMap = {};
  norm.forEach(a => { if(a.parent_id){if(!filhosMap[a.parent_id])filhosMap[a.parent_id]=[];filhosMap[a.parent_id].push(a);} });

   function renderNode(a, nivel=0) {
    const filhos = filhosMap[a.id] || [];
    const pad = nivel * 20;
    const toggleHtml = filhos.length
      ? '<span class="ass-sec-toggle" data-id="' + a.id + '" style="cursor:pointer;color:var(--text-3);font-size:0.72rem;width:14px;flex-shrink:0;user-select:none">▶</span>'
      : '<span style="width:14px;flex-shrink:0;display:inline-block"></span>';
    const boldStyle = nivel === 0 ? 'font-weight:600;' : '';
    let tarefaBadges = '';
    if (tarefas && tarefas.length) {
      const tarefasDoAssunto = tarefas.filter(t => {
        const ids = t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : [];
        return ids.includes(a.id);
      });
      if (tarefasDoAssunto.length) {
        const nums = tarefas.map((t, idx) => tarefasDoAssunto.includes(t) ? (idx+1) : null).filter(n => n !== null);
        tarefaBadges = nums.map(n => '<span style="font-size:0.7rem;background:var(--primary);color:#fff;padding:2px 9px;border-radius:10px;margin-left:4px;white-space:nowrap;flex-shrink:0;font-weight:600">Tarefa ' + n + '</span>').join('');
      }
    }
    const filhosHtml = filhos.length
      ? '<div class="ass-sec-filhos-' + a.id + ' hidden" style="border-left:2px solid var(--border);margin-left:22px">' + filhos.map(f => renderNode(f, nivel+1)).join('') + '</div>'
      : '';
    return '<div>'
      + '<div style="display:flex;align-items:center;gap:8px;padding:7px 8px 7px ' + (8+pad) + 'px;border-bottom:1px solid var(--border)">'
      + toggleHtml
      + '<span style="font-size:0.72rem;color:var(--text-3);min-width:40px;flex-shrink:0">' + (a.codigo||'') + '</span>'
      + '<span style="font-size:0.86rem;' + boldStyle + '">' + a.nome + '</span>'
      + tarefaBadges
      + '</div>'
      + filhosHtml
      + '</div>';
  }

  sec.innerHTML = `
    <div class="card">
      <div style="padding:12px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
        <div style="font-family:var(--font-display);font-weight:700;font-size:0.84rem">Assuntos do Planejamento</div>
        <span style="font-size:0.78rem;color:var(--text-3)">${norm.length} assunto${norm.length!==1?'s':''}</span>
      </div>
      <div id="ass-sec-tree" style="max-height:280px;overflow-y:auto;overflow-x:hidden">
        ${raizes.map(a => renderNode(a)).join('')}
      </div>
    </div>`;

  // Bind toggles
  qsa('.ass-sec-toggle', sec).forEach(t => {
    t.addEventListener('click', () => {
      const div = sec.querySelector('.ass-sec-filhos-' + t.dataset.id);
      if (div) { div.classList.toggle('hidden'); t.textContent = div.classList.contains('hidden') ? '▶' : '▼'; }
    });
  });
}

function renderTarefasLista(tarefas, planDisc, allAssuntos, container, params) {
  const tc = qs('#tarefas-container', container);
  if (!tarefas.length) { tc.innerHTML = renderEmptyState('○', 'Nenhuma tarefa ainda. Clique em "+ Criar Tarefa".'); return; }

  tc.innerHTML = tarefas.map((t, i) => renderTarefaCard(t, i, allAssuntos)).join('');

  function bindDragDrop(ordemAtual) {
    let dragSrcId = null;
    qsa('[data-tarefa-id]', tc).forEach(card => {
      card.addEventListener('dragstart', e => {
        dragSrcId = card.dataset.tarefaId;
        setTimeout(() => card.classList.add('dragging'), 0);
        e.dataTransfer.effectAllowed = 'move';
      });
      card.addEventListener('dragend', () => {
        card.classList.remove('dragging');
        qsa('.drag-over', tc).forEach(c => c.classList.remove('drag-over'));
      });
      card.addEventListener('dragover', e => {
        e.preventDefault();
        if (card.dataset.tarefaId !== dragSrcId) {
          qsa('.drag-over', tc).forEach(c => c.classList.remove('drag-over'));
          card.classList.add('drag-over');
        }
      });
      card.addEventListener('drop', async e => {
        e.preventDefault();
        card.classList.remove('drag-over');
        if (!dragSrcId || dragSrcId === card.dataset.tarefaId) return;

        // Reordena array
        const cards = [...qsa('[data-tarefa-id]', tc)];
        const srcIdx = cards.findIndex(c => c.dataset.tarefaId === dragSrcId);
        const dstIdx = cards.findIndex(c => c.dataset.tarefaId === card.dataset.tarefaId);
        const novaOrdem = [...ordemAtual];
        const [moved] = novaOrdem.splice(srcIdx, 1);
        novaOrdem.splice(dstIdx, 0, moved);

        // Salva no backend
        await api.put('/api/plan-tarefas/reordenar', {
          itens: novaOrdem.map((t, idx) => ({ id: t.id, ordem: idx + 1 }))
        });

        // Atualiza UI com nova numeração
        tc.innerHTML = novaOrdem.map((t, i) => renderTarefaCard(t, i, allAssuntos)).join('');
        bindDragDrop(novaOrdem);
        bindTarefasEvents(tc, novaOrdem, planDisc, allAssuntos, container, params);
        showToast('Ordem salva!', 'success');
      });
    });
  }

  bindDragDrop(tarefas);
  bindTarefasEvents(tc, tarefas, planDisc, allAssuntos, container, params);
}

function bindTarefasEvents(tc, tarefas, planDisc, allAssuntos, container, params) {
  tc.removeEventListener('click', tc._clickHandler);
  tc._clickHandler = async e => {
    const btn = e.target.closest('[data-action]');
    if (!btn) return;
    const tid = btn.dataset.id;
    if (btn.dataset.action === 'concluir') {
      const t = tarefas.find(x => x.id == tid);
      await api.put(`/api/plan-tarefas/${tid}`, { concluida: !t?.concluida });
      renderPlanejamentoDisciplina(container, params);
    }
    if (btn.dataset.action === 'editar') {
      const assuntosJaPlanejados = new Set();
      tarefas.filter(t => t.id != tid).forEach(t => {
        if (t.assunto_ids) t.assunto_ids.split(',').filter(Boolean).forEach(id => assuntosJaPlanejados.add(parseInt(id)));
      });
      openTarefaModal(tid, planDisc.id, allAssuntos, planDisc.assuntos||[], assuntosJaPlanejados, () => renderPlanejamentoDisciplina(container, params));
    }
    if (btn.dataset.action === 'apagar') {
      if (!confirm('Apagar tarefa?')) return;
      await api.delete(`/api/plan-tarefas/${tid}`);
      showToast('Tarefa apagada'); renderPlanejamentoDisciplina(container, params);
    }
  };
  tc.addEventListener('click', tc._clickHandler);
}

function renderTarefaCard(t, idx, allAssuntos) {
  const assuntoIds = t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : [];
  const assuntosMap = {};
  allAssuntos.forEach(a => { assuntosMap[a.id] = a; });

  // Monta hierarquia: pais primeiro, filhos indentados abaixo
  const raizes = assuntoIds.filter(id => !assuntosMap[id]?.parent_id);
  const filhosOrfaos = assuntoIds.filter(id => assuntosMap[id]?.parent_id && !assuntoIds.includes(assuntosMap[id].parent_id));

  let assuntosHtml = '';
  const processar = (id, nivel) => {
    const a = assuntosMap[id];
    if (!a) return '';
    const pad = nivel * 12;
    const filhosDeste = assuntoIds.filter(fid => assuntosMap[fid]?.parent_id === id);
    let html = `<div style="display:flex;align-items:center;gap:6px;padding:3px 0 3px ${pad}px">
      <span style="color:var(--text-3);font-size:0.68rem;flex-shrink:0">${nivel > 0 ? '↳' : '•'}</span>
      <span style="font-size:0.82rem;${nivel===0?'font-weight:600;':''}">${a.nome}</span>
    </div>`;
    filhosDeste.forEach(fid => { html += processar(fid, nivel + 1); });
    return html;
  };
  raizes.forEach(id => { assuntosHtml += processar(id, 0); });
  filhosOrfaos.forEach(id => { assuntosHtml += processar(id, 0); });

  const tipoLabel = t.tipo ? '<span class="acerto-badge acerto-none" style="font-size:0.68rem">' + t.tipo + '</span>' : '';
  const numLabel = '<span class="plan-tarefa-num-badge">' + (idx + 1) + '</span>';
  const concluidaOverlay = t.concluida ? '<div class="plan-tarefa-concluida-overlay"><span>✓ Concluída</span></div>' : '';

  return `
    <div class="plan-tarefa-card ${t.concluida ? 'concluida' : ''}" data-tarefa-id="${t.id}" draggable="true">
      ${concluidaOverlay}
      <div class="plan-tarefa-drag-handle">⠿</div>
      ${numLabel}
      <div class="plan-tarefa-card-top">
        <button class="plan-tarefa-check ${t.concluida ? 'checked' : ''}" data-action="concluir" data-id="${t.id}" title="${t.concluida ? 'Desmarcar' : 'Marcar como concluída'}">
          ${t.concluida ? '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' : ''}
        </button>
        <div class="plan-tarefa-info">
          <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
            ${tipoLabel}
            ${t.data_execucao ? '<div class="plan-tarefa-data">📅 ' + formatDate(t.data_execucao) + '</div>' : ''}
          </div>
          ${assuntosHtml ? '<div class="plan-tarefa-assuntos-tree">' + assuntosHtml + '</div>' : ''}
          ${t.fonte ? '<div class="plan-tarefa-fonte">📖 ' + t.fonte + '</div>' : ''}
          ${t.link_caderno ? '<div><a href="' + t.link_caderno + '" target="_blank" class="plan-tarefa-link">🔗 Caderno Tec →</a></div>' : ''}
          ${t.o_que_fazer ? '<div class="plan-tarefa-oq">' + t.o_que_fazer + '</div>' : ''}
        </div>
        <div class="plan-tarefa-actions">
          ${btnEditar('data-action="editar" data-id="'+t.id+'"')}
          ${btnApagar('data-action="apagar" data-id="'+t.id+'"')}
        </div>
      </div>
    </div>`;
}

// ── MODAIS ────────────────────────────────────────────────────────────────────

async function openPlanModal(id, onSave) {
  const [todasDiscs, todosPlans] = await Promise.all([
    api.get('/api/disciplinas'),
    api.get('/api/planejamentos')
  ]);
  let plan = null;
  if (id) plan = await api.get(`/api/planejamentos/${id}`);

  const discRows = todasDiscs.map(d => {
    const cd = plan?.disciplinas?.find(pd => pd.disciplina_id === d.id) || {};
    const checked = !!cd.disciplina_id;
    return `<div class="plan-disc-config-row">
      <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
        <input type="checkbox" class="pd-check" value="${d.id}" ${checked?'checked':''} style="accent-color:var(--primary);width:15px;height:15px">
        <span style="font-size:0.87rem;font-weight:500">${d.nome}</span>
      </label>
      <select class="pd-prova" data-disc="${d.id}" style="width:70px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px;font-size:0.82rem">
        <option value="">—</option>
        ${PROVAS_OPCOES.map(p=>`<option value="${p}" ${cd.prova===p?'selected':''}>${p}</option>`).join('')}
      </select>
      <input type="number" class="pd-questoes" data-disc="${d.id}" value="${cd.num_questoes||''}" placeholder="Q" min="0"
        style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">
      <input type="number" class="pd-peso" data-disc="${d.id}" value="${cd.peso||1}" placeholder="Peso" min="0" step="0.5"
        style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">
    </div>`;
  }).join('');

  openModal(id ? 'Editar Planejamento' : 'Novo Planejamento', `
    <div class="form-row">
      <div class="form-group" style="flex:2">
        <label>Nome do Concurso *</label>
        <input type="text" id="pl-nome" value="${plan?.nome||''}" placeholder="Ex: SEFAZ GO 2025">
      </div>
      <div class="form-group">
        <label>Data da Prova</label>
        <input type="date" id="pl-data" value="${plan?.data_prova||''}">
      </div>
    </div>
    <div class="section-title" style="margin-top:8px;margin-bottom:8px">Disciplinas do Edital</div>
    <div style="font-size:0.72rem;color:var(--text-3);margin-bottom:6px;display:grid;grid-template-columns:1fr 70px 65px 65px;gap:8px;padding:0 4px">
      <span>Disciplina</span><span style="text-align:center">Prova</span><span style="text-align:center">Questões</span><span style="text-align:center">Peso</span>
    </div>
    <div style="max-height:260px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 8px" id="pl-discs-list">
      ${discRows}
      <div style="padding:10px 4px;border-top:1px solid var(--border);margin-top:6px">
        <button type="button" class="btn btn-outline btn-sm" id="nova-disc-inline-btn">+ Nova disciplina</button>
        <div id="nova-disc-inline" class="hidden" style="margin-top:8px;display:flex;gap:8px;align-items:center">
          <input type="text" id="nova-disc-nome" placeholder="Nome da disciplina" style="flex:1;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:7px 10px;font-size:0.84rem">
          <button type="button" class="btn btn-success btn-sm" id="criar-disc-inline-btn">Criar</button>
        </div>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-plan-btn">Salvar</button>
    </div>
  `);

  qs('#nova-disc-inline-btn').addEventListener('click', () => {
    qs('#nova-disc-inline').classList.remove('hidden');
    qs('#nova-disc-nome').focus();
  });

  qs('#criar-disc-inline-btn').addEventListener('click', async () => {
    const nome = qs('#nova-disc-nome').value.trim();
    if (!nome) return;
    const nova = await api.post('/api/disciplinas', { nome });
    const row = document.createElement('div');
    row.className = 'plan-disc-config-row';
    row.innerHTML = `<label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
      <input type="checkbox" class="pd-check" value="${nova.id}" checked style="accent-color:var(--primary);width:15px;height:15px">
      <span style="font-size:0.87rem;font-weight:500">${nome}</span>
    </label>
    <select class="pd-prova" data-disc="${nova.id}" style="width:70px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px;font-size:0.82rem">
      <option value="">—</option>${PROVAS_OPCOES.map(p=>`<option value="${p}">${p}</option>`).join('')}
    </select>
    <input type="number" class="pd-questoes" data-disc="${nova.id}" placeholder="Q" min="0" style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">
    <input type="number" class="pd-peso" data-disc="${nova.id}" value="1" placeholder="Peso" min="0" step="0.5" style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">`;
    qs('#pl-discs-list').insertBefore(row, qs('#pl-discs-list').lastElementChild);
    qs('#nova-disc-nome').value = '';
    qs('#nova-disc-inline').classList.add('hidden');
    showToast('Disciplina criada!', 'success');
  });

  qs('#save-plan-btn').addEventListener('click', async () => {
    const nome = qs('#pl-nome').value.trim();
    if (!nome) { showToast('Nome obrigatório', 'error'); return; }

    // Bloqueia nome duplicado (exceto ao editar o próprio)
    const nomeDuplicado = todosPlans.some(p => p.nome.toLowerCase() === nome.toLowerCase() && (!id || String(p.id) !== String(id)));
    if (nomeDuplicado) { showToast('Já existe um planejamento com este nome!', 'error'); return; }

    const data_prova = qs('#pl-data').value;
    const disciplinas = qsa('.pd-check:checked').map(cb => ({
      disciplina_id: parseInt(cb.value),
      prova: qs(`.pd-prova[data-disc="${cb.value}"]`)?.value || '',
      num_questoes: parseInt(qs(`.pd-questoes[data-disc="${cb.value}"]`)?.value) || 0,
      peso: parseFloat(qs(`.pd-peso[data-disc="${cb.value}"]`)?.value) || 1,
    }));

    if (id) {
      await api.put(`/api/planejamentos/${id}`, { nome, concurso_id: plan?.concurso_id, data_prova });
      if (disciplinas.length) await api.post(`/api/planejamentos/${id}/disciplinas`, { disciplinas });
    } else {
      const res = await api.post('/api/planejamentos', { nome, data_prova });
      if (disciplinas.length) await api.post(`/api/planejamentos/${res.id}/disciplinas`, { disciplinas });
    }
    closeModal(); showToast('Planejamento salvo!', 'success'); if (onSave) onSave();
  });
}

async function openAddDiscModal(planId, todasDiscs, jaAdicionadas, onSave) {
  const jaIds = new Set(jaAdicionadas.map(d => d.disciplina_id));
  const disponiveis = todasDiscs.filter(d => !jaIds.has(d.id));
  openModal('Adicionar Disciplinas', `
    <div style="font-size:0.72rem;color:var(--text-3);margin-bottom:6px;display:grid;grid-template-columns:1fr 70px 65px 65px;gap:8px;padding:0 4px">
      <span>Disciplina</span><span style="text-align:center">Prova</span><span style="text-align:center">Questões</span><span style="text-align:center">Peso</span>
    </div>
    <div style="max-height:280px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm);padding:4px 8px">
      ${disponiveis.length === 0 ? '<p class="text-muted text-small" style="padding:12px">Todas já adicionadas.</p>' :
        disponiveis.map(d => `<div class="plan-disc-config-row">
          <label style="display:flex;align-items:center;gap:8px;flex:1;cursor:pointer">
            <input type="checkbox" class="add-pd-check" value="${d.id}" style="accent-color:var(--primary);width:15px;height:15px">
            <span style="font-size:0.87rem;font-weight:500">${d.nome}</span>
          </label>
          <select class="add-pd-prova" data-disc="${d.id}" style="width:70px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px;font-size:0.82rem">
            <option value="">—</option>${PROVAS_OPCOES.map(p=>`<option value="${p}">${p}</option>`).join('')}
          </select>
          <input type="number" class="add-pd-questoes" data-disc="${d.id}" placeholder="Q" min="0"
            style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">
          <input type="number" class="add-pd-peso" data-disc="${d.id}" value="1" placeholder="Peso" min="0" step="0.5"
            style="width:65px;border:1px solid var(--border-strong);border-radius:var(--radius-sm);padding:5px 6px;font-size:0.82rem;text-align:center">
        </div>`).join('')}
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-add-disc">Adicionar</button>
    </div>
  `);
  qs('#save-add-disc').addEventListener('click', async () => {
    const disciplinas = qsa('.add-pd-check:checked').map(cb => ({
      disciplina_id: parseInt(cb.value),
      prova: qs(`.add-pd-prova[data-disc="${cb.value}"]`)?.value || '',
      num_questoes: parseInt(qs(`.add-pd-questoes[data-disc="${cb.value}"]`)?.value) || 0,
      peso: parseFloat(qs(`.add-pd-peso[data-disc="${cb.value}"]`)?.value) || 1,
    }));
    if (!disciplinas.length) { showToast('Selecione ao menos uma', 'error'); return; }
    await api.post(`/api/planejamentos/${planId}/disciplinas`, { disciplinas });
    closeModal(); showToast('Adicionadas!', 'success'); if (onSave) onSave();
  });
}

function openEditDiscModal(d, onSave) {
  openModal('Editar Disciplina', `
    <div style="font-weight:700;margin-bottom:14px">${d.disciplina_nome}</div>
    <div class="form-row">
      <div class="form-group"><label>Prova</label>
        <select id="ed-prova"><option value="">—</option>${PROVAS_OPCOES.map(p=>`<option value="${p}" ${d.prova===p?'selected':''}>${p}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label>Questões</label><input type="number" id="ed-questoes" value="${d.num_questoes||0}" min="0"></div>
      <div class="form-group"><label>Peso</label><input type="number" id="ed-peso" value="${d.peso||1}" min="0" step="0.5"></div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-ed-disc">Salvar</button>
    </div>
  `);
  qs('#save-ed-disc').addEventListener('click', async () => {
    await api.put(`/api/plan-disciplinas/${d.id}`, { prova: qs('#ed-prova').value, peso: parseFloat(qs('#ed-peso').value)||1, num_questoes: parseInt(qs('#ed-questoes').value)||0 });
    closeModal(); showToast('Salvo!', 'success'); if (onSave) onSave();
  });
}

function openAssuntosVinculadosModal(discId, disciplinaId, assuntosVinculados, allAssuntos, onSave) {
  const vinculadosIds = new Set(assuntosVinculados.map(a => a.assunto_id ?? a.id));
  const html = renderAssuntosTreeHTML(allAssuntos, {
    checkable: true,
    checkedIds: vinculadosIds,
    toggleClass: 'av-toggle',
    checkClass: 'av-check',
    filhosPrefix: 'av-filhos'
  });

  openModal('Assuntos da Disciplina', `
    <p class="text-muted text-small" style="margin-bottom:10px">Clique no ▶ para expandir. Marcar o pai seleciona todos os filhos.</p>
    <div id="av-tree" style="max-height:400px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);border-radius:var(--radius-sm)">
      ${allAssuntos.length ? html : '<p class="text-muted text-small" style="padding:12px">Nenhum assunto. Importe em Disciplinas.</p>'}
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-ass-vinc">Salvar</button>
    </div>
  `);

  const treeEl = qs('#av-tree');
  bindTreeToggles(treeEl, 'av-filhos');
  bindTreeCheckboxes(treeEl, 'av-check', 'av-filhos', null);

  qs('#save-ass-vinc').addEventListener('click', async () => {
    const assunto_ids = qsa('.av-check:checked', treeEl).map(cb => parseInt(cb.value));
    await api.post(`/api/plan-disciplinas/${discId}/assuntos`, { assunto_ids });
    closeModal(); showToast(`${assunto_ids.length} assuntos vinculados!`, 'success'); if (onSave) onSave();
  });
}

async function openTarefaModal(tarefaId, discId, allAssuntos, assuntosVinculados, assuntosJaPlanejados, onSave) {
  let t = { assunto_ids:'', fonte:'', link_caderno:'', o_que_fazer:'', data_execucao:'', tipo:'' };
  if (tarefaId) {
    try {
      const plan = await api.get(`/api/planejamentos/${window._app.currentParams?.plan_id}`);
      const disc = plan.disciplinas.find(d => d.id == discId);
      const found = disc?.tarefas?.find(x => x.id == tarefaId);
      if (found) t = found;
    } catch(e) {}
  }

  const assuntosSel = new Set(t.assunto_ids ? t.assunto_ids.split(',').filter(Boolean).map(Number) : []);

  // Mostra apenas assuntos vinculados ao planejamento (ou todos se não há vinculados)
  const vinculadosIds = new Set(assuntosVinculados.map(a => a.assunto_id ?? a.id));
  const assuntosParaMostrar = vinculadosIds.size > 0
    ? allAssuntos.filter(a => vinculadosIds.has(a.id))
    : allAssuntos;

  const treeHtml = renderAssuntosTreeHTML(assuntosParaMostrar, {
    checkable: true,
    checkedIds: assuntosSel,
    jaPlanejadosIds: assuntosJaPlanejados || new Set(),
    toggleClass: 'ta-toggle',
    checkClass: 'ta-check',
    filhosPrefix: 'ta-filhos'
  });

  openModal(tarefaId ? 'Editar Tarefa' : 'Nova Tarefa', `
    <div class="form-group">
      <label>Assuntos</label>
      <div id="ta-tree" style="max-height:200px;overflow-y:auto;overflow-x:hidden;border:1px solid var(--border);border-radius:var(--radius-sm)">
        ${assuntosParaMostrar.length ? treeHtml : '<p class="text-muted text-small" style="padding:10px">Nenhum assunto vinculado.</p>'}
      </div>
      <div id="ta-selecionados" style="margin-top:8px;display:flex;flex-direction:column;gap:3px"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label>Data de execução</label><input type="date" id="t-data" value="${t.data_execucao||''}"></div>
      <div class="form-group"><label>Tipo de estudo</label>
        <select id="t-tipo">
          <option value="">Não definido</option>
          <option value="questoes" ${t.tipo==='questoes'?'selected':''}>Questões</option>
          <option value="teorico" ${t.tipo==='teorico'?'selected':''}>Teórico</option>
          <option value="revisao" ${t.tipo==='revisao'?'selected':''}>Revisão</option>
          <option value="simulado" ${t.tipo==='simulado'?'selected':''}>Simulado</option>
        </select>
      </div>
    </div>
    <div class="form-group"><label>Fonte de estudo</label><input type="text" id="t-fonte" value="${t.fonte||''}" placeholder="Ex: Estratégia, Videoaula..."></div>
    <div class="form-group">
      <label>Link do Caderno Tec</label>
      <input type="url" id="t-link" value="${t.link_caderno||''}" placeholder="https://www.tecconcursos.com.br/...">
    </div>
    <div class="form-group">
      <label>O que fazer</label>
      <div class="editor-toolbar" style="flex-wrap:wrap;gap:4px">
        <button type="button" class="editor-btn" onclick="document.execCommand('bold')" title="Negrito"><b>B</b></button>
        <button type="button" class="editor-btn" onclick="document.execCommand('italic')" title="Itálico"><i>I</i></button>
        <button type="button" class="editor-btn" onclick="document.execCommand('underline')" title="Sublinhado"><u>U</u></button>
        <button type="button" class="editor-btn" onclick="document.execCommand('insertUnorderedList')" title="Lista">• Lista</button>
        <button type="button" class="editor-btn" onclick="document.execCommand('insertOrderedList')" title="Lista numerada">1. Lista</button>
        <button type="button" class="editor-btn" id="emoji-btn" title="Emoji">😀</button>
        <div style="display:flex;align-items:center;gap:4px;margin-left:4px;padding-left:8px;border-left:1px solid var(--border)">
          <span class="editor-section-label">Texto</span>
          <div class="color-palette" id="text-colors">
            <div class="color-dot" style="background:#EF4444" data-color="#EF4444" data-type="text" title="Vermelho"></div>
            <div class="color-dot" style="background:#3B82F6" data-color="#3B82F6" data-type="text" title="Azul"></div>
            <div class="color-dot" style="background:#10B981" data-color="#10B981" data-type="text" title="Verde"></div>
            <div class="color-dot" style="background:#F59E0B" data-color="#F59E0B" data-type="text" title="Laranja"></div>
            <div class="color-dot" style="background:#8B5CF6" data-color="#8B5CF6" data-type="text" title="Roxo"></div>
            <div class="color-dot" style="background:#111827" data-color="#111827" data-type="text" title="Preto"></div>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:4px;padding-left:8px;border-left:1px solid var(--border)">
          <span class="editor-section-label">Fundo</span>
          <div class="color-palette" id="bg-colors">
            <div class="color-dot" style="background:#FEF08A" data-color="#FEF08A" data-type="bg" title="Amarelo"></div>
            <div class="color-dot" style="background:#BBF7D0" data-color="#BBF7D0" data-type="bg" title="Verde claro"></div>
            <div class="color-dot" style="background:#BFDBFE" data-color="#BFDBFE" data-type="bg" title="Azul claro"></div>
            <div class="color-dot" style="background:#FECDD3" data-color="#FECDD3" data-type="bg" title="Rosa"></div>
            <div class="color-dot" style="background:#FED7AA" data-color="#FED7AA" data-type="bg" title="Laranja claro"></div>
            <div class="color-dot" style="background:transparent;border:1px solid var(--border-strong)" data-color="transparent" data-type="bg" title="Sem fundo"></div>
          </div>
        </div>
      </div>
      <div id="emoji-picker" class="hidden" style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:8px;display:flex;flex-wrap:wrap;gap:4px;font-size:1.2rem;max-width:100%">
        ${'⚠️ ✅ ❌ 📌 🔥 ⭐ 💡 📝 🎯 📖 🔗 ✏️ 🧠 💪 ⏰ 📅 🚀 ❗ ❓ 🔴 🟡 🟢 ✔️ ➡️ ⬆️ ⬇️'.split(' ').map(e=>`<span class="emoji-opt" style="cursor:pointer;padding:3px 5px;border-radius:4px">${e}</span>`).join('')}
      </div>
      <div class="rich-editor" id="t-oqfazer" contenteditable="true" style="min-height:100px">${t.o_que_fazer||''}</div>
    </div>
    <div class="form-actions">
      <button class="btn btn-outline" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="save-tarefa-btn">${tarefaId?'Salvar':'Criar Tarefa'}</button>
    </div>
  `);

  const treeEl = qs('#ta-tree');
  bindTreeToggles(treeEl, 'ta-filhos');
  bindTreeCheckboxes(treeEl, 'ta-check', 'ta-filhos', atualizarSelecionados);

  function atualizarSelecionados() {
    const checks = qsa('.ta-check:checked', treeEl);
    const div = qs('#ta-selecionados');
    // Mostra apenas pais selecionados ou filhos cujo pai não está marcado
    const linhas = [];
    checks.forEach(cb => {
      const a = assuntosParaMostrar.find(x => x.id == cb.value);
      if (!a) return;
      if (!a.parent_id) {
        // pai: conta filhos marcados
        const filhosMarcados = qsa('.ta-check:checked', treeEl).filter(c => {
          const f = assuntosParaMostrar.find(x => x.id == c.value);
          return f && f.parent_id === a.id;
        });
        const label = filhosMarcados.length > 0 ? `${a.codigo ? a.codigo+' ' : ''}${a.nome} (${filhosMarcados.length} subitens)` : `${a.codigo ? a.codigo+' ' : ''}${a.nome}`;
        linhas.push(`<div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;padding:3px 0">
          <span style="color:var(--primary);font-size:0.7rem;min-width:40px">${a.codigo||''}</span>
          <span style="font-weight:600">${a.nome}</span>
          ${filhosMarcados.length ? '<span style="font-size:0.72rem;color:var(--text-3)">(' + filhosMarcados.length + ' subitens)</span>' : ''}
        </div>`);
      } else {
        // filho: só mostra se pai não está marcado
        const paiMarcado = qsa('.ta-check:checked', treeEl).some(c => {
          const p = assuntosParaMostrar.find(x => x.id == c.value);
          return p && !p.parent_id && p.id === a.parent_id;
        });
        if (!paiMarcado) {
          linhas.push(`<div style="display:flex;align-items:center;gap:6px;font-size:0.82rem;padding:3px 0 3px 16px">
            <span style="color:var(--text-3);font-size:0.7rem;min-width:40px">${a.codigo||''}</span>
            <span>${a.nome}</span>
          </div>`);
        }
      }
    });
    div.innerHTML = linhas.length
      ? `<div style="background:var(--primary-bg);border-radius:var(--radius-sm);padding:8px 12px;border-left:3px solid var(--primary)">
          <div style="font-size:0.72rem;font-weight:700;color:var(--primary);margin-bottom:6px;text-transform:uppercase;letter-spacing:0.05em">Selecionados</div>
          ${linhas.join('')}
         </div>`
      : '';
  }
  atualizarSelecionados();

  // Salva e restaura posição do cursor
  const editorEl = qs('#t-oqfazer');
  let savedRange = null;

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedRange = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!savedRange) { editorEl.focus(); return; }
    editorEl.focus();
    const sel = window.getSelection();
    if (sel) { sel.removeAllRanges(); sel.addRange(savedRange); }
  }

  editorEl.addEventListener('keyup', saveSelection);
  editorEl.addEventListener('mouseup', saveSelection);
  editorEl.addEventListener('focus', saveSelection);

  qs('#emoji-btn').addEventListener('click', e => {
    e.stopPropagation();
    saveSelection();
    qs('#emoji-picker').classList.toggle('hidden');
  });
  qsa('.emoji-opt').forEach(span => {
    span.addEventListener('mouseover', () => span.style.background = 'var(--primary-bg)');
    span.addEventListener('mouseout', () => span.style.background = '');
    span.addEventListener('mousedown', e => { e.preventDefault(); saveSelection(); });
    span.addEventListener('click', () => {
      restoreSelection();
      document.execCommand('insertText', false, span.textContent);
      saveSelection();
      qs('#emoji-picker').classList.add('hidden');
    });
  });

  // Cores - salva seleção antes de aplicar
  qsa('.color-dot').forEach(dot => {
    dot.addEventListener('mousedown', e => { e.preventDefault(); saveSelection(); });
    dot.addEventListener('click', () => {
      restoreSelection();
      const color = dot.dataset.color;
      const type = dot.dataset.type;
      if (type === 'text') {
        document.execCommand('foreColor', false, color);
      } else {
        document.execCommand('hiliteColor', false, color === 'transparent' ? 'rgba(0,0,0,0)' : color);
      }
      saveSelection();
    });
  });

  qs('#save-tarefa-btn').addEventListener('click', async () => {
    const assunto_ids = qsa('.ta-check:checked', treeEl).map(cb => parseInt(cb.value));
    const payload = {
      assunto_ids,
      tipo: qs('#t-tipo')?.value || '',
      fonte: qs('#t-fonte').value.trim(),
      link_caderno: qs('#t-link').value.trim(),
      o_que_fazer: qs('#t-oqfazer').innerHTML,
      data_execucao: qs('#t-data').value,
    };
    if (tarefaId) await api.put(`/api/plan-tarefas/${tarefaId}`, payload);
    else await api.post(`/api/plan-disciplinas/${discId}/tarefas`, payload);
    closeModal(); showToast('Tarefa salva!', 'success'); if (onSave) onSave();
  });
}
