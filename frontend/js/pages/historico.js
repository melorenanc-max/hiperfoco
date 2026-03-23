// ── HISTÓRICO PAGE ────────────────────────────────────────────────────────────

async function renderHistorico(container) {
  const [concursos, disciplinas, bancasUsadas] = await Promise.all([
    api.get('/api/concursos'), api.get('/api/disciplinas'), api.get('/api/bancas')
  ]);
  const todasBancas = BANCAS_PADRAO.concat(bancasUsadas.filter(b => !BANCAS_PADRAO.includes(b)));

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Histórico</div><div class="page-subtitle">Todos os registros de estudo</div></div>
      <button class="btn btn-danger btn-sm" id="btn-zerar-hist-page">🗑 Zerar histórico</button>
    </div>
    <div class="filters-bar">
      <div class="filter-group"><label>Concurso</label>
        <select id="h-concurso"><option value="">Todos</option>${concursos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}</select>
      </div>
      <div class="filter-group"><label>Disciplina</label>
        <select id="h-disciplina"><option value="">Todas</option>${disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}</select>
      </div>
      <div class="filter-group"><label>Assunto</label><select id="h-assunto"><option value="">Todos</option></select></div>
      <div class="filter-group"><label>Banca</label>
        <select id="h-banca"><option value="">Todas</option>${todasBancas.map(b => `<option value="${b}">${b}</option>`).join('')}</select>
      </div>
      <div class="filter-group"><label>De</label><input type="date" id="h-data-inicio"></div>
      <div class="filter-group"><label>Até</label><input type="date" id="h-data-fim"></div>
    </div>
    <div id="historico-content"></div>
  `;

  const hDisc = qs('#h-disciplina', container);
  const hAssunto = qs('#h-assunto', container);

  hDisc.addEventListener('change', async () => {
    const did = hDisc.value;
    if (!did) {
      hAssunto.innerHTML = '<option value="">Todos</option>';
    } else {
      const assuntos = await api.get(`/api/assuntos?disciplina_id=${did}`);
      hAssunto.innerHTML = '<option value="">Todos</option>' +
        assuntos.map(a => `<option value="${a.id}">${a.codigo ? a.codigo + ' ' : ''}${a.nome}</option>`).join('');
    }
    load();
  });

  async function abrirEdicao(sessaoId) {
    const [discs, concs, bancas2] = await Promise.all([
      api.get('/api/disciplinas'), api.get('/api/concursos'), api.get('/api/bancas')
    ]);
    const tb = BANCAS_PADRAO.concat(bancas2.filter(b => !BANCAS_PADRAO.includes(b)));
    openEditSessaoModal(sessaoId, discs, concs, tb, load);
  }

  async function load() {
    const params = {
      concurso_id: qs('#h-concurso', container).value,
      disciplina_id: hDisc.value,
      assunto_id: hAssunto.value,
      banca: qs('#h-banca', container).value,
      data_inicio: qs('#h-data-inicio', container).value,
      data_fim: qs('#h-data-fim', container).value
    };

    const sessoes = await api.get('/api/sessoes' + qs_params(params));
    const content = qs('#historico-content', container);

    if (!sessoes.length) { content.innerHTML = renderEmptyState('◷', 'Nenhum registro encontrado.'); return; }

    // Agrupar por disciplina
    const byDisc = {};
    for (const s of sessoes) {
      if (!byDisc[s.disciplina_id]) byDisc[s.disciplina_id] = { nome: s.disciplina_nome, sessoes: [], assuntos: {} };
      byDisc[s.disciplina_id].sessoes.push(s);
      const assuntoNomes = s.assuntos && s.assuntos.length ? s.assuntos.map(a => a.nome) : ['Sem assunto específico'];
      assuntoNomes.forEach(aName => {
        if (!byDisc[s.disciplina_id].assuntos[aName]) byDisc[s.disciplina_id].assuntos[aName] = { sessoes: [] };
        byDisc[s.disciplina_id].assuntos[aName].sessoes.push(s);
      });
    }

    content.innerHTML = '';

    for (const [discId, disc] of Object.entries(byDisc)) {
      const totalQ = disc.sessoes.reduce((s, x) => s + (x.total_questoes || 0), 0);
      const totalA = disc.sessoes.reduce((s, x) => s + (x.acertos || 0), 0);
      const pctDisc = totalQ > 0 ? ((totalA / totalQ) * 100).toFixed(1) : null;

      const discDiv = document.createElement('div');
      discDiv.className = 'historico-disc-group';
      discDiv.innerHTML = `
        <div class="historico-disc-title">
          <span style="flex:1">${disc.nome}</span>
          <span class="text-small">${disc.sessoes.length} sessão(ões)</span>
          ${totalQ > 0 ? `<span class="text-small">${totalQ} questões</span>` : ''}
          ${acertoBadge(pctDisc)}
        </div>
      `;

      for (const [assuntoNome, assunto] of Object.entries(disc.assuntos)) {
        const tQ = assunto.sessoes.reduce((s, x) => s + (x.total_questoes || 0), 0);
        const tA = assunto.sessoes.reduce((s, x) => s + (x.acertos || 0), 0);
        const pct = tQ > 0 ? ((tA / tQ) * 100).toFixed(1) : null;

        const assDiv = document.createElement('div');
        assDiv.className = 'historico-assunto-group';
        assDiv.innerHTML = `
          <div class="historico-assunto-header">
            <span class="historico-assunto-nome">${assuntoNome}</span>
            <div class="historico-assunto-stats">
              <span>${assunto.sessoes.length} sessão(ões)</span>
              ${tQ > 0 ? `<span>${tQ} questões</span>` : ''}
              ${acertoBadge(pct)}
              <span class="toggle-arrow">▾</span>
            </div>
          </div>
          <div class="historico-sessoes">
            <table style="width:100%">
              <thead><tr>
                <th>Data</th><th>Tipo</th><th>Concurso</th>
                <th class="td-right">Questões</th><th class="td-right">Acerto</th><th></th>
              </tr></thead>
              <tbody>
                ${assunto.sessoes.map(s => {
                  const pctS = s.total_questoes > 0 ? ((s.acertos / s.total_questoes) * 100).toFixed(1) : null;
                  return `
                    <tr>
                      <td>${formatDate(s.data)}</td>
                      <td><span class="acerto-badge acerto-none">${s.tipo}</span></td>
                      <td class="text-muted text-small">${s.concurso_nome || '—'}</td>
                      <td class="td-right">${s.total_questoes || 0}</td>
                      <td class="td-right">${acertoBadge(pctS)}</td>
                      <td style="white-space:nowrap">
                        ${btnEditar('data-id="'+s.id+'" class="edit-hist-btn"')} ${btnApagar('data-id="'+s.id+'" class="del-hist-btn"')}
                      </td>
                    </tr>
                    ${s.observacoes ? `<tr class="hist-obs-row"><td colspan="6"><div class="hist-obs-box">💬 ${s.observacoes}</div></td></tr>` : ''}
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        `;

        const header = assDiv.querySelector('.historico-assunto-header');
        const sessoesDiv = assDiv.querySelector('.historico-sessoes');
        header.addEventListener('click', () => {
          sessoesDiv.classList.toggle('open');
          header.querySelector('.toggle-arrow').textContent = sessoesDiv.classList.contains('open') ? '▴' : '▾';
        });

        assDiv.querySelectorAll('.edit-hist-btn').forEach(btn => {
          btn.addEventListener('click', e => { e.stopPropagation(); abrirEdicao(btn.dataset.id); });
        });

        assDiv.querySelectorAll('.del-hist-btn').forEach(btn => {
          btn.addEventListener('click', async e => {
            e.stopPropagation();
            if (!confirm('Apagar este estudo?')) return;
            await api.delete(`/api/sessoes/${btn.dataset.id}`);
            showToast('Estudo apagado'); load();
          });
        });

        discDiv.appendChild(assDiv);
      }

      content.appendChild(discDiv);
    }
  }

  ['#h-concurso', '#h-banca', '#h-data-inicio', '#h-data-fim', '#h-assunto'].forEach(sel => {
    qs(sel, container)?.addEventListener('change', load);
  });

  qs('#btn-zerar-hist-page', container)?.addEventListener('click', async () => {
    if (!confirm('Zerar todo o histórico de estudos?')) return;
    await api.post('/api/usuario/zerar-historico', {});
    showToast('Histórico zerado!', 'success');
    load();
  });

  load();
}
