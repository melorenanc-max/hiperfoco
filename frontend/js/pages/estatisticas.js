// ── ESTATÍSTICAS PAGE ─────────────────────────────────────────────────────────

async function renderEstatisticas(container) {
  const [concursos, disciplinas] = await Promise.all([
    api.get('/api/concursos'),
    api.get('/api/disciplinas')
  ]);

  container.innerHTML = `
    <div class="page-header">
      <div>
        <div class="page-title">Estatísticas</div>
        <div class="page-subtitle">Análise completa do seu desempenho</div>
      </div>
    </div>

    <div class="filters-bar">
      <div class="filter-group">
        <label>Concurso</label>
        <select id="e-concurso">
          <option value="">Todos</option>
          ${concursos.map(c => `<option value="${c.id}">${c.nome}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>Disciplina</label>
        <select id="e-disciplina">
          <option value="">Todas</option>
          ${disciplinas.map(d => `<option value="${d.id}">${d.nome}</option>`).join('')}
        </select>
      </div>
      <div class="filter-group">
        <label>De</label>
        <input type="date" id="e-data-inicio">
      </div>
      <div class="filter-group">
        <label>Até</label>
        <input type="date" id="e-data-fim">
      </div>
    </div>

    <div id="stats-content"></div>
  `;

  async function load() {
    const concurso_id = qs('#e-concurso', container).value;
    const disciplina_id = qs('#e-disciplina', container).value;
    const data_inicio = qs('#e-data-inicio', container).value;
    const data_fim = qs('#e-data-fim', container).value;

    const [porDisc, evolucao] = await Promise.all([
      api.get('/api/stats/por-disciplina' + qs_params({ concurso_id, data_inicio, data_fim })),
      api.get('/api/stats/evolucao' + qs_params({ concurso_id, disciplina_id, data_inicio, data_fim }))
    ]);

    const content = qs('#stats-content', container);

    const discsComDados = porDisc.filter(d => d.total_questoes > 0);

    content.innerHTML = `
      <div class="stats-grid">
        <div class="chart-card">
          <div class="chart-title">% Acerto por Disciplina</div>
          <div id="chart-acerto"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Questões Respondidas por Disciplina</div>
          <div id="chart-questoes"></div>
        </div>
        <div class="chart-card" style="grid-column: 1 / -1">
          <div class="chart-title">Evolução do Acerto ao Longo do Tempo</div>
          <div id="chart-evolucao"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Distribuição de Sessões por Disciplina</div>
          <div id="chart-sessoes"></div>
        </div>
        <div class="chart-card">
          <div class="chart-title">Radar de Desempenho</div>
          <div id="chart-radar"></div>
        </div>
      </div>
    `;

    // Render charts using pure SVG/HTML (no external lib needed)
    renderBarChart('chart-acerto', content, discsComDados, 'pct_acerto', '%', 100, true);
    renderBarChart('chart-questoes', content, porDisc.filter(d=>d.total_questoes>0), 'total_questoes', '', null, false);
    renderEvolucaoChart('chart-evolucao', content, evolucao);
    renderSessoesChart('chart-sessoes', content, porDisc.filter(d=>d.total_sessoes>0));
    renderRadarChart('chart-radar', content, discsComDados);
  }

  ['#e-concurso','#e-disciplina','#e-data-inicio','#e-data-fim'].forEach(sel => {
    qs(sel, container).addEventListener('change', load);
  });

  load();
}

function renderBarChart(id, container, data, field, suffix, maxVal, showMeta) {
  const el = qs('#' + id, container);
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="text-muted text-small" style="padding:20px 0">Sem dados suficientes.</p>';
    return;
  }

  const max = maxVal || Math.max(...data.map(d => parseFloat(d[field]) || 0)) * 1.1 || 100;
  const barH = 24;
  const gap = 8;
  const labelW = 130;
  const chartW = 300;
  const totalH = data.length * (barH + gap);

  let svg = `<svg width="100%" viewBox="0 0 ${labelW + chartW + 80} ${totalH + 10}" xmlns="http://www.w3.org/2000/svg">`;

  const colors = ['#4F46E5','#EC4899','#F59E0B','#10B981','#8B5CF6','#EF4444','#06B6D4','#84CC16'];

  data.forEach((d, i) => {
    const val = parseFloat(d[field]) || 0;
    const barW = (val / max) * chartW;
    const y = i * (barH + gap);
    const color = colors[i % colors.length];

    // Label
    const nome = (d.nome || '').length > 18 ? d.nome.substring(0, 17) + '…' : (d.nome || '');
    svg += `<text x="${labelW - 6}" y="${y + barH/2 + 4}" text-anchor="end" font-size="11" fill="#6B7280" font-family="DM Sans, sans-serif">${nome}</text>`;

    // Bar bg
    svg += `<rect x="${labelW}" y="${y}" width="${chartW}" height="${barH}" rx="4" fill="#F3F4F6"/>`;

    // Bar fill
    if (barW > 0) {
      svg += `<rect x="${labelW}" y="${y}" width="${barW}" height="${barH}" rx="4" fill="${color}"/>`;
    }

    // Value
    svg += `<text x="${labelW + barW + 6}" y="${y + barH/2 + 4}" font-size="11" fill="#374151" font-weight="600" font-family="DM Sans, sans-serif">${val.toFixed(field === 'total_questoes' ? 0 : 1)}${suffix}</text>`;

    // Meta line (for acerto)
    if (showMeta && d.meta_acerto) {
      const metaX = labelW + (d.meta_acerto / max) * chartW;
      svg += `<line x1="${metaX}" y1="${y}" x2="${metaX}" y2="${y + barH}" stroke="#EF4444" stroke-width="2" stroke-dasharray="3,2"/>`;
    }
  });

  svg += '</svg>';
  el.innerHTML = svg;
}

function renderEvolucaoChart(id, container, data) {
  const el = qs('#' + id, container);
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="text-muted text-small" style="padding:20px 0">Sem dados suficientes para mostrar evolução.</p>';
    return;
  }

  const W = 700, H = 200, padL = 40, padB = 30, padT = 10, padR = 20;
  const chartW = W - padL - padR;
  const chartH = H - padT - padB;

  // Agrupar por data
  const byDate = {};
  data.forEach(d => {
    if (!byDate[d.data]) byDate[d.data] = [];
    byDate[d.data].push(d);
  });

  const dates = Object.keys(byDate).sort();
  if (dates.length < 2) {
    el.innerHTML = '<p class="text-muted text-small" style="padding:20px 0">Precisa de pelo menos 2 datas de estudo para mostrar evolução.</p>';
    return;
  }

  // Média geral por data
  const avgByDate = dates.map(date => {
    const items = byDate[date];
    const totalQ = items.reduce((s, i) => s + i.total_questoes, 0);
    const totalA = items.reduce((s, i) => s + (i.pct_acerto * i.total_questoes / 100), 0);
    return { date, pct: totalQ > 0 ? (totalA / totalQ) * 100 : 0 };
  });

  const minPct = Math.max(0, Math.min(...avgByDate.map(d => d.pct)) - 10);
  const maxPct = Math.min(100, Math.max(...avgByDate.map(d => d.pct)) + 10);

  const xStep = chartW / (dates.length - 1);

  function xPos(i) { return padL + i * xStep; }
  function yPos(pct) { return padT + chartH - ((pct - minPct) / (maxPct - minPct)) * chartH; }

  // Build path
  const points = avgByDate.map((d, i) => `${xPos(i)},${yPos(d.pct)}`).join(' ');
  const areaPoints = `${padL},${padT + chartH} ${points} ${padL + chartW},${padT + chartH}`;

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid lines
  for (let p = 0; p <= 100; p += 25) {
    if (p < minPct || p > maxPct) continue;
    const y = yPos(p);
    svg += `<line x1="${padL}" y1="${y}" x2="${padL + chartW}" y2="${y}" stroke="#E5E7EB" stroke-width="1"/>`;
    svg += `<text x="${padL - 4}" y="${y + 4}" text-anchor="end" font-size="10" fill="#9CA3AF" font-family="DM Sans">${p}%</text>`;
  }

  // Area fill
  svg += `<polygon points="${areaPoints}" fill="#4F46E5" opacity="0.08"/>`;

  // Line
  svg += `<polyline points="${points}" fill="none" stroke="#4F46E5" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;

  // Points and labels
  avgByDate.forEach((d, i) => {
    const x = xPos(i);
    const y = yPos(d.pct);
    svg += `<circle cx="${x}" cy="${y}" r="4" fill="#4F46E5"/>`;

    // X labels (só alguns para não poluir)
    if (i === 0 || i === dates.length - 1 || (dates.length <= 10) || i % Math.floor(dates.length / 5) === 0) {
      const [yr, mo, dy] = d.date.split('-');
      svg += `<text x="${x}" y="${H - 6}" text-anchor="middle" font-size="9" fill="#9CA3AF" font-family="DM Sans">${dy}/${mo}</text>`;
    }
  });

  svg += '</svg>';
  el.innerHTML = svg;
}

