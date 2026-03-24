// ── CONFIGURAÇÕES PAGE ────────────────────────────────────────────────────────

async function renderConfiguracoes(container) {
  let usuario = { nome: '', email: '', foto: '' };
  try { usuario = (await api.get('/auth/me')).usuario || usuario; } catch(e) {}

  const iniciais = (usuario.nome || 'U').split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();

  container.innerHTML = `
    <div class="page-header">
      <div><div class="page-title">Configurações</div><div class="page-subtitle">Gerencie sua conta e preferências</div></div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Perfil</div>
      <div class="config-card">
        <div style="display:flex;align-items:center;gap:16px;padding-bottom:16px;border-bottom:1px solid var(--border)">
          ${usuario.foto
            ? `<img src="${usuario.foto}" style="width:52px;height:52px;border-radius:50%;border:2px solid var(--border)" referrerpolicy="no-referrer">`
            : `<div style="width:52px;height:52px;border-radius:50%;background:var(--primary-bg);display:flex;align-items:center;justify-content:center;font-family:var(--font-display);font-size:1.1rem;font-weight:700;color:var(--primary)">${iniciais}</div>`}
          <div>
            <div style="font-weight:700;font-size:0.95rem">${usuario.nome || '—'}</div>
            <div style="font-size:0.82rem;color:var(--text-3)">${usuario.email || '—'}</div>
            <div style="font-size:0.72rem;color:var(--text-3);margin-top:2px;background:var(--primary-bg);color:var(--primary);display:inline-block;padding:1px 8px;border-radius:20px;font-weight:600">Conta Google</div>
          </div>
        </div>
        <div class="config-item" style="padding-top:14px">
          <div>
            <div class="config-item-label">Nome de exibição</div>
            <div class="config-item-desc">Como seu nome aparece na plataforma</div>
          </div>
          <div style="display:flex;gap:8px;align-items:center">
            <input type="text" id="cfg-nome" value="${usuario.nome || ''}" style="width:200px;border:1px solid var(--border-strong);border-radius:6px;padding:6px 10px;font-size:0.84rem;font-family:var(--font)">
            <button class="btn btn-outline btn-sm" id="cfg-salvar-nome">Salvar</button>
          </div>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Preferências</div>
      <div class="config-card">
        <div class="config-item">
          <div>
            <div class="config-item-label">Início da semana</div>
            <div class="config-item-desc">Primeiro dia exibido no Ciclo Semanal</div>
          </div>
          <select id="cfg-inicio-semana" style="border:1px solid var(--border-strong);border-radius:6px;padding:6px 10px;font-size:0.84rem;font-family:var(--font)">
            <option value="segunda">Segunda-feira</option>
            <option value="domingo">Domingo</option>
          </select>
        </div>
      </div>
    </div>

    <div class="config-section">
      <div class="config-section-title">Dados</div>
      <div class="config-card">
        <div class="config-item">
          <div>
            <div class="config-item-label">Zerar histórico de estudos</div>
            <div class="config-item-desc">Remove todos os registros de sessões. Disciplinas e planejamentos continuam intactos.</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-zerar-historico" style="color:var(--text-3)">Zerar histórico</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label">Zerar tarefas do planejamento</div>
            <div class="config-item-desc">Remove todas as tarefas criadas. Os planejamentos e disciplinas continuam.</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-zerar-tarefas" style="color:var(--text-3)">Zerar tarefas</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label">Zerar disciplinas e assuntos</div>
            <div class="config-item-desc">Remove todas as disciplinas e assuntos. Planejamentos e histórico continuam.</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-zerar-disciplinas" style="color:var(--text-3)">Zerar disciplinas</button>
        </div>
        <div class="config-item" style="border-top:1px solid var(--border);padding-top:14px;margin-top:4px">
          <div>
            <div class="config-item-label" style="color:var(--text-2)">Zerar TODOS os dados</div>
            <div class="config-item-desc">Apaga absolutamente tudo. Sua conta continua ativa.</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-zerar-tudo" style="color:var(--text-3)">Zerar tudo</button>
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
            <div class="config-item-label" style="color:var(--text-2)">Apagar conta</div>
            <div class="config-item-desc">Remove permanentemente sua conta e todos os dados.</div>
          </div>
          <button class="btn btn-outline btn-sm" id="btn-apagar-conta" style="color:var(--text-3)">Apagar conta</button>
        </div>
      </div>
    </div>
  `;

  // Preferência início da semana
  api.get('/api/config/inicio_semana').then(r => {
    const sel = qs('#cfg-inicio-semana', container);
    if (sel && r && r.value) sel.value = r.value;
  }).catch(() => {});

  qs('#cfg-inicio-semana', container).addEventListener('change', e => {
    api.post('/api/config/inicio_semana', { value: e.target.value }).catch(() => {});
    showToast('Preferência salva!', 'success');
  });

  // Salvar nome
  qs('#cfg-salvar-nome', container).addEventListener('click', async () => {
    const nome = qs('#cfg-nome', container).value.trim();
    if (!nome) return;
    try {
      await api.put('/api/usuario/nome', { nome });
      showToast('Nome atualizado!', 'success');
      const nomeEl = document.getElementById('sidebar-user-nome');
      if (nomeEl) nomeEl.textContent = nome;
    } catch(e) {
      showToast('Erro ao salvar nome', 'error');
    }
  });

  // Ações destrutivas com hover vermelho
  const btnsDestructive = [
    { id: '#btn-zerar-historico', msg1: 'Zerar todo o histórico de estudos?', endpoint: '/api/usuario/zerar-historico', ok: 'Histórico zerado!' },
    { id: '#btn-zerar-tarefas', msg1: 'Zerar todas as tarefas do planejamento?', endpoint: '/api/usuario/zerar-tarefas', ok: 'Tarefas zeradas!' },
    { id: '#btn-zerar-disciplinas', msg1: 'Zerar todas as disciplinas e assuntos?', msg2: 'Essa ação não pode ser desfeita. Confirma?', endpoint: '/api/usuario/zerar-disciplinas', ok: 'Disciplinas zeradas!' },
    { id: '#btn-zerar-tudo', msg1: 'Apagar ABSOLUTAMENTE TODOS os dados?', msg2: 'Última confirmação. Não tem volta.', endpoint: '/api/usuario/zerar-dados', ok: 'Dados zerados!' },
  ];

  btnsDestructive.forEach(({ id, msg1, msg2, endpoint, ok }) => {
    const btn = qs(id, container);
    if (!btn) return;
    btn.addEventListener('mouseenter', () => { btn.style.color = 'var(--red)'; btn.style.borderColor = 'var(--red)'; });
    btn.addEventListener('mouseleave', () => { btn.style.color = 'var(--text-3)'; btn.style.borderColor = ''; });
    btn.addEventListener('click', async () => {
      if (!confirm(msg1)) return;
      if (msg2 && !confirm(msg2)) return;
      const confirmado = prompt('Digite CONFIRMAR para continuar:');
      if (confirmado !== 'CONFIRMAR') { showToast('Ação cancelada', ''); return; }
      try {
        await api.post(endpoint, {});
        showToast(ok, 'success');
      } catch(e) {
        showToast('Erro: ' + e.message, 'error');
      }
    });
  });

  const btnApagar = qs('#btn-apagar-conta', container);
  if (btnApagar) {
    btnApagar.addEventListener('mouseenter', () => { btnApagar.style.color = 'var(--red)'; btnApagar.style.borderColor = 'var(--red)'; });
    btnApagar.addEventListener('mouseleave', () => { btnApagar.style.color = 'var(--text-3)'; btnApagar.style.borderColor = ''; });
    btnApagar.addEventListener('click', async () => {
      if (!confirm('Apagar sua conta permanentemente?')) return;
      const confirmado = prompt('Digite CONFIRMAR para continuar:');
      if (confirmado !== 'CONFIRMAR') return;
      await api.delete('/api/usuario/conta');
      window.location.href = '/login';
    });
  }
}
