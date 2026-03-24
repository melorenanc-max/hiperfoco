// ── CONFIGURAÇÕES PAGE ────────────────────────────────────────────────────────

async function renderConfiguracoes(container) {
  let usuario = { nome: '', email: '', foto: '' };
  try { usuario = (await api.get('/auth/me')).usuario || usuario; } catch(e) {}

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Configurações</div><div class="page-subtitle">Gerencie sua conta e preferências</div></div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Perfil</div>
      <div class="config-card">
        <div style="display:flex;align-items:center;gap:16px">
          ${usuario.foto
            ? `<img src="${usuario.foto}" style="width:56px;height:56px;border-radius:50%;border:2px solid var(--border)" referrerpolicy="no-referrer">`
            : '<div style="width:56px;height:56px;border-radius:50%;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-size:1.4rem">👤</div>'}
          <div>
            <div style="font-family:var(--font-display);font-weight:700;font-size:1rem">${usuario.nome || '—'}</div>
            <div style="font-size:0.84rem;color:var(--text-3)">${usuario.email || '—'}</div>
            <div style="font-size:0.75rem;color:var(--text-3);margin-top:2px">Conta Google</div>
          </div>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Preferências</div>
      <div class="config-card" id="cfg-bancas-section">
        <div class="config-item">
          <div style="flex:1">
            <div class="config-item-label">Bancas organizadoras</div>
            <div class="config-item-desc">Bancas disponíveis para seleção nos registros de estudo e planejamento.</div>
          </div>
        </div>
        <div id="cfg-bancas-list" style="margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;"></div>
        <div style="margin-top:10px;display:flex;gap:8px;align-items:center;">
          <input type="text" id="cfg-nova-banca" placeholder="Nome da banca" style="flex:1;max-width:220px">
          <button class="btn btn-primary btn-sm" id="cfg-add-banca">+ Adicionar</button>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Dados</div>
      <div class="config-card">
        <div class="config-item">
          <div>
            <div class="config-item-label">Zerar histórico de estudos</div>
            <div class="config-item-desc">Remove todos os registros de sessões e atividades. Disciplinas e planejamentos continuam intactos.</div>
          </div>
          <button class="btn btn-warning btn-sm" id="btn-zerar-historico">Zerar histórico</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label">Zerar tarefas do planejamento</div>
            <div class="config-item-desc">Remove todas as tarefas criadas nos planejamentos. Os planejamentos e disciplinas continuam.</div>
          </div>
          <button class="btn btn-warning btn-sm" id="btn-zerar-tarefas">Zerar tarefas</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label">Zerar disciplinas e assuntos</div>
            <div class="config-item-desc">Remove todas as disciplinas e assuntos. Os planejamentos e o histórico de sessões continuam intactos.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-zerar-disciplinas">Zerar disciplinas</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label" style="color:var(--red)">Zerar TODOS os dados</div>
            <div class="config-item-desc">Apaga absolutamente tudo: sessões, ciclos, planejamentos, concursos, disciplinas e configurações. Sua conta continua ativa.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-zerar-tudo">Zerar tudo</button>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Conta</div>
      <div class="config-card">
        <div class="config-item">
          <div>
            <div class="config-item-label">Sair da conta</div>
            <div class="config-item-desc">Você será redirecionado para a tela de login.</div>
          </div>
          <a href="/auth/logout" class="btn btn-outline btn-sm">Sair</a>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label" style="color:var(--red)">Apagar conta</div>
            <div class="config-item-desc">Remove permanentemente sua conta e todos os dados. Não pode ser desfeito.</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-apagar-conta">Apagar conta</button>
        </div>
      </div>
    </div>
  `;

  // ── BANCAS MANAGEMENT ────────────────────────────────────────────────────────
  async function loadBancas() {
    const list = qs('#cfg-bancas-list', container);
    list.innerHTML = '';
    try {
      const bancas = await api.get('/api/bancas');
      if (!bancas.length) {
        list.innerHTML = '<span style="font-size:0.82rem;color:var(--text-3)">Nenhuma banca cadastrada.</span>';
        return;
      }
      bancas.forEach(b => {
        const tag = document.createElement('span');
        tag.style.cssText = 'display:inline-flex;align-items:center;gap:5px;background:var(--bg);border:1px solid var(--border);border-radius:4px;padding:3px 8px;font-size:0.82rem;';
        tag.textContent = b.nome;
        const del = document.createElement('button');
        del.style.cssText = 'background:none;border:none;cursor:pointer;color:var(--text-3);padding:0;line-height:1;font-size:0.9rem;';
        del.textContent = '×';
        del.title = 'Remover banca';
        del.addEventListener('click', async () => {
          if (!confirm(`Remover a banca "${b.nome}"?`)) return;
          await api.delete(`/api/bancas/${b.id}`);
          loadBancas();
        });
        tag.appendChild(del);
        list.appendChild(tag);
      });
    } catch(e) {
      list.innerHTML = '<span style="font-size:0.82rem;color:var(--red)">Erro ao carregar bancas.</span>';
    }
  }

  qs('#cfg-add-banca', container).addEventListener('click', async () => {
    const input = qs('#cfg-nova-banca', container);
    const nome = input.value.trim();
    if (!nome) { showToast('Digite o nome da banca', 'error'); return; }
    try {
      await api.post('/api/bancas', { nome });
      input.value = '';
      showToast('Banca adicionada!', 'success');
      loadBancas();
    } catch(e) {
      showToast('Erro ao adicionar banca', 'error');
    }
  });

  qs('#cfg-nova-banca', container).addEventListener('keydown', e => {
    if (e.key === 'Enter') qs('#cfg-add-banca', container).click();
  });

  loadBancas();

  async function zerarComConfirmacao(msg, msg2, endpoint, successMsg) {
    if (!confirm(msg)) return;
    if (msg2 && !confirm(msg2)) return;
    try {
      await api.post(endpoint, {});
      showToast(successMsg, 'success');
    } catch(e) {
      showToast('Erro ao zerar dados: ' + e.message, 'error');
    }
  }

  qs('#btn-zerar-historico', container).addEventListener('click', () =>
    zerarComConfirmacao('Zerar todo o histórico de estudos?', null, '/api/usuario/zerar-historico', 'Histórico zerado!'));

  qs('#btn-zerar-tarefas', container).addEventListener('click', () =>
    zerarComConfirmacao('Zerar todas as tarefas do planejamento?', null, '/api/usuario/zerar-tarefas', 'Tarefas zeradas!'));

  qs('#btn-zerar-disciplinas', container).addEventListener('click', () =>
    zerarComConfirmacao(
      'Isso vai apagar TODAS as disciplinas e assuntos. Os planejamentos e histórico continuam. Continuar?',
      'Confirma? Essa ação não pode ser desfeita.',
      '/api/usuario/zerar-disciplinas', 'Disciplinas e assuntos zerados!'
    ));

  qs('#btn-zerar-tudo', container).addEventListener('click', () =>
    zerarComConfirmacao(
      'Isso vai apagar ABSOLUTAMENTE TODOS os seus dados. Continuar?',
      'Última confirmação. Não tem volta. Apagar tudo?',
      '/api/usuario/zerar-dados', 'Todos os dados foram zerados!'
    ));

  qs('#btn-apagar-conta', container).addEventListener('click', async () => {
    if (!confirm('Apagar sua conta permanentemente?')) return;
    if (!confirm('Todos os dados serão perdidos. Confirma?')) return;
    await api.delete('/api/usuario/conta');
    window.location.href = '/login';
  });
}