function renderSessoesChart(id, container, data) {
  const el = qs('#' + id, container);
  if (!data || data.length === 0) {
    el.innerHTML = '<p class="text-muted text-small" style="padding:20px 0">Sem dados.</p>';
    return;
  }

  const total = data.reduce((s, d) => s + d.total_sessoes, 0);
  const W = 300, H = 300, cx = 150, cy = 130, r = 100;
  const colors = ['#4F46E5','#EC4899','#F59E0B','#10B981','#8B5CF6','#EF4444','#06B6D4','#84CC16'];

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg">`;

  let startAngle = -Math.PI / 2;
  data.forEach((d, i) => {
    const slice = (d.total_sessoes / total) * 2 * Math.PI;
    const endAngle = startAngle + slice;
    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = slice > Math.PI ? 1 : 0;
    const color = colors[i % colors.length];

    svg += `<path d="M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z" fill="${color}" opacity="0.85"/>`;

    // Label no meio do slice
    const midAngle = startAngle + slice / 2;
    const lx = cx + (r * 0.65) * Math.cos(midAngle);
    const ly = cy + (r * 0.65) * Math.sin(midAngle);
    if (d.total_sessoes / total > 0.05) {
      svg += `<text x="${lx}" y="${ly + 4}" text-anchor="middle" font-size="10" fill="#fff" font-weight="700" font-family="DM Sans">${Math.round(d.total_sessoes/total*100)}%</text>`;
    }

    startAngle = endAngle;
  });

  // Legenda
  const legendY = cy + r + 20;
  data.slice(0, 8).forEach((d, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const lx = col === 0 ? 20 : W/2 + 10;
    const ly = legendY + row * 18;
    const nome = d.nome.length > 14 ? d.nome.substring(0,13) + '…' : d.nome;
    svg += `<rect x="${lx}" y="${ly - 9}" width="10" height="10" rx="2" fill="${colors[i % colors.length]}"/>`;
    svg += `<text x="${lx + 14}" y="${ly}" font-size="10" fill="#6B7280" font-family="DM Sans">${nome}</text>`;
  });

  svg += '</svg>';
  el.innerHTML = svg;
}

