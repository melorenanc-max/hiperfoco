// ── APP ROUTER ────────────────────────────────────────────────────────────────

(function () {
  const routes = {
    'dashboard': renderDashboard,
    'ciclo': renderCiclo,
    'disciplinas': renderDisciplinas,
    'disciplina-detalhe': renderDisciplinaDetalhe,
    'planejamento': renderPlanejamento,
    'planejamento-detalhe': renderPlanejamentoDetalhe,
    'planejamento-disciplina': renderPlanejamentoDisciplina,
    'historico': renderHistorico,
    'estatisticas': renderHistorico, // merged into historico
    'configuracoes': renderConfiguracoes,
  };

  const container = document.getElementById('page-container');
  let currentPage = null;
  let previousPage = null;
  let currentParams = {};

  function navigate(page, params = {}) {
    previousPage = currentPage;
    currentPage = page;
    currentParams = params;

    document.querySelectorAll('.nav-link').forEach(link => {
      const linkPage = link.dataset.page;
      const activePage = ['disciplina-detalhe'].includes(page) ? 'disciplinas'
        : ['planejamento-detalhe','planejamento-disciplina'].includes(page) ? 'planejamento'
        : page;
      link.classList.toggle('active', linkPage === activePage);
    });

    // Fecha sidebar no mobile
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebar-overlay').classList.remove('visible');

    window.scrollTo(0, 0);
    container.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-3);font-size:0.9rem">Carregando...</div>';

    const fn = routes[page];
    if (!fn) {
      container.innerHTML = `<div class="empty-state"><div class="empty-icon">◈</div><p>Página não encontrada: ${page}</p></div>`;
      return;
    }
    fn(container, params);
  }

  window._app = {
    navigate,
    get previousPage() { return previousPage; },
    get currentParams() { return currentParams; }
  };

  // Nav links
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      navigate(link.dataset.page);
    });
  });

  // Modal close
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });

  // Mobile menu
  const menuToggle = document.getElementById('menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      overlay.classList.toggle('visible');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
    });
  }

  // Sidebar recolhível
  const collapseBtn = document.getElementById('sidebar-collapse-btn');
  const COLLAPSED_KEY = 'sidebar-collapsed';

  function applySidebarState() {
    const isCollapsed = localStorage.getItem(COLLAPSED_KEY) === '1';
    sidebar.classList.toggle('collapsed', isCollapsed);
    document.getElementById('main-content').style.marginLeft = isCollapsed ? '64px' : '';
  }

  if (collapseBtn) {
    collapseBtn.addEventListener('click', () => {
      const willCollapse = !sidebar.classList.contains('collapsed');
      localStorage.setItem(COLLAPSED_KEY, willCollapse ? '1' : '0');
      applySidebarState();
    });
  }

  // Clique no ícone do brand quando collapsed expande
  document.querySelector('.sidebar-brand').addEventListener('click', e => {
    if (sidebar.classList.contains('collapsed') && !e.target.closest('button')) {
      localStorage.setItem(COLLAPSED_KEY, '0');
      applySidebarState();
    }
  });

  applySidebarState();

  // Carrega info do usuário
  api.get('/auth/me').then(r => {
    if (r && r.autenticado && r.usuario) {
      const u = r.usuario;
      const nomeEl = document.getElementById('sidebar-user-nome');
      const fotoEl = document.getElementById('sidebar-user-foto');
      if (nomeEl) nomeEl.textContent = u.nome || u.email;
      if (fotoEl && u.foto) fotoEl.innerHTML = `<img src="${u.foto}" referrerpolicy="no-referrer">`;
    }
  }).catch(() => {});

  // Página inicial
  navigate('dashboard');
})();
