// ── COMPONENTS ────────────────────────────────────────────────────────────────

function renderEmptyState(icon, text) {
  return `<div class="empty-state"><div class="empty-icon">${icon}</div><p>${text}</p></div>`;
}

function renderMetricCard(label, value, sub = '') {
  return `<div class="metric-card">
    <div class="metric-label">${label}</div>
    <div class="metric-value">${value}</div>
    ${sub ? `<div class="metric-sub">${sub}</div>` : ''}
  </div>`;
}

// ── ÍCONES PADRONIZADOS ────────────────────────────────────────────────────────
// Use sempre estas funções para botões de ação em toda a plataforma
function btnEditar(dataAttrs = '', extraClass = '') {
  return `<button class="btn-action btn-action-edit ${extraClass}" ${dataAttrs} title="Editar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  </button>`;
}

function btnApagar(dataAttrs = '', extraClass = '') {
  return `<button class="btn-action btn-action-delete ${extraClass}" ${dataAttrs} title="Apagar">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  </button>`;
}

function initTabs(container) {
  const buttons = qsa('.tab-btn', container);
  const panels = qsa('.tab-panel', container);
  buttons.forEach(btn => {
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      panels.forEach(p => p.classList.remove('active'));
      btn.classList.add('active');
      const panel = qs(`[data-panel="${btn.dataset.tab}"]`, container);
      if (panel) panel.classList.add('active');
    });
  });
}