function renderRadarChart(id, container, data) {
  const el = qs('#' + id, container);
  if (!data || data.length < 3) {
    el.innerHTML = '<p class="text-muted text-small" style="padding:20px 0">Precisa de pelo menos 3 disciplinas com dados para o radar.</p>';
    return;
  }

  const items = data.slice(0, 8); // máx 8 eixos
  const n = items.length;
  const W = 300, H = 300, cx = 150, cy = 150, maxR = 110;

  const angleStep = (2 * Math.PI) / n;
  function angleFor(i) { return -Math.PI / 2 + i * angleStep; }
  function pointFor(i, pct) {
    const r = (pct / 100) * maxR;
    return { x: cx + r * Math.cos(angleFor(i)), y: cy + r * Math.sin(angleFor(i)) };
  }

  let svg = `<svg width="100%" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">`;

  // Grid circles
  [25, 50, 75, 100].forEach(pct => {
    const pts = items.map((_, i) => pointFor(i, pct));
    const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
    svg += `<path d="${path}" fill="none" stroke="#E5E7EB" stroke-width="1"/>`;
    svg += `<text x="${cx + 4}" y="${cy - (pct/100)*maxR + 4}" font-size="8" fill="#D1D5DB" font-family="DM Sans">${pct}%</text>`;
  });

  // Axis lines
  items.forEach((_, i) => {
    const p = pointFor(i, 100);
    svg += `<line x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}" stroke="#E5E7EB" stroke-width="1"/>`;
  });

  // Data polygon
  const dataPts = items.map((d, i) => pointFor(i, parseFloat(d.pct_acerto) || 0));
  const dataPath = dataPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ') + 'Z';
  svg += `<path d="${dataPath}" fill="#4F46E5" opacity="0.2"/>`;
  svg += `<path d="${dataPath}" fill="none" stroke="#4F46E5" stroke-width="2"/>`;

  // Points
  dataPts.forEach(p => {
    svg += `<circle cx="${p.x}" cy="${p.y}" r="3" fill="#4F46E5"/>`;
  });

  // Labels
  items.forEach((d, i) => {
    const labelR = maxR + 18;
    const angle = angleFor(i);
    const lx = cx + labelR * Math.cos(angle);
    const ly = cy + labelR * Math.sin(angle);
    const nome = d.nome.length > 10 ? d.nome.substring(0, 9) + '…' : d.nome;
    const anchor = Math.cos(angle) > 0.1 ? 'start' : Math.cos(angle) < -0.1 ? 'end' : 'middle';
    svg += `<text x="${lx}" y="${ly + 4}" text-anchor="${anchor}" font-size="9" fill="#6B7280" font-family="DM Sans">${nome}</text>`;
  });

  svg += '</svg>';
  el.innerHTML = svg;
}
